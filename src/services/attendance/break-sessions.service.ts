import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { BreakSession, BreakSessionInsert, BreakSessionUpdate } from "./types";

/**
 * BreakSessionsService — breaks within a work session
 * (`public.break_sessions`). An open break has `ended_at IS NULL`; at most one
 * open break per session.
 */
export class BreakSessionsService extends BaseService<
  BreakSession,
  BreakSessionInsert,
  BreakSessionUpdate
> {
  protected readonly table = "break_sessions";
  protected readonly entity = "Break";
  protected readonly defaultOrderBy = "started_at";

  /** The currently-open break for a session, or `null`. */
  async getOpenBreak(sessionId: string): Promise<BreakSession | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("session_id", sessionId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as BreakSession | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** All breaks for a session (oldest first). */
  listBySession(sessionId: string, params: ListParams<BreakSession> = {}): Promise<BreakSession[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, session_id: sessionId },
      direction: params.direction ?? "asc",
    });
  }

  /** All breaks for a daily attendance record (oldest first). */
  listByAttendance(
    attendanceId: string,
    params: ListParams<BreakSession> = {},
  ): Promise<BreakSession[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, attendance_id: attendanceId },
      direction: params.direction ?? "asc",
    });
  }
}

/** Shared singleton — import this, not the class. */
export const breakSessionsService = new BreakSessionsService();
