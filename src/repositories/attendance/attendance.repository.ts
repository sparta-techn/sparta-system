import { getCompanySettings, getCurrentWorkDate } from "@/features/attendance/api";
import { ServiceError } from "@/services/core";
import {
  AttendanceEventsService,
  attendanceEventsService,
  AttendanceRecordsService,
  attendanceRecordsService,
  AttendanceSessionsService,
  attendanceSessionsService,
  BreakSessionsService,
  breakSessionsService,
  type AttendanceRecord,
  type AttendanceSession,
  type BreakSession,
  type SessionContext,
} from "@/services/attendance";
import {
  attendanceStatusForCheckIn,
  classifyCompletedDay,
  DEFAULT_ATTENDANCE_POLICY,
  lateMinutes,
  overtimeSeconds,
  type AttendancePolicy,
} from "@/services/attendance/rules";

/** Composite snapshot of a user's day. */
export interface AttendanceDay {
  workDate: string;
  attendance: AttendanceRecord | null;
  sessions: AttendanceSession[];
  breaks: BreakSession[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function diffSeconds(start: string, end: string): number {
  return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

/**
 * AttendanceRepository — domain-facing attendance lifecycle over the
 * `attendance` / `attendance_sessions` / `break_sessions` / `attendance_events`
 * tables (migration 20260630130000). Composes the four services into the
 * intention-revealing verbs the app needs: check-in, check-out, break start/end.
 *
 * NOTE: distinct from the legacy `AttendanceRepository` in
 * `src/repositories/attendance.repository.ts` (RPC-backed `work_sessions`).
 * Import this one from `@/repositories/attendance`.
 *
 * Each verb is a small multi-statement sequence rather than a single atomic
 * RPC; if/when these flows need transactional guarantees, fold the logic into
 * SECURITY DEFINER functions and have the repository call those instead — the
 * method signatures stay the same.
 */
export class AttendanceRepository {
  constructor(
    private readonly records: AttendanceRecordsService = attendanceRecordsService,
    private readonly sessions: AttendanceSessionsService = attendanceSessionsService,
    private readonly breaks: BreakSessionsService = breakSessionsService,
    private readonly events: AttendanceEventsService = attendanceEventsService,
  ) {}

  /** Resolve the company-timezone work date when the caller didn't pass one. */
  private resolveWorkDate(workDate?: string): Promise<string> {
    return workDate ? Promise.resolve(workDate) : getCurrentWorkDate();
  }

  /** Build the attendance policy from `company_settings` (falls back to defaults). */
  private async getPolicy(): Promise<AttendancePolicy> {
    try {
      const s = await getCompanySettings();
      return {
        workStart: (s.work_start_time ?? DEFAULT_ATTENDANCE_POLICY.workStart).slice(0, 5),
        graceMinutes: s.grace_period_minutes ?? DEFAULT_ATTENDANCE_POLICY.graceMinutes,
        expectedWorkMinutes:
          s.expected_work_minutes ?? DEFAULT_ATTENDANCE_POLICY.expectedWorkMinutes,
        maxBreakMinutes: s.max_break_minutes ?? DEFAULT_ATTENDANCE_POLICY.maxBreakMinutes,
      };
    } catch {
      return DEFAULT_ATTENDANCE_POLICY;
    }
  }

  /** Full snapshot of a user's day (record + sessions + breaks). */
  async getDay(userId: string, workDate?: string): Promise<AttendanceDay> {
    const date = await this.resolveWorkDate(workDate);
    const attendance = await this.records.getByDate(userId, date);
    if (!attendance) return { workDate: date, attendance: null, sessions: [], breaks: [] };
    const [sessions, breaks] = await Promise.all([
      this.sessions.listByAttendance(attendance.id),
      this.breaks.listByAttendance(attendance.id),
    ]);
    return { workDate: date, attendance, sessions, breaks };
  }

  /** The active (open) session for a user today, or `null`. */
  async getActiveSession(userId: string, workDate?: string): Promise<AttendanceSession | null> {
    const date = await this.resolveWorkDate(workDate);
    return this.sessions.getActive(userId, date);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Clock in — ensures today's attendance record exists, opens a new work
   * session and logs a `clock_in` event. Returns the opened session.
   */
  async checkIn(
    userId: string,
    context: SessionContext = {},
    workDate?: string,
  ): Promise<AttendanceSession> {
    const date = await this.resolveWorkDate(workDate);

    // Guard against a duplicate open session (would orphan sessions + double-count
    // hours). A new session may only open once the previous one is checked out.
    const active = await this.sessions.getActive(userId, date);
    if (active) {
      throw new ServiceError(
        "Already checked in — an active work session is open",
        "already_checked_in",
      );
    }

    const at = nowIso();
    const policy = await this.getPolicy();

    const attendance = await this.records.ensureForDate(userId, date);

    // First check-in of the day fixes the late/on-time status (09:00 + grace → 10:00).
    if (!attendance.first_check_in_at) {
      const checkInAt = new Date(at);
      await this.records.update(attendance.id, {
        first_check_in_at: at,
        late_minutes: lateMinutes(checkInAt, policy),
        status: attendanceStatusForCheckIn(checkInAt, {}, policy),
      });
    }

    const session = await this.sessions.create({
      attendance_id: attendance.id,
      user_id: userId,
      work_date: date,
      status: "working",
      started_at: at,
      device: context.device ?? null,
      browser: context.browser ?? null,
      ip: context.ip ?? null,
      location: context.location ?? null,
      timezone: context.timezone ?? null,
    });

    await this.events.log({
      attendance_id: attendance.id,
      session_id: session.id,
      user_id: userId,
      event_type: "clock_in",
      to_status: "working",
    });

    return session;
  }

  /**
   * Check out — closes the active session (and any open break), accumulates the
   * worked/break totals onto the daily record and logs a `clock_out` event.
   */
  async checkOut(userId: string, workDate?: string): Promise<AttendanceRecord> {
    const date = await this.resolveWorkDate(workDate);
    const session = await this.sessions.getActive(userId, date);
    if (!session)
      throw new ServiceError("No active work session to check out of", "no_active_session");
    const at = nowIso();
    const policy = await this.getPolicy();

    // Close an open break first so its time is counted.
    const openBreak = await this.breaks.getOpenBreak(session.id);
    if (openBreak) {
      await this.breaks.update(openBreak.id, {
        ended_at: at,
        duration_seconds: diffSeconds(openBreak.started_at, at),
      });
    }

    const sessionBreaks = await this.breaks.listBySession(session.id);
    const breakSeconds = sessionBreaks.reduce((acc, b) => acc + (b.duration_seconds ?? 0), 0);
    const durationSeconds = diffSeconds(session.started_at, at);
    const workedSeconds = Math.max(0, durationSeconds - breakSeconds);

    await this.sessions.update(session.id, {
      status: "finished",
      ended_at: at,
      duration_seconds: durationSeconds,
    });

    const attendance = await this.records.getByIdOrThrow(session.attendance_id);
    const totalWorked = attendance.worked_seconds + workedSeconds;
    const totalBreak = attendance.break_seconds + breakSeconds;
    const updated = await this.records.update(attendance.id, {
      last_check_out_at: at,
      worked_seconds: totalWorked,
      break_seconds: totalBreak,
      // 8-hour day → overtime beyond it; final status keeps Late / flags half-day.
      overtime_seconds: overtimeSeconds(totalWorked, policy),
      status: classifyCompletedDay(totalWorked, attendance.late_minutes, policy),
    });

    await this.events.log({
      attendance_id: attendance.id,
      session_id: session.id,
      user_id: userId,
      event_type: "clock_out",
      from_status: session.status,
      to_status: "finished",
    });

    return updated;
  }

  /** Start a break in the active session and flip it to `on_break`. */
  async startBreak(userId: string, reason?: string, workDate?: string): Promise<BreakSession> {
    const date = await this.resolveWorkDate(workDate);
    const session = await this.sessions.getActive(userId, date);
    if (!session) throw new ServiceError("No active work session", "no_active_session");
    if (session.status === "on_break")
      throw new ServiceError("Already on break", "already_on_break");
    const at = nowIso();

    const brk = await this.breaks.create({
      session_id: session.id,
      attendance_id: session.attendance_id,
      user_id: userId,
      started_at: at,
      reason: reason ?? null,
    });
    await this.sessions.update(session.id, { status: "on_break" });
    await this.events.log({
      attendance_id: session.attendance_id,
      session_id: session.id,
      user_id: userId,
      event_type: "break_start",
      from_status: session.status,
      to_status: "on_break",
    });

    return brk;
  }

  /** End the open break and resume work. */
  async endBreak(userId: string, workDate?: string): Promise<BreakSession> {
    const date = await this.resolveWorkDate(workDate);
    const session = await this.sessions.getActive(userId, date);
    if (!session) throw new ServiceError("No active work session", "no_active_session");
    const openBreak = await this.breaks.getOpenBreak(session.id);
    if (!openBreak) throw new ServiceError("Not currently on break", "not_on_break");
    const at = nowIso();

    const closed = await this.breaks.update(openBreak.id, {
      ended_at: at,
      duration_seconds: diffSeconds(openBreak.started_at, at),
    });
    await this.sessions.update(session.id, { status: "working" });
    await this.events.log({
      attendance_id: session.attendance_id,
      session_id: session.id,
      user_id: userId,
      event_type: "break_end",
      from_status: "on_break",
      to_status: "working",
    });

    return closed;
  }
}

/** Shared singleton — import this, not the class. */
export const attendanceRepository = new AttendanceRepository();
