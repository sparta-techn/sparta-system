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
 *  - The scheduled day is 8 hours, made of 7h worked + a 1h break allowance.
 *    A session auto-finishes on NET WORKING TIME reaching that 7h — break time
 *    is excluded, so the target is identical whether the break is taken or
 *    skipped; skipping it just makes the day end an hour earlier on the clock.
 *    See {@link netWorkTargetSeconds} and `auto_finish_session_if_due`.
 *  - Breaks may total at most 1 hour. That hour is PAID (payroll credits it back
 *    on a completed full-time day) but never WORKED, so it moves pay, not the
 *    target. Part-time has no allowance and a 4h working target; see
 *    `@/features/hr/employment-type`.
 *  - Overtime no longer accrues — sessions close at the target.
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

/**
 * NET WORKING TIME for a span: everything on the clock minus everything spent on
 * break (never negative). This is the single definition of "worked" in the
 * product — the same quantity `work_sessions.working_seconds` holds server-side
 * (`finished_at − started_at − break_seconds`) — and it is what the auto-finish
 * target is measured in.
 */
export function computeWorkedSeconds(startedAt: Date, endedAt: Date, breakSeconds: number): number {
  const gross = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  return Math.max(0, gross - Math.max(0, breakSeconds));
}

/**
 * Seconds of net working time that complete the day for a policy whose break
 * allowance sits inside the scheduled day: 8h scheduled − 1h break = 7h worked.
 *
 * Employment types with no allowance (part-time) don't use this — their target
 * is already pure working time; see `netWorkTargetMinutes` in
 * `@/features/hr/employment-type`, which is the type-aware entry point.
 * Mirrors the server `session_day_target(_uid).net_target_minutes`.
 */
export function netWorkTargetSeconds(policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY): number {
  return Math.max(60, (policy.expectedWorkMinutes - policy.maxBreakMinutes) * 60);
}

/**
 * Seconds beyond the expected 8-hour day (0 if under).
 *
 * Overtime is removed from the product: sessions are auto-finished AT the
 * target, so this returns 0 for any session that ran its normal course, and
 * nothing prices a non-zero result any more. Retained because historical rows
 * still carry `overtime_seconds` and reports over past periods must be able to
 * reproduce how those numbers were derived — including the day-progress
 * argument they were derived from, which no live path computes any more.
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
 * The exact instant at which cumulative NET WORKING TIME since `startedAt` first
 * reaches `targetSeconds`, or `null` if it hasn't by `now`. This is the instant
 * the session is auto-finished at (`finished_at`).
 *
 * The walk only advances during `working` spans: every break, of any length,
 * freezes it and pushes the crossing instant out by exactly the break's own
 * duration. So the target is the same amount of work whether the employee takes
 * their break, splits it, or skips it entirely — a break never brings the
 * finish closer, and skipping one never leaves the day unfinishable. While a
 * break is still open the result is `null`: progress is frozen, so there is
 * nothing to close.
 *
 * Mirrors the server `session_net_work_threshold_ts` and is the single client
 * source for auto-finish: it decides when the session is due to close and when
 * to poke the server so an open tab updates. Independent of WHEN it runs (a late
 * evaluation still returns the real crossing instant, which is why a 10-minute
 * sweep is precise enough) and correct across midnight — it works purely in
 * absolute timestamps, never wall-clock dates, so an overnight shift is
 * attributed by its real `startedAt`, not by "today".
 */
export function dayTargetThresholdAt(
  startedAt: Date,
  breaks: BreakInterval[],
  targetSeconds: number,
  now: Date = new Date(),
): Date | null {
  let remaining = targetSeconds;
  let cursor = startedAt.getTime();
  const ordered = [...breaks].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  for (const b of ordered) {
    const worked = (b.startedAt.getTime() - cursor) / 1000; // working seconds before this break
    if (worked >= remaining) return new Date(cursor + remaining * 1000);
    remaining -= worked;
    if (b.endedAt === null) return null; // still on break, working time frozen
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
 * `half_day` when net working time is under half the day's working target, else
 * `on_time`. Takes {@link computeWorkedSeconds}, and measures against
 * {@link netWorkTargetSeconds} — half of the 7h that has to be worked, not half
 * of the 8h scheduled day, since the break hour is never worked by anyone.
 * Mirrors `finish_work_session`.
 */
export function classifyCompletedDay(
  workedSeconds: number,
  lateMins: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): AttendanceStatus {
  if (lateMins > policy.graceMinutes) return "late";
  if (workedSeconds < netWorkTargetSeconds(policy) / 2) return "half_day";
  return "on_time";
}
