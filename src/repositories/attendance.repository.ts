import type {
  CompanySettings,
  TodaySession,
  WorkSessionBreakRow,
  WorkSessionRow,
} from "@/features/attendance/types";
import type { HistoryFilters, HistoryPage, TeammateToday } from "@/features/attendance/api";
import { AttendanceService, attendanceService } from "@/services/attendance";

/**
 * AttendanceRepository — domain operations for work sessions, breaks and team
 * presence. Delegates to {@link AttendanceService}; the session lifecycle is
 * RPC-backed server-side so business rules stay single-sourced.
 */
export class AttendanceRepository {
  constructor(private readonly service: AttendanceService = attendanceService) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────

  clockIn(): Promise<WorkSessionRow> {
    return this.service.clockIn();
  }

  clockOut(): Promise<WorkSessionRow> {
    return this.service.clockOut();
  }

  startBreak(): Promise<WorkSessionBreakRow> {
    return this.service.startBreak();
  }

  endBreak(): Promise<WorkSessionBreakRow> {
    return this.service.endBreak();
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  getCurrentWorkDate(): Promise<string> {
    return this.service.getCurrentWorkDate();
  }

  getTodaySession(userId: string): Promise<TodaySession> {
    return this.service.getTodaySession(userId);
  }

  getHistory(userId: string, filters: HistoryFilters): Promise<HistoryPage> {
    return this.service.getHistory(userId, filters);
  }

  getTeamToday(): Promise<TeammateToday[]> {
    return this.service.getTeamToday();
  }

  /** Everyone's work sessions for a given work date (manager / HR roll-up). */
  listByDate(workDate: string): Promise<WorkSessionRow[]> {
    return this.service.listByDate(workDate);
  }

  getCompanySettings(): Promise<CompanySettings> {
    return this.service.getCompanySettings();
  }
}

/** Shared singleton — import this, not the class. */
export const attendanceRepository = new AttendanceRepository();
