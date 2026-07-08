/**
 * Project-execution domain types for the migration-`20260630150000` tables
 * (`projects`, `project_roles`, `project_members`, `milestones`, `epics`,
 * `project_activity`, `project_calendar_events`, `project_risks`).
 *
 * Snake-case row shapes matching the SQL schema. These tables are not yet in the
 * generated `Database` types, so the services talk to the relaxed `db` client.
 * The status/health enums are reused from `features/projects/types` to stay
 * single-sourced with the UI.
 */
import type { ProjectHealth, ProjectStatus } from "@/features/projects/types";

export type { ProjectHealth, ProjectStatus };

export type PriorityLevel = "low" | "medium" | "high" | "critical";
export type MilestoneStatus = "upcoming" | "in_progress" | "done" | "missed";
export type RiskStatus = "open" | "mitigating" | "resolved" | "accepted" | "closed";
export type CalendarEventType =
  | "meeting"
  | "deadline"
  | "release"
  | "review"
  | "kickoff"
  | "holiday"
  | "other";
export type ProjectActivityType =
  | "project_created"
  | "status_changed"
  | "health_changed"
  | "member_added"
  | "member_removed"
  | "milestone_created"
  | "milestone_reached"
  | "epic_created"
  | "risk_raised"
  | "risk_resolved"
  | "event_created"
  | "file_uploaded"
  | "report_filed"
  | "comment_added"
  | "other";

// ── projects ────────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  manager_id: string;
  department_id: string | null;
  team_id: string | null;
  priority: PriorityLevel;
  status: ProjectStatus;
  health: ProjectHealth;
  start_date: string | null;
  end_date: string | null;
  color: string | null;
  icon: string | null;
  repository_url: string | null;
  figma_url: string | null;
  api_docs_url: string | null;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type ProjectInsert = Pick<ProjectRow, "key" | "name" | "manager_id"> &
  // `id` is optional: callers may supply a client-generated UUID so an optimistic
  // row and its persisted row share one stable id (no post-insert id swap).
  Partial<Omit<ProjectRow, "key" | "name" | "manager_id" | "created_at" | "updated_at">>;
export type ProjectUpdate = Partial<Omit<ProjectRow, "id" | "created_at" | "updated_at">>;

// ── project_roles (reference catalog) ───────────────────────────────────────

export interface ProjectRoleRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rank: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type ProjectRoleInsert = Pick<ProjectRoleRow, "name" | "slug"> &
  Partial<Omit<ProjectRoleRow, "id" | "name" | "slug" | "created_at" | "updated_at">>;
export type ProjectRoleUpdate = Partial<Omit<ProjectRoleRow, "id" | "created_at" | "updated_at">>;

// ── project_members ─────────────────────────────────────────────────────────

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  project_role_id: string | null;
  added_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type ProjectMemberInsert = Pick<ProjectMemberRow, "project_id" | "user_id"> &
  Partial<Omit<ProjectMemberRow, "id" | "project_id" | "user_id" | "created_at" | "updated_at">>;
export type ProjectMemberUpdate = Partial<Pick<ProjectMemberRow, "project_role_id" | "updated_by">>;

// ── milestones ──────────────────────────────────────────────────────────────

export interface MilestoneRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  progress: number;
  owner_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type MilestoneInsert = Pick<MilestoneRow, "project_id" | "name"> &
  Partial<Omit<MilestoneRow, "id" | "project_id" | "name" | "created_at" | "updated_at">>;
export type MilestoneUpdate = Partial<
  Omit<MilestoneRow, "id" | "project_id" | "created_at" | "updated_at">
>;

// ── epics ───────────────────────────────────────────────────────────────────

export interface EpicRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string | null;
  owner_id: string | null;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type EpicInsert = Pick<EpicRow, "project_id" | "name"> &
  Partial<Omit<EpicRow, "id" | "project_id" | "name" | "created_at" | "updated_at">>;
export type EpicUpdate = Partial<Omit<EpicRow, "id" | "project_id" | "created_at" | "updated_at">>;

// ── project_activity (append-only) ──────────────────────────────────────────

export interface ProjectActivityRow {
  id: string;
  project_id: string;
  actor_id: string | null;
  type: ProjectActivityType;
  summary: string;
  meta: Record<string, unknown>;
  created_at: string;
}
export type ProjectActivityInsert = Pick<ProjectActivityRow, "project_id" | "type" | "summary"> &
  Partial<Pick<ProjectActivityRow, "actor_id" | "meta">>;

// ── project_calendar_events ─────────────────────────────────────────────────

export interface ProjectCalendarEventRow {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type ProjectCalendarEventInsert = Pick<
  ProjectCalendarEventRow,
  "project_id" | "title" | "starts_at"
> &
  Partial<
    Omit<
      ProjectCalendarEventRow,
      "id" | "project_id" | "title" | "starts_at" | "created_at" | "updated_at"
    >
  >;
export type ProjectCalendarEventUpdate = Partial<
  Omit<ProjectCalendarEventRow, "id" | "project_id" | "created_at" | "updated_at">
>;

// ── project_risks ───────────────────────────────────────────────────────────

export interface ProjectRiskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: PriorityLevel;
  likelihood: PriorityLevel;
  status: RiskStatus;
  owner_id: string | null;
  mitigation: string | null;
  milestone_id: string | null;
  related_dependency_id: string | null;
  due_date: string | null;
  resolved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export type ProjectRiskInsert = Pick<ProjectRiskRow, "project_id" | "title"> &
  Partial<Omit<ProjectRiskRow, "id" | "project_id" | "title" | "created_at" | "updated_at">>;
export type ProjectRiskUpdate = Partial<
  Omit<ProjectRiskRow, "id" | "project_id" | "created_at" | "updated_at">
>;
