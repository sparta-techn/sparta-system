/**
 * Roster-based absence synthesis.
 *
 * `work_sessions` only has a row once someone clocks in, so a genuine no-show
 * never appears in a range read. This module fills that gap: for every active
 * employee expected to work, it emits a synthetic "Absent" row for each working
 * day in the range with no session.
 *
 * Deliberate scope (mirrors existing product rules — see
 * `@/features/hr/employment-type`):
 *  - Part-timers are skipped entirely. The app has no per-day schedule for them
 *    (`expectsCheckInAlert` is false), so "absent" is not actionable.
 *  - A day counts as working only if it isn't a company weekend
 *    (`company_settings.weekend_days`, JS `getDay()` convention 0=Sun..6=Sat)
 *    and isn't a full-day company holiday (`holidays` table).
 *  - Absences are only synthesized for days on/after the employee's hire date
 *    and strictly before the current work date (today may still be in progress;
 *    future days aren't absences).
 *
 * Known limitations (no backing data yet — surfaced in the UI):
 *  - There is no leave/time-off table, so an approved-leave day shows as Absent.
 *  - `end_date` isn't exposed on the roster, so a mid-range offboarding isn't
 *    gated beyond the current `status` filter.
 */
import { isPartTime } from "@/features/hr/employment-type";
import type { HrEmployee } from "@/features/hr/mock-data";

import type { TeammateToday } from "../api";
import type { WorkSessionRow } from "../types";

/** A team attendance row that may be a real session or a synthesized absence. */
export type TeamAttendanceRow = TeammateToday & { synthetic?: boolean };

export interface SynthesizeAbsencesArgs {
  /** Real sessions already loaded for the range. */
  sessions: readonly TeammateToday[];
  /** The full employee roster (as returned by `fetchHrEmployees`). */
  roster: readonly HrEmployee[];
  /** Inclusive range bounds, `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** Current work date (`YYYY-MM-DD`); absences stop the day before this. */
  today: string;
  /** Company weekend days, JS `getDay()` convention (0=Sun..6=Sat). */
  weekendDays: readonly number[];
  /** Full-day company holidays in range, `YYYY-MM-DD`. */
  holidays: ReadonlySet<string>;
}

/** Parse `YYYY-MM-DD` to a UTC-midnight Date (no local-timezone drift). */
function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a UTC Date back to `YYYY-MM-DD`. */
function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` one day before `ymd`. */
function dayBefore(ymd: string): string {
  return formatYmd(new Date(parseYmd(ymd).getTime() - 86_400_000));
}

/** Inclusive list of `YYYY-MM-DD` from `from` to `to` (empty if `to < from`). */
function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseYmd(to).getTime();
  for (let t = parseYmd(from).getTime(); t <= end; t += 86_400_000) {
    out.push(formatYmd(new Date(t)));
  }
  return out;
}

/** Build a synthetic, fully-typed "absent" session row for one employee-day. */
function absentRow(employee: HrEmployee, date: string): TeamAttendanceRow {
  const session: WorkSessionRow = {
    id: `absent:${employee.userId}:${date}`,
    user_id: employee.userId!,
    work_date: date,
    started_at: null,
    finished_at: null,
    break_seconds: 0,
    working_seconds: 0,
    overtime_seconds: 0,
    late_minutes: 0,
    attendance_status: "absent",
    session_status: "not_started",
    browser: null,
    device: null,
    ip: null,
    location: null,
    notes: null,
    timezone: null,
    created_at: `${date}T00:00:00.000Z`,
    updated_at: `${date}T00:00:00.000Z`,
  };
  return {
    session,
    profile: {
      id: employee.userId!,
      full_name: employee.name,
      display_name: employee.name,
      avatar_url: null,
      job_title: employee.jobTitle ?? null,
    },
    synthetic: true,
  };
}

/**
 * Synthesize "Absent" rows for expected-but-missing employee working days.
 * Returns only the synthetic rows — callers merge these with real sessions.
 */
export function synthesizeAbsences(args: SynthesizeAbsencesArgs): TeamAttendanceRow[] {
  const { sessions, roster, from, to, today, weekendDays, holidays } = args;

  // Cap the range the day before today: today is in progress, later days aren't
  // absences yet.
  const lastDay = dayBefore(today);
  const rangeEnd = lastDay < to ? lastDay : to;
  if (rangeEnd < from) return [];

  const weekend = new Set(weekendDays);
  const workingDays = eachDate(from, rangeEnd).filter(
    (date) => !weekend.has(parseYmd(date).getUTCDay()) && !holidays.has(date),
  );
  if (workingDays.length === 0) return [];

  const seen = new Set(sessions.map((s) => `${s.session.user_id}:${s.session.work_date}`));

  const rows: TeamAttendanceRow[] = [];
  for (const employee of roster) {
    // Active, non-part-time employees with a linked account are the ones a
    // no-show is meaningful for.
    if (!employee.userId || employee.status !== "active" || isPartTime(employee.employmentType)) {
      continue;
    }
    const hireDate = employee.joinedAt ? employee.joinedAt.slice(0, 10) : null;
    for (const date of workingDays) {
      if (hireDate && date < hireDate) continue;
      if (seen.has(`${employee.userId}:${date}`)) continue;
      rows.push(absentRow(employee, date));
    }
  }
  return rows;
}
