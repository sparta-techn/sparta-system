/**
 * useReviewQueue — the manager-facing review queue, backed by Supabase through
 * the repository layer (never Supabase directly).
 *
 * Loads submitted End-of-Day reports (`daily_reports`) and intraday status
 * pulses (`daily_status_updates`) the signed-in reviewer may see (RLS-scoped),
 * resolves each subject's newest review from the append-only `report_reviews`
 * trail, and exposes an `approve` / `reject` action that files a new review.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { employeeRepository } from "@/repositories";
import {
  dailyReportRepository,
  reportReviewRepository,
  statusUpdateRepository,
} from "@/repositories/reports";
import type {
  DailyReportRow,
  ReportReviewDecision,
  ReportReviewRow,
  ReportReviewSubject,
  StatusUpdateRow,
} from "@/services/reports";
import type { Profile } from "@/features/auth/types";

import { reportDetailSections, statusDetailSections } from "./detail";
import type { ReportKind, ReviewHistoryEntry, ReviewQueueItem } from "./types";

function profileName(p: Profile): string {
  return p.full_name || p.display_name || p.email;
}

function reportSummary(row: DailyReportRow): string {
  if (row.summary?.trim()) return row.summary.trim();
  if (row.completed?.length) return `${row.completed.length} item(s) completed`;
  return "End-of-day report";
}

function statusSummary(row: StatusUpdateRow): string {
  return (
    row.main_goal?.trim() || row.current_focus?.trim() || row.mood_note?.trim() || "Status update"
  );
}

function statusKind(row: StatusUpdateRow): ReportKind {
  return row.kind === "midday" ? "midday" : "morning_checkin";
}

/** Full review trail per subject id, preserving the desc (newest-first) order. */
function trailBySubject(reviews: ReportReviewRow[]): Map<string, ReportReviewRow[]> {
  const map = new Map<string, ReportReviewRow[]>();
  for (const r of reviews) {
    const trail = map.get(r.subject_id);
    if (trail) trail.push(r);
    else map.set(r.subject_id, [r]);
  }
  return map;
}

/** Resolve a review trail into display entries with reviewer names filled in. */
function toHistory(
  trail: ReportReviewRow[] | undefined,
  nameById: Map<string, string>,
): ReviewHistoryEntry[] {
  return (trail ?? []).map((r) => ({
    id: r.id,
    decision: r.decision,
    comment: r.comment,
    reviewerName: r.reviewer_id ? (nameById.get(r.reviewer_id) ?? "Unknown") : "Unknown",
    createdAt: r.created_at,
  }));
}

interface QueueState {
  items: ReviewQueueItem[];
  loading: boolean;
  error: string | null;
}

export function useReviewQueue() {
  const [state, setState] = useState<QueueState>({ items: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [reports, statuses, people] = await Promise.all([
        dailyReportRepository.listSubmitted(),
        statusUpdateRepository.listSubmitted(),
        employeeRepository.list(),
      ]);

      const nameById = new Map(people.map((p) => [p.id, profileName(p)]));

      const [reportReviews, statusReviews] = await Promise.all([
        reportReviewRepository.listForSubjects(
          "daily_report",
          reports.map((r) => r.id),
        ),
        reportReviewRepository.listForSubjects(
          "status_update",
          statuses.map((s) => s.id),
        ),
      ]);
      const reportTrails = trailBySubject(reportReviews);
      const statusTrails = trailBySubject(statusReviews);

      const reportItems: ReviewQueueItem[] = reports.map((r) => {
        const trail = reportTrails.get(r.id);
        return {
          subjectType: "daily_report",
          subjectId: r.id,
          ownerId: r.user_id,
          ownerName: nameById.get(r.user_id) ?? "Unknown",
          workDate: r.work_date,
          submittedAt: r.submitted_at,
          kind: "eod",
          summary: reportSummary(r),
          detail: reportDetailSections(r),
          latestReview: trail?.[0] ?? null,
          reviews: toHistory(trail, nameById),
        };
      });

      const statusItems: ReviewQueueItem[] = statuses.map((s) => {
        const trail = statusTrails.get(s.id);
        return {
          subjectType: "status_update",
          subjectId: s.id,
          ownerId: s.user_id,
          ownerName: nameById.get(s.user_id) ?? "Unknown",
          workDate: s.work_date,
          submittedAt: s.submitted_at,
          kind: statusKind(s),
          summary: statusSummary(s),
          detail: statusDetailSections(s),
          latestReview: trail?.[0] ?? null,
          reviews: toHistory(trail, nameById),
        };
      });

      const items = [...reportItems, ...statusItems].sort((a, b) => {
        // Pending first, then newest submission first.
        const pa = a.latestReview ? 1 : 0;
        const pb = b.latestReview ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");
      });

      setState({ items, loading: false, error: null });
    } catch (err) {
      setState({
        items: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load the review queue.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = useCallback(
    async (item: ReviewQueueItem, decision: ReportReviewDecision, comment: string) => {
      try {
        const saved = await reportReviewRepository.submit({
          subject_type: item.subjectType as ReportReviewSubject,
          subject_id: item.subjectId,
          subject_owner: item.ownerId,
          decision,
          comment: comment.trim() || undefined,
        });
        // Optimistically attach the new outcome; keep the row in place.
        const historyEntry: ReviewHistoryEntry = {
          id: saved.id,
          decision: saved.decision,
          comment: saved.comment,
          reviewerName: "You",
          createdAt: saved.created_at,
        };
        setState((s) => ({
          ...s,
          items: s.items.map((it) =>
            it.subjectId === item.subjectId && it.subjectType === item.subjectType
              ? { ...it, latestReview: saved, reviews: [historyEntry, ...it.reviews] }
              : it,
          ),
        }));
        toast.success(decision === "approved" ? "Report approved" : "Report rejected");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't save the review. Please try again.",
        );
        return false;
      }
    },
    [],
  );

  return { ...state, refresh: load, review };
}
