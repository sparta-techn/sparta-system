/**
 * Daily-reports domain types for the `daily_reports`, `daily_status_updates`
 * and `dependency_requests` tables (migration 20260630130000). The variable
 * report sections reuse the feature element types so the service layer and the
 * UI stay single-sourced; the DB stores them as jsonb.
 */
import type { BlockerItem, HelpRequest, Mood, PriorityItem } from "@/features/checkin/types";
import type { EndOfDayOutlook, TaskProgressEntry } from "@/features/midday/types";
import type {
  DailyReflection,
  InProgressItem,
  NeedFromOthersItem,
  OpenDependencyEntry,
  TomorrowPlan,
} from "@/features/eod/types";
import type {
  DependencyPriority,
  DependencyState,
  DependencyType,
} from "@/features/dependencies/types";

export type DailyReportStatus = "draft" | "submitted" | "reviewed";
export type StatusUpdateKind = "morning_checkin" | "midday" | "custom";

// ── report_reviews (manager review decision + comment trail) ────────────────
export type ReportReviewDecision = "approved" | "rejected";
export type ReportReviewSubject = "daily_report" | "status_update";

export type { DependencyState, DependencyType, DependencyPriority };

// ── daily_reports (end-of-day) ──────────────────────────────────────────────

export interface DailyReportRow {
  id: string;
  user_id: string;
  work_date: string;
  attendance_id: string | null;
  session_id: string | null;
  status: DailyReportStatus;
  summary: string | null;
  completed: TaskProgressEntry[];
  in_progress: InProgressItem[];
  open_dependencies: OpenDependencyEntry[];
  need_from_others: NeedFromOthersItem[];
  tomorrow_plan: TomorrowPlan | Record<string, never>;
  reflection: DailyReflection;
  session_summary: Record<string, unknown>;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyReportInsert = Pick<DailyReportRow, "user_id" | "work_date"> &
  Partial<Omit<DailyReportRow, "id" | "user_id" | "work_date" | "created_at" | "updated_at">>;

export type DailyReportUpdate = Partial<
  Omit<DailyReportRow, "id" | "user_id" | "work_date" | "created_at" | "updated_at">
>;

// ── daily_status_updates (morning check-in / midday pulse) ──────────────────

export interface StatusUpdateRow {
  id: string;
  user_id: string;
  work_date: string;
  attendance_id: string | null;
  kind: StatusUpdateKind;
  mood: Mood | null;
  mood_note: string | null;
  main_goal: string | null;
  progress: number | null;
  current_focus: string | null;
  outlook: EndOfDayOutlook | null;
  priorities: PriorityItem[];
  task_progress: TaskProgressEntry[];
  blockers: BlockerItem[];
  help_request: HelpRequest | Record<string, never>;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StatusUpdateInsert = Pick<StatusUpdateRow, "user_id" | "work_date"> & {
  kind?: StatusUpdateKind;
} & Partial<
    Omit<StatusUpdateRow, "id" | "user_id" | "work_date" | "kind" | "created_at" | "updated_at">
  >;

export type StatusUpdateUpdate = Partial<
  Omit<StatusUpdateRow, "id" | "user_id" | "work_date" | "kind" | "created_at" | "updated_at">
>;

// ── report_reviews (append-only manager review trail) ───────────────────────

export interface ReportReviewRow {
  id: string;
  subject_type: ReportReviewSubject;
  subject_id: string;
  subject_owner: string;
  reviewer_id: string | null;
  decision: ReportReviewDecision;
  comment: string | null;
  created_at: string;
}

export type ReportReviewInsert = Pick<
  ReportReviewRow,
  "subject_type" | "subject_id" | "subject_owner" | "decision"
> &
  Partial<Pick<ReportReviewRow, "reviewer_id" | "comment">>;

// ── dependency_requests (cross-team request / blocker) ──────────────────────

export interface DependencyRequestRow {
  id: string;
  title: string;
  description: string | null;
  type: DependencyType;
  priority: DependencyPriority;
  state: DependencyState;
  requester_id: string;
  owner_id: string | null;
  department_id: string | null;
  related_task_id: string | null;
  tags: string[];
  due_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DependencyRequestInsert = Pick<DependencyRequestRow, "title" | "requester_id"> &
  Partial<
    Omit<DependencyRequestRow, "id" | "title" | "requester_id" | "created_at" | "updated_at">
  >;

export type DependencyRequestUpdate = Partial<
  Omit<DependencyRequestRow, "id" | "requester_id" | "created_at" | "updated_at">
>;
