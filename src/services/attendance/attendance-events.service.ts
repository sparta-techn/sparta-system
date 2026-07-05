import { BaseService } from "../core/base-service";
import { ServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { AttendanceEvent, AttendanceEventInsert } from "./types";

/**
 * AttendanceEventsService — append-only attendance audit log
 * (`public.attendance_events`). Lifecycle transitions (clock-in/out,
 * break start/end, adjustments) are recorded here. Rows are immutable: the
 * underlying table grants only SELECT / INSERT, so update / remove are blocked
 * at this layer too.
 */
export class AttendanceEventsService extends BaseService<AttendanceEvent, AttendanceEventInsert> {
  protected readonly table = "attendance_events";
  protected readonly entity = "Attendance event";
  protected readonly defaultOrderBy = "occurred_at";

  /** Append an event. `actor_id` defaults to `auth.uid()` server-side when omitted. */
  log(event: AttendanceEventInsert): Promise<AttendanceEvent> {
    return this.create(event);
  }

  /** Events for a daily attendance record (most recent first). */
  listByAttendance(
    attendanceId: string,
    params: ListParams<AttendanceEvent> = {},
  ): Promise<AttendanceEvent[]> {
    return this.list({ ...params, filters: { ...params.filters, attendance_id: attendanceId } });
  }

  /** Events for a user (most recent first). */
  listByUser(userId: string, params: ListParams<AttendanceEvent> = {}): Promise<AttendanceEvent[]> {
    return this.list({ ...params, filters: { ...params.filters, user_id: userId } });
  }

  // ── Append-only guards ─────────────────────────────────────────────────────

  override update(): Promise<AttendanceEvent> {
    return Promise.reject(new ServiceError("Attendance events are append-only", "append_only"));
  }

  override upsert(): Promise<AttendanceEvent> {
    return Promise.reject(new ServiceError("Attendance events are append-only", "append_only"));
  }

  override remove(): Promise<void> {
    return Promise.reject(new ServiceError("Attendance events are append-only", "append_only"));
  }
}

/** Shared singleton — import this, not the class. */
export const attendanceEventsService = new AttendanceEventsService();
