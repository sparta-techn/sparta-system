import type { ReportReviewRow, ReportReviewSubject } from "@/services/reports";

/** Which daily artefact a queue row represents. */
export type ReportKind = "eod" | "morning_checkin" | "midday";

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  eod: "End-of-day",
  morning_checkin: "Morning check-in",
  midday: "Midday status",
};

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
  /** Newest review for this subject, or `null` when still pending. */
  latestReview: ReportReviewRow | null;
}
