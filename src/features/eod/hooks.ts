/**
 * useTeamEodOverview — the manager/HR end-of-day roll-up, backed by Supabase
 * through the repository layer (never Supabase directly). Mirrors the
 * report-review queue's `useReviewQueue` load pattern.
 *
 * Loads today's reports (`daily_reports`) plus the HR roster and shapes them
 * into `TeamEodEntry[]` for the overview tiles. Scope is RLS/role-based — a
 * reviewer sees every report they're permitted to see (same as the review
 * queue); "missing" = active employees with no submitted report today.
 */
import { useCallback, useEffect, useState } from "react";

import { resolveWorkDate } from "@/features/daily-sync";
import { fetchHrEmployees } from "@/features/hr/api";
import type { HrEmployee } from "@/features/hr/mock-data";
import type { TaskProgressEntry } from "@/features/midday/types";
import { dailyReportRepository } from "@/repositories/reports";

import type { TeamEodEntry, TomorrowPlan } from "./types";

function rosterRole(e: HrEmployee): string {
  return e.jobTitle && e.jobTitle !== "—" ? e.jobTitle : e.role;
}

/** Completed count + weighted completion % (partial counts half) over the plan. */
function completion(entries: TaskProgressEntry[]): { count: number; pct: number } {
  if (entries.length === 0) return { count: 0, pct: 0 };
  let weight = 0;
  let done = 0;
  for (const t of entries) {
    if (t.state === "completed") {
      weight += 1;
      done += 1;
    } else if (t.state === "partial") {
      weight += 0.5;
    }
  }
  return { count: done, pct: Math.round((weight / entries.length) * 100) };
}

interface OverviewState {
  entries: TeamEodEntry[];
  loading: boolean;
  error: string | null;
}

export function useTeamEodOverview() {
  const [state, setState] = useState<OverviewState>({ entries: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const workDate = await resolveWorkDate();
      const [rows, employees] = await Promise.all([
        dailyReportRepository.listByDate(workDate),
        fetchHrEmployees(),
      ]);

      // One submitted report per user (unique on user_id+work_date); drafts excluded.
      const byUser = new Map(rows.filter((r) => r.submitted_at).map((r) => [r.user_id, r]));

      const entries: TeamEodEntry[] = employees
        .filter((e) => e.userId && e.status === "active")
        .map((e) => {
          const row = byUser.get(e.userId!);
          const { count, pct } = completion(row?.completed ?? []);
          const openDeps = (row?.open_dependencies ?? []).filter((d) => !d.resolvedNow);
          const need = row?.need_from_others?.[0];
          const tomorrow = row?.tomorrow_plan as TomorrowPlan | undefined;
          return {
            employeeId: e.id,
            name: e.name,
            initials: e.initials,
            department: e.department,
            role: rosterRole(e),
            submitted: !!row?.submitted_at,
            submittedAt: row?.submitted_at ?? undefined,
            completionPct: row ? pct : undefined,
            completedCount: row ? count : undefined,
            inProgressCount: row?.in_progress?.length ?? undefined,
            openDepsCount: row ? openDeps.length : undefined,
            topBlocker: openDeps[0]?.titleSnapshot ?? undefined,
            tomorrowRisk: tomorrow?.expectedBlockers?.[0] ?? undefined,
            helpRequest: need
              ? need.department
                ? `${need.department}: ${need.description}`
                : need.description
              : undefined,
          };
        });

      setState({ entries, loading: false, error: null });
    } catch (err) {
      setState({
        entries: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load the EOD overview.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
