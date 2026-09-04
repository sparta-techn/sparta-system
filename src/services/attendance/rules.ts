/**
 * SpartaFlow attendance business rules (pure, side-effect-free).
 *
 * Single source of truth for the time/break policy, mirrored by the live
 * `company_settings` row + `start_work_session` / `finish_work_session` RPCs.
 * Kept dependency-free (types only) so it is trivially unit-testable and can be
 * reused by the {@link AttendanceRepository} without pulling in Supabase.
 *
 * Rules encoded here:
 *  - Working hours start at 09:00.
 *  - Check-in is allowed until 10:00 (60-min grace) without penalty.
 *  - Check-in after 10:00 is Late. No check-in on a working day is Absent.
 *  - Expected day is 8 hours; a session is auto-finished once it reaches that.
 *    Overtime no longer accrues — see `auto_finish_session_if_due`.
 *  - Breaks may total at most 1 hour, and that hour counts toward the 8h day —
 *    a full day on the clock is 7h worked + 1h break. Employment types that get
 *    no break allowance (part-time) pass `breakCreditSeconds = 0` and are
 *    measured on pure working time instead; see `@/features/hr/employment-type`.
 */
import type { AttendanceStatus } from "@/features/attendance/types";

export interface AttendancePolicy {
  /** Working-day start, `"HH:MM"` (24h). */
  workStart: string;
  /** Grace window after {@link workStart}, in minutes, before Late applies. */
  graceMinutes: number;
  /** Expected working duration, in minutes. */
  expectedWorkMinutes: number;
  /** Maximum total break duration, in minutes. */
  maxBreakMinutes: number;
}

/** Defaults matching the seeded `company_settings` row. */
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  workStart: "09:00",
  graceMinutes: 60,
  expectedWorkMinutes: 480,
  maxBreakMinutes: 60,
};

/** Day classification context (weekend / holiday / leave short-circuit the time rules). */
export interface DayContext {
  isWeekend?: boolean;
  isHoliday?: boolean;
  onLeave?: boolean;
}

function startMinutes(policy: AttendancePolicy): number {
  const [h, m] = policy.workStart.split(":").map(Number);
  return h * 60 + (m || 0);
}

function clockMinutes(at: Date): number {
  return at.getHours() * 60 + at.getMinutes();
}

/** The latest wall-clock minute-of-day a check-in stays on time (start + grace). */
export function lateThresholdMinutes(policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY): number {
  return startMinutes(policy) + policy.graceMinutes;
}

/** Minutes a check-in is after {@link AttendancePolicy.workStart} (0 if early/on time). */
export function lateMinutes(
  checkInAt: Date,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): number {
  return Math.max(0, clockMinutes(checkInAt) - startMinutes(policy));
}

/** Whether a check-in at `checkInAt` counts as Late (after the grace window). */
export function isLate(
  checkInAt: Date,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): boolean {
  return lateMinutes(checkInAt, policy) > policy.graceMinutes;
}

/**
 * Attendance status implied by a check-in (or its absence) on a working day.
 * `null` check-in → `absent`; weekend/holiday/leave short-circuit.
 */
export function attendanceStatusForCheckIn(
  checkInAt: Date | null,
  ctx: DayContext = {},
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): AttendanceStatus {
  if (ctx.onLeave) return "leave";
  if (ctx.isHoliday) return "holiday";
  if (ctx.isWeekend) return "weekend";
  if (!checkInAt) return "absent";
  return isLate(checkInAt, policy) ? "late" : "on_time";
}

/** Net worked seconds for a span minus counted break seconds (never negative). */
export function computeWorkedSeconds(startedAt: Date, endedAt: Date, breakSeconds: number): number {
  const gross = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  return Math.max(0, gross - Math.max(0, breakSeconds));
}

/**
 * Seconds counted toward the day: worked time plus break time up to
 * `breakCreditSeconds` (the allowance that sits *inside* the target). Pass 0 to
 * measure pure working time. This is the quantity every day-length rule below
 * compares against {@link AttendancePolicy.expectedWorkMinutes}.
 */
