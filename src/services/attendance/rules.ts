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
 *  - Expected working duration is 8 hours (overtime accrues beyond it).
 *  - Breaks may total at most 1 hour.
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

/** Seconds worked beyond the expected 8-hour day (0 if under). */
export function overtimeSeconds(
  workedSeconds: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): number {
  return Math.max(0, workedSeconds - policy.expectedWorkMinutes * 60);
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
 * `half_day` when worked time is under half the expected day, else `on_time`.
 * Mirrors `finish_work_session`.
 */
export function classifyCompletedDay(
  workedSeconds: number,
  lateMins: number,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): AttendanceStatus {
  if (lateMins > policy.graceMinutes) return "late";
  if (workedSeconds < (policy.expectedWorkMinutes * 60) / 2) return "half_day";
  return "on_time";
}
