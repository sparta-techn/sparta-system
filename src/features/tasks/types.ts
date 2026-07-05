/**
 * Tasks & Subtasks — types and enums.
 *
 * Designed to map 1:1 onto future Supabase tables `tasks`, `task_checklists`,
 * `task_watchers`, `task_relations`, `saved_filters`, `task_favorites`.
 * Subtasks are not a separate entity — they are `tasks` with a non-null
 * `parentTaskId`, so the tree can nest indefinitely.
 */

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "qa",
  "done",
  "blocked",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type TaskLabel =
  | "bug"
  | "feature"
  | "chore"
  | "spike"
  | "research"
  | "docs"
  | "design"
  | "tech-debt"
  | "security"
  | "perf";

export const TASK_LABELS: TaskLabel[] = [
  "bug",
  "feature",
  "chore",
  "spike",
  "research",
  "docs",
  "design",
  "tech-debt",
  "security",
  "perf",
];

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string | null;
  dueAt?: string | null;
}

export interface TaskAttachment {
  id: string;
  name: string;
  sizeKb: number;
  kind: "doc" | "image" | "design" | "spec" | "video" | "other";
  uploadedBy: string;
  uploadedAt: string;
}

export type TaskActivityKind =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "due_date_changed"
  | "comment_added"
  | "checklist_updated"
  | "subtask_added"
  | "linked_dependency"
  | "archived"
  | "restored"
  | "duplicated";

export interface TaskActivity {
  id: string;
  taskId: string;
  at: string;
  actorId: string;
  kind: TaskActivityKind;
  summary: string;
  meta?: Record<string, string | number | null>;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

/**
 * Epic — large container under a project. Mock-only for this slice.
 */
export interface Epic {
  id: string;
  projectId: string;
  name: string;
  color: string;
  ownerId: string;
}

/**
 * Milestone — date-bound delivery checkpoint, mock-only for this slice.
 * (Distinct from `features/projects/Milestone` — tasks reference these.)
 */
export interface TaskMilestone {
  id: string;
  projectId: string;
  name: string;
  dueDate: string;
}

export interface Task {
  id: string;
  /** Short human ref e.g. `ETB-142`. Derived from project key + counter. */
  ref: string;
  title: string;
  /** Rich-text body — plain markdown string for now. */
  description: string;

  status: TaskStatus;
  priority: TaskPriority;
  labels: TaskLabel[];

  projectId: string;
  epicId: string | null;
  milestoneId: string | null;
  /** Sprint relation is future work — string id placeholder. */
  sprintId: string | null;

  assigneeId: string | null;
  reporterId: string;
  watcherIds: string[];

  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  storyPoints: number | null;

  checklist: ChecklistItem[];
  attachments: TaskAttachment[];

  /** ids of related Dependency rows (cross-feature, weak reference). */
  relatedDependencyIds: string[];
  /** Parent task id when this row is a subtask. Null for top-level tasks. */
  parentTaskId: string | null;
  /** Cross-task links (blocks / is blocked by / relates to). */
  relations: TaskRelation[];

  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  /** Soft delete. UI hides unless restored from trash. */
  deletedAt: string | null;
}

export type TaskRelationKind = "blocks" | "blocked_by" | "relates_to" | "duplicates";

export interface TaskRelation {
  id: string;
  kind: TaskRelationKind;
  /** Other task id. */
  taskId: string;
}

// ---------- Filters & saved views ----------

export interface TaskFilters {
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  labels?: TaskLabel[];
  projectIds?: string[];
  epicIds?: string[];
  milestoneIds?: string[];
  assigneeIds?: string[];
  reporterIds?: string[];
  watcherIds?: string[];
  overdueOnly?: boolean;
  unassignedOnly?: boolean;
  hasSubtasks?: boolean;
  /** Only top-level tasks (parentTaskId === null). */
  topLevelOnly?: boolean;
  includeArchived?: boolean;
}

export type TaskSortKey =
  | "updated"
  | "created"
  | "priority"
  | "due"
  | "status"
  | "title";

export interface TaskSort {
  key: TaskSortKey;
  direction: "asc" | "desc";
}

export interface SavedFilter {
  id: string;
  name: string;
  /** When true, surfaced as a quick pill above the list. */
  pinned: boolean;
  filters: TaskFilters;
  sort?: TaskSort;
  createdBy: string;
  createdAt: string;
}

// ---------- Display metadata ----------

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  qa: "QA",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<
  TaskStatus,
  "neutral" | "info" | "primary" | "warning" | "success" | "danger"
> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "primary",
  review: "info",
  qa: "info",
  done: "success",
  blocked: "danger",
  cancelled: "neutral",
};

export const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "qa",
  "done",
  "blocked",
  "cancelled",
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_TONE: Record<
  TaskPriority,
  "neutral" | "info" | "warning" | "danger"
> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const LABEL_TONE: Record<
  TaskLabel,
  "neutral" | "info" | "primary" | "warning" | "success" | "danger"
> = {
  bug: "danger",
  feature: "primary",
  chore: "neutral",
  spike: "info",
  research: "info",
  docs: "neutral",
  design: "primary",
  "tech-debt": "warning",
  security: "danger",
  perf: "warning",
};

export type TasksView = "list" | "table" | "cards";
