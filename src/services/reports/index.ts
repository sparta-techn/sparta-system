// Legacy service over the `eod_reports` table.
export { ReportsService, reportsService } from "./reports.service";
export type { EodReportRow, EodReportInsert, EodReportUpdate } from "./reports.service";

// Services over the `daily_reports` / `daily_status_updates` /
// `dependency_requests` tables (migration 20260630130000).
export { DailyReportsService, dailyReportsService } from "./daily-reports.service";
export { StatusUpdatesService, statusUpdatesService } from "./status-updates.service";
export { ReportReviewsService, reportReviewsService } from "./report-reviews.service";
export {
  DependencyRequestsService,
  dependencyRequestsService,
} from "./dependency-requests.service";

export type {
  DailyReportRow,
  DailyReportInsert,
  DailyReportUpdate,
  DailyReportStatus,
  StatusUpdateRow,
  StatusUpdateInsert,
  StatusUpdateUpdate,
  StatusUpdateKind,
  ReportReviewRow,
  ReportReviewInsert,
  ReportReviewDecision,
  ReportReviewSubject,
  DependencyRequestRow,
  DependencyRequestInsert,
  DependencyRequestUpdate,
  DependencyState,
  DependencyType,
  DependencyPriority,
} from "./types";
