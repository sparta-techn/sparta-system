/**
 * Executive KPI types — inputs, outputs, and the metric envelope.
 *
 * The KPI layer is deliberately decoupled from the heavy domain types
 * (`Project`, `Task`, `WorkSessionRow`, …). Calculators accept **minimal
 * structural snapshots** so they stay pure, dependency-light, and reusable from
 * anywhere (services, hooks, tests, or a future server function) regardless of
 * whether the data came from Supabase or a mock store.
 *
 * A concrete adapter (`kpi-adapters.ts`, out of scope for this slice) maps the
 * live rows / mock stores onto these snapshots; the calculators never change.
 */

// ── Metric envelope ──────────────────────────────────────────────────────────

export type KpiFormat = "number" | "percent" | "hours" | "points" | "minutes";

/** Which direction is "good" for a metric — drives colour/arrow in the UI. */
export type GoodDirection = "up" | "down";

export type KpiTrend = "up" | "down" | "flat";

/**
 * A single calculated KPI. `previous`/`delta`/`trend` are populated when a
 * prior-period value is supplied (benchmarking); otherwise only `value` is set.
 */
export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: KpiFormat;
  goodDirection: GoodDirection;
  /** Prior-period value when benchmarked. */
  previous?: number;
  /** `value - previous`. */
  delta?: number;
  /** Percent change vs. previous, rounded to 1dp. */
  deltaPct?: number;
  /** Direction of movement (independent of whether it is good). */
  trend?: KpiTrend;
}

// ── Company inputs ───────────────────────────────────────────────────────────

export type EmployeeLifecycleStatus =
  "active" | "on_leave" | "invited" | "deactivated" | "offboarding";

export interface EmployeeStatusSnapshot {
  id: string;
  status: EmployeeLifecycleStatus;
}

export type SessionStatus = "not_started" | "working" | "on_break" | "finished";

/** One employee's live work-session state (from `work_sessions`). */
export interface PresenceSnapshot {
  userId: string;
  sessionStatus: SessionStatus;
}

export type AttendanceMark =
  "on_time" | "late" | "absent" | "weekend" | "holiday" | "half_day" | "leave" | "in_progress";

/** One employee-day of attendance (from `work_sessions` for a date range). */
export interface AttendanceDaySnapshot {
  userId: string;
  /** Was the employee scheduled to work this day (not weekend/holiday/leave). */
  expected: boolean;
  mark: AttendanceMark;
}

/** Pre-computed 0–100 sub-scores blended into the Productivity Score. */
export interface ProductivityInput {
  attendanceRate: number;
  reportCompletion: number;
  taskThroughput: number;
  utilization: number;
  /** Optional weight overrides; defaults sum to 1 (see calculators). */
  weights?: Partial<ProductivityWeights>;
}

export interface ProductivityWeights {
  attendance: number;
  reports: number;
  throughput: number;
  utilization: number;
}

export interface CompanyKpiInput {
  employees: EmployeeStatusSnapshot[];
  presence: PresenceSnapshot[];
  attendance: AttendanceDaySnapshot[];
  productivity: ProductivityInput;
  previous?: Partial<Record<CompanyKpiKey, number>>;
}

export type CompanyKpiKey =
  | "activeEmployees"
  | "employeesOnline"
  | "employeesOnLeave"
  | "attendanceRate"
  | "productivityScore";

export interface CompanyKpis {
  activeEmployees: Kpi;
  employeesOnline: Kpi;
  employeesOnLeave: Kpi;
  attendanceRate: Kpi;
  productivityScore: Kpi;
}

// ── Project inputs ───────────────────────────────────────────────────────────

export type ProjectStatusLite =
  "planning" | "active" | "on_hold" | "completed" | "archived" | "cancelled";

export type ProjectHealthLite = "healthy" | "at_risk" | "blocked" | "delayed" | "completed";

export interface ProjectSnapshot {
  id: string;
  status: ProjectStatusLite;
  health: ProjectHealthLite;
  /** Planned delivery date (ISO). */
  endDate: string;
  /** When it actually completed (ISO), if completed. */
  completedAt?: string | null;
  progress: number; // 0–100
}

export type ProjectKpiKey =
  "activeProjects" | "delayedProjects" | "completionRate" | "deliverySuccessRate";

