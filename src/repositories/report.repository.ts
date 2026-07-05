import type { ListParams } from "@/services/core";
import {
  ReportsService,
  reportsService,
  type EodReportInsert,
  type EodReportRow,
  type EodReportUpdate,
} from "@/services/reports";

/**
 * ReportRepository — domain operations for daily / end-of-day reports. Delegates
 * to {@link ReportsService}. One report per work session.
 */
export class ReportRepository {
  constructor(private readonly service: ReportsService = reportsService) {}

  /** File the report for a work session. */
  submit(report: EodReportInsert): Promise<EodReportRow> {
    return this.service.submit(report);
  }

  /** Patch an existing report. */
  update(id: string, patch: EodReportUpdate): Promise<EodReportRow> {
    return this.service.update(id, patch);
  }

  getById(id: string): Promise<EodReportRow | null> {
    return this.service.getById(id);
  }

  /** The report attached to a work session, if any. */
  getBySession(sessionId: string): Promise<EodReportRow | null> {
    return this.service.getBySession(sessionId);
  }

  /** Reports filed by a user (most recent first). */
  listByUser(userId: string, params: ListParams<EodReportRow> = {}): Promise<EodReportRow[]> {
    return this.service.listByUser(userId, params);
  }

  /** All reports for a work date (manager / HR roll-up). */
  listByDate(workDate: string, params: ListParams<EodReportRow> = {}): Promise<EodReportRow[]> {
    return this.service.listByDate(workDate, params);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const reportRepository = new ReportRepository();
