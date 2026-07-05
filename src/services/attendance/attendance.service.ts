import {
  endBreak,
  finishWork,
  getAttendanceHistory,
  getCompanySettings,
  getCurrentWorkDate,
  getTeamToday,
  getTodaySession,
  startBreak,
  startWork,
  type HistoryFilters,
  type HistoryPage,
  type TeammateToday,
} from "@/features/attendance/api";
import type {
  CompanySettings,
  TodaySession,
  WorkSessionBreakRow,
  WorkSessionRow,
} from "@/features/attendance/types";
import { BaseService } from "../core/base-service";

type WorkSessionInsert = Partial<WorkSessionRow>;
type WorkSessionUpdate = Partial<WorkSessionRow>;

/**
 * AttendanceService — work sessions, breaks and team presence.
 *
 * Generic CRUD operates on `work_sessions`. The lifecycle transitions
 * (clock-in/out, break start/stop) are backed by Supabase RPCs and composed
 * from the existing, fully-typed `features/attendance/api` so business rules
 * (work-date rollover, status calculation) stay server-side and single-sourced.
 */
export class AttendanceService extends BaseService<
  WorkSessionRow,
  WorkSessionInsert,
  WorkSessionUpdate
> {
  protected readonly table = "work_sessions";
  protected readonly entity = "Work session";
  protected readonly defaultOrderBy = "work_date";

  // ── Session lifecycle (RPC-backed) ───────────────────────────────────────

  /** Clock in — opens today's work session. */
  clockIn(): Promise<WorkSessionRow> {
    return startWork();
  }

  /** Clock out — finalizes today's work session. */
  clockOut(): Promise<WorkSessionRow> {
    return finishWork();
  }

  /** Begin a break in the active session. */
  startBreak(): Promise<WorkSessionBreakRow> {
    return startBreak();
  }

  /** End the active break. */
  endBreak(): Promise<WorkSessionBreakRow> {
    return endBreak();
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** The current (server-defined) work date. */
  getCurrentWorkDate(): Promise<string> {
    return getCurrentWorkDate();
  }

  /** A user's session + breaks for the current work date. */
  getTodaySession(userId: string): Promise<TodaySession> {
    return getTodaySession(userId);
  }

  /** Paginated, filterable attendance history for a user. */
  getHistory(userId: string, filters: HistoryFilters): Promise<HistoryPage> {
    return getAttendanceHistory(userId, filters);
  }

  /** Everyone's sessions for the current work date (team presence grid). */
  getTeamToday(): Promise<TeammateToday[]> {
    return getTeamToday();
  }

  /** Company-wide attendance configuration. */
  getCompanySettings(): Promise<CompanySettings> {
    return getCompanySettings();
  }
}

/** Shared singleton — import this, not the class. */
export const attendanceService = new AttendanceService();
