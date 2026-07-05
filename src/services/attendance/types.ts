/**
 * Attendance domain types for the `attendance` / `attendance_sessions` /
 * `break_sessions` / `attendance_events` tables (migration
 * `20260630130000_attendance_daily_reports.sql`).
 *
 * These tables are not yet in the generated `Database` types, so the row shapes
 * are declared here and the services talk to the relaxed `db` client. The status
 * enums are reused from `features/attendance/types` to stay single-sourced.
 */
import type { AttendanceStatus, WorkSessionStatus } from "@/features/attendance/types";

export type { AttendanceStatus, WorkSessionStatus };

export type AttendanceEventType =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "status_change"
  | "adjustment"
  | "auto_absent";

// ── attendance (daily record) ───────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  user_id: string;
  work_date: string; // YYYY-MM-DD
  department_id: string | null;
  team_id: string | null;
  status: AttendanceStatus;
  first_check_in_at: string | null;
  last_check_out_at: string | null;
  late_minutes: number;
  worked_seconds: number;
  break_seconds: number;
  overtime_seconds: number;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceRecordInsert = Pick<AttendanceRecord, "user_id" | "work_date"> &
  Partial<Omit<AttendanceRecord, "id" | "user_id" | "work_date" | "created_at" | "updated_at">>;

export type AttendanceRecordUpdate = Partial<
  Omit<AttendanceRecord, "id" | "user_id" | "work_date" | "created_at" | "updated_at">
>;

// ── attendance_sessions (clock-in/out spans within a day) ───────────────────

export interface AttendanceSession {
  id: string;
  attendance_id: string;
  user_id: string;
  work_date: string;
  status: WorkSessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  timezone: string | null;
  device: string | null;
  browser: string | null;
  ip: string | null;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceSessionInsert = Pick<
  AttendanceSession,
  "attendance_id" | "user_id" | "work_date"
> &
  Partial<Omit<AttendanceSession, "id" | "created_at" | "updated_at">>;

export type AttendanceSessionUpdate = Partial<
  Omit<
    AttendanceSession,
    "id" | "attendance_id" | "user_id" | "work_date" | "created_at" | "updated_at"
  >
>;

// ── break_sessions (breaks inside a work session) ───────────────────────────

export interface BreakSession {
  id: string;
  session_id: string;
  attendance_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BreakSessionInsert = Pick<BreakSession, "session_id" | "attendance_id" | "user_id"> &
  Partial<Omit<BreakSession, "id" | "created_at" | "updated_at">>;

export type BreakSessionUpdate = Partial<
  Omit<
    BreakSession,
    "id" | "session_id" | "attendance_id" | "user_id" | "created_at" | "updated_at"
  >
>;

// ── attendance_events (append-only audit log) ───────────────────────────────

export interface AttendanceEvent {
  id: string;
  attendance_id: string | null;
  session_id: string | null;
  user_id: string;
  event_type: AttendanceEventType;
  from_status: string | null;
  to_status: string | null;
  meta: Record<string, unknown>;
  occurred_at: string;
  actor_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export type AttendanceEventInsert = Pick<AttendanceEvent, "user_id" | "event_type"> &
  Partial<Omit<AttendanceEvent, "id" | "created_at">>;

/** Optional client/device context captured when opening a work session. */
export interface SessionContext {
  device?: string;
  browser?: string;
  ip?: string;
  location?: string;
  timezone?: string;
}
