/**
 * Executive Alert Engine — types.
 *
 * The engine is pure: rules evaluate typed input snapshots and emit {@link Alert}
 * candidates. Lifecycle (dismiss / archive / history) is layered on top by the
 * store in `features/executive/alerts`. Input shapes carry display fields (name /
 * title) because an alert must name its subject and deep-link to it; enums are
 * reused from the KPI service to stay consistent.
 */
import type { ProjectHealthLite, ProjectStatusLite, SprintStatusLite } from "@/services/kpi";

// ── Alert taxonomy ───────────────────────────────────────────────────────────

export const ALERT_TYPES = [
  "project_overdue",
  "sprint_delayed",
  "employee_missing_reports",
  "attendance_anomaly",
  "high_workload",
  "critical_blocker",
  "ai_risk",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/** Impact of the condition. */
export type AlertSeverity = "critical" | "high" | "medium" | "low";

/** Urgency rank for triage (derived from severity + type). */
export type AlertPriority = "urgent" | "high" | "normal" | "low";

/** Lifecycle state held by the store. */
export type AlertState = "active" | "dismissed" | "archived";

export type AlertCategory = "project" | "engineering" | "hr" | "attendance" | "reports" | "ai";

/** A generated alert (stateless — lifecycle lives in the store). */
export interface Alert {
  /** Stable dedupe id: `${type}:${entityId}` — re-raising updates, never duplicates. */
  id: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  description: string;
  severity: AlertSeverity;
  priority: AlertPriority;
  /** Deep-link target for the owning module. */
  entityType: string | null;
  entityId: string | null;
  /** Short quantitative evidence line (e.g. "12 days overdue"). */
  evidence?: string;
  /** ISO time the condition was evaluated. */
  raisedAt: string;
}

// ── Rank helpers (higher = more urgent) ──────────────────────────────────────

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const PRIORITY_RANK: Record<AlertPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/** Default urgency for a given severity; rules may escalate. */
export function priorityForSeverity(severity: AlertSeverity): AlertPriority {
  switch (severity) {
    case "critical":
      return "urgent";
    case "high":
      return "high";
    case "medium":
      return "normal";
    default:
      return "low";
  }
}

// ── Rule inputs ──────────────────────────────────────────────────────────────

export interface ProjectAlertInput {
  id: string;
  name: string;
  status: ProjectStatusLite;
  health: ProjectHealthLite;
  endDate: string;
  completedAt?: string | null;
  progress: number;
}

export interface SprintAlertInput {
  id: string;
  name: string;
  status: SprintStatusLite;
  endDate: string;
  totalTasks: number;
  doneTasks: number;
}

export interface ReportComplianceInput {
  userId: string;
  name: string;
  /** Was the person expected to file today. */
  expected: boolean;
  /** Missing report slots today (0–3: check-in / midday / EoD). */
  missingReports: number;
  /** Consecutive recent days with at least one missed report. */
  missedDays?: number;
}

export interface AttendanceAnomalyInput {
  userId: string;
  name: string;
  /** Late arrivals over the window. */
  lateCount: number;
  /** Absences over the window. */
  absentCount: number;
  windowDays: number;
}

export interface WorkloadAlertInput {
  assigneeId: string;
  name: string;
  openTasks: number;
  activeSprintTasks?: number;
}

export type BlockerPriority = "low" | "medium" | "high" | "critical";

export interface BlockerAlertInput {
  id: string;
  title: string;
  projectName?: string;
  priority: BlockerPriority;
  /** How long the blocker has been open, in days. */
  ageDays: number;
  /** Whether it is blocking other work. */
  isBlocking?: boolean;
}

export interface AiRiskInput {
  id: string;
  title: string;
  severity: AlertSeverity;
  area: AlertCategory;
  evidence?: string;
}

/** Tunable thresholds; every field has a default (see `DEFAULT_THRESHOLDS`). */
export interface AlertThresholds {
  /** Missing report slots that raises an alert. */
  missingReportsMin: number;
  /** Late count over the window that raises an anomaly. */
  attendanceLateMin: number;
  /** Absence count over the window that raises an anomaly. */
  attendanceAbsentMin: number;
  /** Open tasks per person that counts as high workload. */
  highWorkloadTasks: number;
  /** Blocker age (days) that escalates a high-priority blocker. */
  blockerAgeDays: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  missingReportsMin: 2,
  attendanceLateMin: 3,
  attendanceAbsentMin: 2,
  highWorkloadTasks: 12,
  blockerAgeDays: 2,
};

export interface AlertEngineInput {
  projects?: ProjectAlertInput[];
  sprints?: SprintAlertInput[];
  reports?: ReportComplianceInput[];
  attendance?: AttendanceAnomalyInput[];
  workload?: WorkloadAlertInput[];
  blockers?: BlockerAlertInput[];
  aiRisks?: AiRiskInput[];
  /** Evaluation instant; defaults to now. Injected for deterministic tests. */
  now?: Date;
  thresholds?: Partial<AlertThresholds>;
}
