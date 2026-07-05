import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import { resolveSubmissionMode } from "./rules";
import type { DailyReportInsert, DailyReportRow, DailyReportUpdate } from "./types";

/**
 * DailyReportsService — end-of-day reports (`public.daily_reports`).
 *
 * One report per `(user_id, work_date)`. `submit` is idempotent: it updates the
 * day's report if one already exists, otherwise creates it, stamping
 * `status='submitted'` + `submitted_at`.
 *
 * Distinct from the legacy {@link ReportsService} (over `eod_reports`); this one
 * targets the `daily_reports` table from migration 20260630130000.
 */
export class DailyReportsService extends BaseService<
  DailyReportRow,
  DailyReportInsert,
  DailyReportUpdate
> {
  protected readonly table = "daily_reports";
  protected readonly entity = "Daily report";
  protected readonly defaultOrderBy = "work_date";

  /** The report for a user on a work date, or `null`. */
  async getByDate(userId: string, workDate: string): Promise<DailyReportRow | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("user_id", userId)
        .eq("work_date", workDate)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DailyReportRow | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** The report attached to a work session, if any. */
  async getBySession(sessionId: string): Promise<DailyReportRow | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DailyReportRow | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Submit (or re-submit) the report for a work date — one per `(user, date)`. */
  async submit(input: DailyReportInsert): Promise<DailyReportRow> {
    const existing = await this.getByDate(input.user_id, input.work_date);
    const payload = {
      ...input,
      status: "submitted" as const,
      submitted_at: new Date().toISOString(),
    };
    return resolveSubmissionMode(existing) === "update"
      ? this.update(existing!.id, payload)
      : this.create(payload);
  }

  /** Reports filed by a user (most recent first). */
  listByUser(userId: string, params: ListParams<DailyReportRow> = {}): Promise<DailyReportRow[]> {
    return this.list({ ...params, filters: { ...params.filters, user_id: userId } });
  }

  /** All reports for a work date (manager / HR roll-up). */
  listByDate(workDate: string, params: ListParams<DailyReportRow> = {}): Promise<DailyReportRow[]> {
    return this.list({ ...params, filters: { ...params.filters, work_date: workDate } });
  }
}

/** Shared singleton — import this, not the class. */
export const dailyReportsService = new DailyReportsService();
