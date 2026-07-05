import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { AttendanceSession, AttendanceSessionInsert, AttendanceSessionUpdate } from "./types";

const ACTIVE_STATUSES = ["working", "on_break"] as const;

/**
 * AttendanceSessionsService — work sessions within a day
 * (`public.attendance_sessions`). A session is an open clock-in span; it ends
 * at check-out. At most one session per user is "active" (working / on_break).
 */
export class AttendanceSessionsService extends BaseService<
  AttendanceSession,
  AttendanceSessionInsert,
  AttendanceSessionUpdate
> {
  protected readonly table = "attendance_sessions";
  protected readonly entity = "Work session";
  protected readonly defaultOrderBy = "started_at";

  /** The currently-open session for a user on a work date, or `null`. */
  async getActive(userId: string, workDate: string): Promise<AttendanceSession | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("user_id", userId)
        .eq("work_date", workDate)
        .in("status", ACTIVE_STATUSES as unknown as string[])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AttendanceSession | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** All sessions for a daily attendance record (oldest first). */
  listByAttendance(
    attendanceId: string,
    params: ListParams<AttendanceSession> = {},
  ): Promise<AttendanceSession[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, attendance_id: attendanceId },
      direction: params.direction ?? "asc",
    });
  }

  /** A user's sessions (most recent first). */
  listByUser(
    userId: string,
    params: ListParams<AttendanceSession> = {},
  ): Promise<AttendanceSession[]> {
    return this.list({ ...params, filters: { ...params.filters, user_id: userId } });
  }
}

/** Shared singleton — import this, not the class. */
export const attendanceSessionsService = new AttendanceSessionsService();
