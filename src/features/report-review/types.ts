import type {
  ReportReviewDecision,
  ReportReviewRow,
  ReportReviewSubject,
} from "@/services/reports";

/** Which daily artefact a queue row represents. */
export type ReportKind = "eod" | "morning_checkin" | "midday";

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  eod: "End-of-day",
  morning_checkin: "Morning check-in",
  midday: "Midday status",
};

/** One labelled section of a report's full body, shown in the detail view. */
export interface ReviewDetailSection {
  label: string;
  /** Full, untruncated text; may contain newlines for multi-line sections. */
  body: string;
}

/** One manager decision from a subject's review trail (newest first). */
export interface ReviewHistoryEntry {
  id: string;
  decision: ReportReviewDecision;
  comment: string | null;
  /** Resolved reviewer display name (falls back to "Unknown"). */
  reviewerName: string;
  createdAt: string;
}

/** One submitted report awaiting (or carrying) a manager review decision. */
export interface ReviewQueueItem {
  subjectType: ReportReviewSubject;
  subjectId: string;
  ownerId: string;
  ownerName: string;
  workDate: string;
  submittedAt: string | null;
  kind: ReportKind;
  /** One-line snippet of the report body for the queue row. */
  summary: string;
  /** Full, untruncated report body split into labelled sections for the detail view. */
  detail: ReviewDetailSection[];
  /** Newest review for this subject, or `null` when still pending. */
  latestReview: ReportReviewRow | null;
  /** Full manager review trail (newest first), reviewer names resolved. */
  reviews: ReviewHistoryEntry[];
}
