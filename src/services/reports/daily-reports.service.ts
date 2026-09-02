import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import { resolveSubmissionMode } from "./rules";
import type {
  DailyReportInsert,
  DailyReportRow,
  DailyReportStatus,
  DailyReportUpdate,
} from "./types";

/** Narrowing options for {@link DailyReportsService.listInRange}. */
export interface DailyReportRangeOptions {
  /** Restrict to one employee's reports (omit for everyone the caller may see). */
  userId?: string;
  /** Restrict to a lifecycle status — `"submitted"` excludes drafts. */
  status?: DailyReportStatus;
}

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

  /**
   * Reports whose `work_date` falls within `[from, to]` (inclusive,
   * `YYYY-MM-DD`), most recent first — the read behind the reports export and
   * period roll-ups. Optionally narrowed to one employee and/or a status; RLS
   * still scopes which rows the caller may see.
   */
  async listInRange(
    from: string,
    to: string,
    options: DailyReportRangeOptions = {},
  ): Promise<DailyReportRow[]> {
    try {
      let query = this.client
        .from(this.table)
        .select("*")
        .gte("work_date", from)
        .lte("work_date", to);
      if (options.userId) query = query.eq("user_id", options.userId);
      if (options.status) query = query.eq("status", options.status);

      const { data, error } = await query.order("work_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyReportRow[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /**
   * Submitted reports across the team, most recent work date first — the manager
   * review queue. RLS scopes the rows a reviewer may see.
   */
  listSubmitted(params: ListParams<DailyReportRow> = {}): Promise<DailyReportRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, status: "submitted" },
      orderBy: params.orderBy ?? "work_date",
      direction: params.direction ?? "desc",
    });
  }
}

/** Shared singleton — import this, not the class. */
export const dailyReportsService = new DailyReportsService();
