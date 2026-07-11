/**
 * useTeamMiddayOverview — the manager/HR midday roll-up, backed by Supabase
 * through the repository layer (never Supabase directly). Mirrors the
 * report-review queue's `useReviewQueue` load pattern.
 *
 * Loads today's midday pulses (`daily_status_updates`, `kind='midday'`) plus the
 * HR roster and shapes them into `TeamMiddayEntry[]` for the overview tiles.
 * Scope is RLS/role-based — a reviewer sees every pulse they're permitted to see
 * (same as the review queue); "missing" = active employees with no pulse today.
 */
import { useCallback, useEffect, useState } from "react";

import { resolveWorkDate } from "@/features/daily-sync";
import { fetchHrEmployees } from "@/features/hr/api";
import { isPartTime } from "@/features/hr/employment-type";
import type { HrEmployee } from "@/features/hr/mock-data";
import { statusUpdateRepository } from "@/repositories/reports";

import type { BlockerLink, HelpRequest, TeamMiddayEntry } from "./types";

/** Prefer the human job title; fall back to the RBAC role slug. */
function rosterRole(e: HrEmployee): string {
  return e.jobTitle && e.jobTitle !== "—" ? e.jobTitle : e.role;
}

interface OverviewState {
  entries: TeamMiddayEntry[];
  loading: boolean;
  error: string | null;
}

export function useTeamMiddayOverview() {
  const [state, setState] = useState<OverviewState>({ entries: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const workDate = await resolveWorkDate();
      const [rows, employees] = await Promise.all([
        statusUpdateRepository.listMiddayByDate(workDate),
        fetchHrEmployees(),
      ]);

      // One submitted midday pulse per user (unique on user_id+work_date+kind).
      const byUser = new Map(rows.filter((r) => r.submitted_at).map((r) => [r.user_id, r]));

      const entries: TeamMiddayEntry[] = employees
        // Part-timers don't file a midday pulse, so they must never count as
        // "missing" in the participation roll-up. Full-timers are unaffected.
        .filter((e) => e.userId && e.status === "active" && !isPartTime(e.employmentType))
        .map((e) => {
          const row = byUser.get(e.userId!);
          const blockers = (row?.blockers as unknown as BlockerLink[]) ?? [];
          const help = (row?.help_request as HelpRequest) ?? { enabled: false };
          return {
            employeeId: e.id,
            name: e.name,
            initials: e.initials,
            department: e.department,
            role: rosterRole(e),
            submitted: !!row?.submitted_at,
            submittedAt: row?.submitted_at ?? undefined,
            progress: row?.progress ?? undefined,
            focus: row?.current_focus ?? undefined,
            outlook: row?.outlook ?? undefined,
            blockerCount: blockers.length,
            topBlocker: blockers[0]?.titleSnapshot ?? (row?.mood_note || undefined),
            needsHelp: help.enabled === true,
          };
        });

      setState({ entries, loading: false, error: null });
    } catch (err) {
      setState({
        entries: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load the midday overview.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