export interface ProjectKpiInput {
  projects: ProjectSnapshot[];
  /** Evaluation instant; defaults to now. Injected for deterministic tests. */
  now?: Date;
  previous?: Partial<Record<ProjectKpiKey, number>>;
}

export interface ProjectKpis {
  activeProjects: Kpi;
  delayedProjects: Kpi;
  completionRate: Kpi;
  deliverySuccessRate: Kpi;
}

// ── Engineering inputs ───────────────────────────────────────────────────────

export type SprintStatusLite = "planned" | "active" | "completed";

export interface SprintSnapshot {
  id: string;
  status: SprintStatusLite;
  /** ISO end date — used to order "recent" completed sprints. */
  endDate: string;
}

export interface TaskSnapshot {
  id: string;
  /** Free-form status string; only `done`/`blocked` are interpreted here. */
  status: string;
  storyPoints: number | null;
  sprintId: string | null;
  assigneeId: string | null;
}

export interface WorkloadBucket {
  /** Assignee id (or team id when aggregated upstream). */
  key: string;
  openTasks: number;
  storyPoints: number;
  /** Share of total open tasks, 0–100. */
  sharePct: number;
}

export interface WorkloadDistribution {
  buckets: WorkloadBucket[];
  /** 0–100; 100 = perfectly even spread, lower = more concentrated. */
  balanceIndex: number;
}

export interface TeamCapacity {
  headcount: number;
  availableHours: number;
  loggedHours: number;
  /** loggedHours / availableHours, 0–100 (may exceed 100 = over capacity). */
  utilization: number;
}

export interface EngineeringKpiInput {
  sprints: SprintSnapshot[];
  tasks: TaskSnapshot[];
  /** Total logged minutes across the team for the capacity window. */
  loggedMinutes: number;
  headcount: number;
  /** Expected working hours per person for the capacity window. */
  expectedHoursPerPerson: number;
  /** Count of blocked cross-team dependencies to fold into Blocked Tasks. */
  blockedDependencies?: number;
  /** How many recent completed sprints to average for velocity. Default 3. */
  velocityWindow?: number;
  previous?: Partial<Record<EngineeringKpiKey, number>>;
}

export type EngineeringKpiKey =
  "sprintVelocity" | "blockedTasks" | "teamCapacity" | "workloadBalance";

export interface EngineeringKpis {
  sprintVelocity: Kpi;
  blockedTasks: Kpi;
  teamCapacity: Kpi;
  workloadBalance: Kpi;
  /** Supporting breakdown for the workload widget. */
  workload: WorkloadDistribution;
  /** Supporting detail for the capacity widget. */
  capacity: TeamCapacity;
}

// ── Report inputs ────────────────────────────────────────────────────────────

/** One employee-day of daily-report submission state. */
export interface ReportComplianceSnapshot {
  userId: string;
  workDate: string;
  /** Was the employee expected to file reports this day. */
  expected: boolean;
  checkin: boolean;
  midday: boolean;
  eod: boolean;
}

/** A submitted report with the moment it was prompted and filed. */
export interface ReportResponseSnapshot {
  /** When the report became due / the employee was prompted (ISO). */
  promptedAt: string;
  /** When it was actually submitted (ISO). */
  submittedAt: string;
}

export type ReportKpiKey = "reportCompletion" | "missingReports" | "avgResponseTime";

export interface ReportKpiInput {
  compliance: ReportComplianceSnapshot[];
  responses: ReportResponseSnapshot[];
  previous?: Partial<Record<ReportKpiKey, number>>;
}

export interface ReportKpis {
  reportCompletion: Kpi;
  missingReports: Kpi;
  avgResponseTime: Kpi;
  /** Per-type completion for drill-down (checkin / midday / eod). */
  byType: { checkin: number; midday: number; eod: number };
}

// ── Aggregate ────────────────────────────────────────────────────────────────

export interface ExecutiveKpiInput {
  company: CompanyKpiInput;
  projects: ProjectKpiInput;
  engineering: EngineeringKpiInput;
  reports: ReportKpiInput;
}

export interface ExecutiveKpis {
  company: CompanyKpis;
  projects: ProjectKpis;
  engineering: EngineeringKpis;
  reports: ReportKpis;
}
