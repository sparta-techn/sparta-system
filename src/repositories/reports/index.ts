/**
 * Reports repository layer (new schema).
 *
 * Domain-facing data API over the daily-reports services
 * (`daily_reports`, `daily_status_updates`, `dependency_requests` — migration
 * 20260630130000). Import the singletons from `@/repositories/reports`.
 *
 * NOTE: intentionally NOT re-exported from the root `@/repositories` barrel —
 * the root `ReportRepository` (over the legacy `eod_reports` table) keeps its
 * place there. Same convention as `@/repositories/hr`.
 *
 *   Morning Check-in / Midday Status → {@link StatusUpdateRepository}
 *   End-of-Day Report               → {@link DailyReportRepository}
 *   Dependency Requests             → {@link DependencyRequestRepository}
 */
export { DailyReportRepository, dailyReportRepository } from "./daily-report.repository";
export { ReportReviewRepository, reportReviewRepository } from "./report-review.repository";
export {
  StatusUpdateRepository,
  statusUpdateRepository,
  type StatusUpdatePayload,
} from "./status-update.repository";
export { DependencyRequestRepository, dependencyRequestRepository } from "./dependency.repository";