export function dayProgressSeconds(
  workedSeconds: number,
  breakSeconds: number,
  breakCreditSeconds: number,
): number {
  const credited = Math.min(Math.max(0, breakSeconds), Math.max(0, breakCreditSeconds));
  return Math.max(0, workedSeconds) + credited;
}

/**
 * Seconds beyond the expected 8-hour day (0 if under); takes day progress.
 *
 * Overtime is removed from the product: sessions are auto-finished AT the
 * target, so this returns 0 for any session that ran its normal course, and
 * nothing prices a non-zero result any more. Retained because historical rows
 * still carry `overtime_seconds` and reports over past periods must be able to
 * reproduce how those numbers were derived.
 */
export function overtimeSeconds(
  progressSeconds: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): number {
  return Math.max(0, progressSeconds - policy.expectedWorkMinutes * 60);
}

/** A break interval as absolute timestamps; `endedAt` null while a break is open. */
export interface BreakInterval {
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * The exact instant at which cumulative DAY PROGRESS since `startedAt` first
 * reaches `targetSeconds`, or `null` if it hasn't by `now`. This is the instant
 * the session is auto-finished at (`check_out_time`).
 *
 * Progress runs at real time while working, and also while on break for as long
 * as `breakCreditSeconds` of allowance is left (a full-time 8h day is 7h worked
 * + 1h break, so that hour must tick). Once the allowance is spent, break time
 * freezes progress. Pass `breakCreditSeconds = 0` (the default, and what
 * part-time uses) to measure pure working time.
 *
 * Mirrors the server `session_target_threshold_ts` break-walk and is the single
 * client source for auto-finish: it decides when the session is due to close and
 * when to poke the server so an open tab updates. Independent of WHEN it runs
 * (a late evaluation still returns the real crossing instant) and correct across
 * midnight — it works purely in absolute timestamps, never wall-clock dates, so
 * an overnight shift is attributed by its real `startedAt`, not by "today".
 * Returns `null` while the employee is mid-break with the allowance exhausted
 * and the target not yet reached.
 */
export function dayTargetThresholdAt(
  startedAt: Date,
  breaks: BreakInterval[],
  targetSeconds: number,
  now: Date = new Date(),
  breakCreditSeconds = 0,
): Date | null {
  let remaining = targetSeconds;
  let credit = Math.max(0, breakCreditSeconds);
  let cursor = startedAt.getTime();
  const ordered = [...breaks].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  for (const b of ordered) {
    const worked = (b.startedAt.getTime() - cursor) / 1000; // working seconds before this break
    if (worked >= remaining) return new Date(cursor + remaining * 1000);
    remaining -= worked;

    // The break itself advances progress only while allowance is left.
    const breakEnd = b.endedAt ?? now;
    const credited = Math.min(
      Math.max(0, (breakEnd.getTime() - b.startedAt.getTime()) / 1000),
      credit,
    );
    if (credited >= remaining) return new Date(b.startedAt.getTime() + remaining * 1000);
    remaining -= credited;
    credit -= credited;
    if (b.endedAt === null) return null; // still on break, target not reached
    cursor = b.endedAt.getTime();
  }
  const seg = (now.getTime() - cursor) / 1000;
  if (seg >= remaining) return new Date(cursor + remaining * 1000);
  return null;
}

/** Remaining break budget in seconds (0 once the 1-hour cap is reached). */
export function remainingBreakSeconds(
  totalBreakSeconds: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): number {
  return Math.max(0, policy.maxBreakMinutes * 60 - Math.max(0, totalBreakSeconds));
}

/** Whether accumulated break time has exceeded the 1-hour cap. */
export function breakLimitExceeded(
  totalBreakSeconds: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): boolean {
  return totalBreakSeconds > policy.maxBreakMinutes * 60;
}

/**
 * Final attendance status once a day is checked out: keeps Late, downgrades to
 * `half_day` when day progress is under half the expected day, else `on_time`.
 * Takes {@link dayProgressSeconds}, not raw worked time. Mirrors
 * `finish_work_session`.
 */
export function classifyCompletedDay(
  progressSeconds: number,
  lateMins: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): AttendanceStatus {
  if (lateMins > policy.graceMinutes) return "late";
  if (progressSeconds < (policy.expectedWorkMinutes * 60) / 2) return "half_day";
  return "on_time";
}
