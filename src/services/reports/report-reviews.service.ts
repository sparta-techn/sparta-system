import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { ReportReviewInsert, ReportReviewRow, ReportReviewSubject } from "./types";

/**
 * ReportReviewsService — the **append-only** manager review trail
 * (`report_reviews`, migration 20260706140000).
 *
 * A reviewer files a decision (`approved` / `rejected`) + optional comment
 * against a submitted End-of-Day report or intraday status pulse. Rows are
 * immutable (SELECT / INSERT grants only): a correction is a new row and the
 * latest row for a subject is the current outcome. Update / remove are blocked
 * at the DB grant level, so they are intentionally not exposed here.
 */
export class ReportReviewsService extends BaseService<ReportReviewRow, ReportReviewInsert> {
  protected readonly table = "report_reviews";
  protected readonly entity = "Report review";
  protected readonly defaultOrderBy = "created_at";

  /** File a review. `reviewer_id` defaults to `auth.uid()` server-side. */
  submit(review: ReportReviewInsert): Promise<ReportReviewRow> {
    return this.create(review);
  }

  /** A subject's review trail, newest first (the head row is the outcome). */
  listForSubject(
    subjectType: ReportReviewSubject,
    subjectId: string,
    params: ListParams<ReportReviewRow> = {},
  ): Promise<ReportReviewRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, subject_type: subjectType, subject_id: subjectId },
      direction: params.direction ?? "desc",
    });
  }

  /**
   * Reviews for many subjects of one type in a single round-trip — lets the
   * queue resolve the current outcome for every visible report at once.
   */
  async listForSubjects(
    subjectType: ReportReviewSubject,
    subjectIds: string[],
  ): Promise<ReportReviewRow[]> {
    if (subjectIds.length === 0) return [];
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("subject_type", subjectType)
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as ReportReviewRow[]) ?? [];
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const reportReviewsService = new ReportReviewsService();
