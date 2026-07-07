import type { ListParams } from "@/services/core";
import {
  DailyReportsService,
  dailyReportsService,
  type DailyReportInsert,
  type DailyReportRow,
  type DailyReportUpdate,
} from "@/services/reports";

/**
 * DailyReportRepository — End-of-Day reports over `public.daily_reports`
 * (migration 20260630130000). Delegates to {@link DailyReportsService}; one
 * report per `(user_id, work_date)`.
 *
 * NOTE: distinct from the legacy `ReportRepository`
 * (`src/repositories/report.repository.ts`) over `eod_reports`.
 */
export class DailyReportRepository {
  constructor(private readonly service: DailyReportsService = dailyReportsService) {}

  /** Submit (or re-submit) the End-of-Day report for a work date. */
  submit(report: DailyReportInsert): Promise<DailyReportRow> {
    return this.service.submit(report);
  }

  /** Patch an existing report (e.g. save a draft, manager review fields). */
  update(id: string, patch: DailyReportUpdate): Promise<DailyReportRow> {
    return this.service.update(id, patch);
  }

  getById(id: string): Promise<DailyReportRow | null> {
    return this.service.getById(id);
  }

  /** The report for a user on a work date, if any. */
  getByDate(userId: string, workDate: string): Promise<DailyReportRow | null> {
    return this.service.getByDate(userId, workDate);
  }

  /** The report attached to a work session, if any. */
  getBySession(sessionId: string): Promise<DailyReportRow | null> {
    return this.service.getBySession(sessionId);
  }

  /** Reports filed by a user (most recent first). */
  listByUser(userId: string, params: ListParams<DailyReportRow> = {}): Promise<DailyReportRow[]> {
    return this.service.listByUser(userId, params);
  }

  /** All reports for a work date (manager / HR roll-up). */
  listByDate(workDate: string, params: ListParams<DailyReportRow> = {}): Promise<DailyReportRow[]> {
    return this.service.listByDate(workDate, params);
  }

  /** Submitted reports across the team (manager review queue). */
  listSubmitted(params: ListParams<DailyReportRow> = {}): Promise<DailyReportRow[]> {
    return this.service.listSubmitted(params);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const dailyReportRepository = new DailyReportRepository();
