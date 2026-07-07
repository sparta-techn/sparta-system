import {
  ReportReviewsService,
  reportReviewsService,
  type ReportReviewInsert,
  type ReportReviewRow,
  type ReportReviewSubject,
} from "@/services/reports";

/**
 * ReportReviewRepository — the manager review trail over `public.report_reviews`
 * (migration 20260706140000). Delegates to {@link ReportReviewsService}.
 *
 * Reviews are append-only: `submit` files a decision + comment; there is no
 * update/remove. The newest row for a subject is the current outcome.
 */
export class ReportReviewRepository {
  constructor(private readonly service: ReportReviewsService = reportReviewsService) {}

  /** File an approve/reject decision (+ optional comment) for a report. */
  submit(review: ReportReviewInsert): Promise<ReportReviewRow> {
    return this.service.submit(review);
  }

  /** A single subject's review trail, newest first. */
  listForSubject(subjectType: ReportReviewSubject, subjectId: string): Promise<ReportReviewRow[]> {
    return this.service.listForSubject(subjectType, subjectId);
  }

  /** Reviews for many subjects of one type in one round-trip. */
  listForSubjects(
    subjectType: ReportReviewSubject,
    subjectIds: string[],
  ): Promise<ReportReviewRow[]> {
    return this.service.listForSubjects(subjectType, subjectIds);
  }
}

/** Shared singleton — import this, not the class. */
export const reportReviewRepository = new ReportReviewRepository();
