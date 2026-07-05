import type { EodDraft, EodSubmission } from "@/features/eod/types";
import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";

/** Persisted report row — an {@link EodSubmission} plus its owning keys. */
export type EodReportRow = EodSubmission & {
  userId: string;
  sessionId: string;
};
export type EodReportInsert = EodDraft & {
  userId: string;
  sessionId: string;
  workDate: string;
};
export type EodReportUpdate = Partial<EodDraft>;

/**
 * ReportsService — daily / end-of-day reports.
 *
 * One report per work session. Maps onto the future `eod_reports` table (RPCs
 * `submit_eod_report`, `update_eod_report`, `get_session_eod`). Generic CRUD is
 * inherited; the methods below express the report-specific access patterns.
 */
export class ReportsService extends BaseService<EodReportRow, EodReportInsert, EodReportUpdate> {
  protected readonly table = "eod_reports";
  protected readonly entity = "EOD report";
  protected readonly defaultOrderBy = "workDate";

  /** Submit the report for a work session. */
  submit(report: EodReportInsert): Promise<EodReportRow> {
    return this.create(report);
  }

  /** The report attached to a work session, if any. */
  async getBySession(sessionId: string): Promise<EodReportRow | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("sessionId", sessionId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as EodReportRow | null) ?? null;
  }

  /** Reports filed by a user (most recent first). */
  listByUser(userId: string, params: ListParams<EodReportRow> = {}): Promise<EodReportRow[]> {
    return this.list({ ...params, filters: { ...params.filters, userId } });
  }

  /** Reports for a specific work date (manager/HR roll-up). */
  listByDate(workDate: string, params: ListParams<EodReportRow> = {}): Promise<EodReportRow[]> {
    return this.list({ ...params, filters: { ...params.filters, workDate } });
  }
}

/** Shared singleton — import this, not the class. */
export const reportsService = new ReportsService();
