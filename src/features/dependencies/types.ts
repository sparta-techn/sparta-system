export const DEPENDENCY_STATES = [
  "draft",
  "pending",
  "accepted",
  "in_progress",
  "blocked",
  "resolved",
  "rejected",
  "cancelled",
  "closed",
] as const;
export type DependencyState = (typeof DEPENDENCY_STATES)[number];

export const DEPENDENCY_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type DependencyPriority = (typeof DEPENDENCY_PRIORITIES)[number];

export const DEPENDENCY_TYPES = [
  "backend_api",
  "ui_design",
  "frontend",
  "qa",
  "devops",
  "database",
  "content",
  "product_decision",
  "client_feedback",
  "bug_fix",
  "infrastructure",
  "security",
  "other",
] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const KANBAN_COLUMNS: DependencyState[] = [
  "pending",
  "accepted",
  "in_progress",
  "blocked",
  "resolved",
  "closed",
];

export interface Person {
  id: string;
  name: string;
  avatarColor: string; // hsl-friendly token
  role: string;
  department: string;
}

export interface DependencyComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string; // ISO
  parentId?: string | null;
  mentions?: string[]; // person ids
  isStatusUpdate?: boolean;
}

export type ActivityKind =
  | "created"
  | "accepted"
  | "status_changed"
  | "priority_changed"
  | "comment_added"
  | "assigned"
  | "resolved"
  | "closed"
  | "rejected"
  | "cancelled";

export interface DependencyActivity {
  id: string;
  kind: ActivityKind;
  actorId: string;
  at: string;
  meta?: Record<string, string>;
}

export interface Dependency {
  id: string;
  title: string;
  description: string;
  type: DependencyType;
  priority: DependencyPriority;
  state: DependencyState;
  requesterId: string;
  ownerId: string | null;
  department: string;
  project: string;
  relatedTaskRef?: string | null; // future ClickUp ref
  tags: string[];
  attachments: { id: string; name: string; size: string }[];
  createdAt: string;
  updatedAt: string;
  dueAt?: string | null;
  resolvedAt?: string | null;
  comments: DependencyComment[];
  activity: DependencyActivity[];
}

export const TYPE_LABEL: Record<DependencyType, string> = {
  backend_api: "Backend API",
  ui_design: "UI Design",
  frontend: "Frontend",
  qa: "QA",
  devops: "DevOps",
  database: "Database",
  content: "Content",
  product_decision: "Product Decision",
  client_feedback: "Client Feedback",
  bug_fix: "Bug Fix",
  infrastructure: "Infrastructure",
  security: "Security",
  other: "Other",
};

export const STATE_LABEL: Record<DependencyState, string> = {
  draft: "Draft",
  pending: "Pending",
  accepted: "Accepted",
  in_progress: "In progress",
  blocked: "Blocked",
  resolved: "Resolved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const PRIORITY_LABEL: Record<DependencyPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const STATE_TONE: Record<
  DependencyState,
  "neutral" | "warning" | "info" | "primary" | "success" | "danger"
> = {
  draft: "neutral",
  pending: "warning",
  accepted: "info",
  in_progress: "primary",
  blocked: "danger",
  resolved: "success",
  rejected: "danger",
  cancelled: "neutral",
  closed: "neutral",
};

export const PRIORITY_TONE: Record<
  DependencyPriority,
  "neutral" | "info" | "warning" | "danger"
> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};
