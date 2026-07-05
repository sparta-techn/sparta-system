/**
 * Executive KPI calculators — pure, deterministic, side-effect free.
 *
 * Every function takes a typed snapshot (see `kpi-types.ts`) and returns a
 * number or a {@link Kpi}. No I/O, no clock reads except where a `now` is
 * injected, no dependency on stores or Supabase. This is the reusable core the
 * `ExecutiveKpiService` composes and the unit tests exercise directly.
 */
import type {
  AttendanceDaySnapshot,
  CompanyKpiInput,
  CompanyKpis,
  EmployeeStatusSnapshot,
  EngineeringKpiInput,
  EngineeringKpis,
  GoodDirection,
  Kpi,
  KpiFormat,
  PresenceSnapshot,
  ProductivityInput,
  ProductivityWeights,
  ProjectKpiInput,
  ProjectKpis,
  ProjectSnapshot,
  ReportComplianceSnapshot,
  ReportKpiInput,
  ReportKpis,
  ReportResponseSnapshot,
  SprintSnapshot,
  TaskSnapshot,
  TeamCapacity,
  WorkloadDistribution,
} from "./kpi-types";

// ── Numeric helpers ──────────────────────────────────────────────────────────

/** Round to `dp` decimal places (default 1), avoiding `-0`. */
export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
}

/** Safe division: returns `fallback` when the denominator is 0. */
export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  return denominator === 0 ? fallback : numerator / denominator;
}

/** Ratio as a 0–100 percentage, rounded. */
export function pct(numerator: number, denominator: number, dp = 1): number {
  return round(safeDiv(numerator, denominator) * 100, dp);
}

/** Clamp into an inclusive range. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ── Kpi envelope builder ─────────────────────────────────────────────────────

/**
 * Wrap a computed value in a {@link Kpi}, attaching benchmark fields when a
 * `previous` value is supplied.
 */
export function toKpi(
  key: string,
  label: string,
  value: number,
  opts: { format: KpiFormat; goodDirection: GoodDirection; previous?: number },
): Kpi {
  const base: Kpi = {
    key,
    label,
    value,
    format: opts.format,
    goodDirection: opts.goodDirection,
  };
  if (opts.previous === undefined) return base;

  const delta = round(value - opts.previous, 2);
  const deltaPct = pct(value - opts.previous, Math.abs(opts.previous));
  const trend: Kpi["trend"] = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { ...base, previous: opts.previous, delta, deltaPct, trend };
}

// ── Company ──────────────────────────────────────────────────────────────────

/** Count of employees whose lifecycle status is `active`. */
export function countActiveEmployees(employees: EmployeeStatusSnapshot[]): number {
  return employees.filter((e) => e.status === "active").length;
}

/** Employees currently in a live session (`working` or `on_break`). */
export function countEmployeesOnline(presence: PresenceSnapshot[]): number {
  return presence.filter((p) => p.sessionStatus === "working" || p.sessionStatus === "on_break")
    .length;
}

/** Employees whose lifecycle status is `on_leave`. */
export function countEmployeesOnLeave(employees: EmployeeStatusSnapshot[]): number {
  return employees.filter((e) => e.status === "on_leave").length;
}

/**
 * Attendance Rate — share of *expected* employee-days that were present.
 * Present = `on_time`, `in_progress`, or `half_day` (weighted 0.5). Absent and
 * `late`-without-presence count against the rate. Non-expected days (weekend /
 * holiday / leave) are excluded from the denominator.
 */
export function attendanceRate(days: AttendanceDaySnapshot[]): number {
  const expected = days.filter((d) => d.expected);
  if (expected.length === 0) return 0;
  const present = expected.reduce((sum, d) => {
    if (d.mark === "on_time" || d.mark === "in_progress" || d.mark === "late") return sum + 1;
    if (d.mark === "half_day") return sum + 0.5;
    return sum;
  }, 0);
  return pct(present, expected.length);
}

const DEFAULT_PRODUCTIVITY_WEIGHTS: ProductivityWeights = {
  attendance: 0.3,
  reports: 0.2,
  throughput: 0.3,
  utilization: 0.2,
};

/**
 * Productivity Score — 0–100 weighted blend of attendance, report completion,
 * task throughput, and utilization sub-scores. Weights are normalized so the
 * score stays 0–100 even if callers pass a partial/unnormalized set.
 */
export function productivityScore(input: ProductivityInput): number {
  const w = { ...DEFAULT_PRODUCTIVITY_WEIGHTS, ...input.weights };
  const total = w.attendance + w.reports + w.throughput + w.utilization;
  if (total === 0) return 0;
  const raw =
    clamp(input.attendanceRate, 0, 100) * w.attendance +
    clamp(input.reportCompletion, 0, 100) * w.reports +
    clamp(input.taskThroughput, 0, 100) * w.throughput +
    clamp(input.utilization, 0, 100) * w.utilization;
  return round(raw / total);
}

export function computeCompanyKpis(input: CompanyKpiInput): CompanyKpis {
  const prev = input.previous ?? {};
  return {
    activeEmployees: toKpi(
      "activeEmployees",
      "Active Employees",
      countActiveEmployees(input.employees),
      { format: "number", goodDirection: "up", previous: prev.activeEmployees },
    ),
    employeesOnline: toKpi(
      "employeesOnline",
      "Employees Online",
      countEmployeesOnline(input.presence),
      { format: "number", goodDirection: "up", previous: prev.employeesOnline },
    ),
    employeesOnLeave: toKpi(
      "employeesOnLeave",
      "Employees on Leave",
      countEmployeesOnLeave(input.employees),
      { format: "number", goodDirection: "down", previous: prev.employeesOnLeave },
    ),
    attendanceRate: toKpi("attendanceRate", "Attendance Rate", attendanceRate(input.attendance), {
      format: "percent",
      goodDirection: "up",
      previous: prev.attendanceRate,
    }),
    productivityScore: toKpi(
      "productivityScore",
      "Productivity Score",
      productivityScore(input.productivity),
      { format: "number", goodDirection: "up", previous: prev.productivityScore },
    ),
  };
}

// ── Projects ─────────────────────────────────────────────────────────────────

const CLOSED_PROJECT: ReadonlySet<ProjectSnapshot["status"]> = new Set([
  "completed",
  "archived",
  "cancelled",
]);

/** Projects with status `active`. */
export function countActiveProjects(projects: ProjectSnapshot[]): number {
  return projects.filter((p) => p.status === "active").length;
}

/**
 * Delayed Projects — open projects (not completed/archived/cancelled) that are
 * either flagged `delayed`/`blocked` or already past their planned `endDate`.
 */
export function countDelayedProjects(projects: ProjectSnapshot[], now = new Date()): number {
  const t = now.getTime();
  return projects.filter((p) => {
    if (CLOSED_PROJECT.has(p.status)) return false;
    if (p.health === "delayed" || p.health === "blocked") return true;
    const end = Date.parse(p.endDate);
    return Number.isFinite(end) && end < t;
  }).length;
}

/**
 * Completion Rate — completed projects as a share of all *deliverable*
 * projects (excludes archived + cancelled from the denominator).
 */
export function projectCompletionRate(projects: ProjectSnapshot[]): number {
  const deliverable = projects.filter((p) => p.status !== "archived" && p.status !== "cancelled");
  const completed = deliverable.filter((p) => p.status === "completed").length;
  return pct(completed, deliverable.length);
}

/**
 * Delivery Success Rate — of the projects that completed, the share that
 * completed on or before their planned `endDate`.
 */
export function deliverySuccessRate(projects: ProjectSnapshot[]): number {
  const completed = projects.filter((p) => p.status === "completed" && p.completedAt);
  if (completed.length === 0) return 0;
  const onTime = completed.filter((p) => {
    const done = Date.parse(p.completedAt as string);
    const due = Date.parse(p.endDate);
    return Number.isFinite(done) && Number.isFinite(due) && done <= due;
  }).length;
  return pct(onTime, completed.length);
}

export function computeProjectKpis(input: ProjectKpiInput): ProjectKpis {
  const now = input.now ?? new Date();
  const prev = input.previous ?? {};
  return {
    activeProjects: toKpi(
      "activeProjects",
      "Active Projects",
      countActiveProjects(input.projects),
      {
        format: "number",
        goodDirection: "up",
        previous: prev.activeProjects,
      },
    ),
    delayedProjects: toKpi(
      "delayedProjects",
      "Delayed Projects",
      countDelayedProjects(input.projects, now),
      { format: "number", goodDirection: "down", previous: prev.delayedProjects },
    ),
    completionRate: toKpi(
      "completionRate",
      "Completion Rate",
      projectCompletionRate(input.projects),
      { format: "percent", goodDirection: "up", previous: prev.completionRate },
    ),
    deliverySuccessRate: toKpi(
      "deliverySuccessRate",
      "Delivery Success Rate",
      deliverySuccessRate(input.projects),
      { format: "percent", goodDirection: "up", previous: prev.deliverySuccessRate },
    ),
  };
}

// ── Engineering ──────────────────────────────────────────────────────────────

/** Story points from `done` tasks in a given sprint. */
function completedPointsForSprint(sprintId: string, tasks: TaskSnapshot[]): number {
  return tasks
    .filter((t) => t.sprintId === sprintId && t.status === "done")
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
}

/**
 * Sprint Velocity — average completed story points across the most recent
 * `window` completed sprints (default 3). 0 when there are no completed sprints.
 */
export function sprintVelocity(
  sprints: SprintSnapshot[],
  tasks: TaskSnapshot[],
  window = 3,
): number {
  const completed = sprints
    .filter((s) => s.status === "completed")
    .sort((a, b) => Date.parse(b.endDate) - Date.parse(a.endDate))
    .slice(0, Math.max(1, window));
  if (completed.length === 0) return 0;
  const total = completed.reduce((sum, s) => sum + completedPointsForSprint(s.id, tasks), 0);
  return round(total / completed.length);
}

/** Blocked Tasks — tasks in `blocked` status, plus any blocked dependencies. */
export function countBlockedTasks(tasks: TaskSnapshot[], blockedDependencies = 0): number {
  return tasks.filter((t) => t.status === "blocked").length + blockedDependencies;
}

/**
 * Team Capacity — logged hours against available hours for the window.
 * Utilization can exceed 100 (over capacity / overtime).
 */
export function teamCapacity(
  loggedMinutes: number,
  headcount: number,
  expectedHoursPerPerson: number,
): TeamCapacity {
  const loggedHours = round(loggedMinutes / 60);
  const availableHours = round(headcount * expectedHoursPerPerson);
  return {
    headcount,
    availableHours,
    loggedHours,
    utilization: pct(loggedHours, availableHours),
  };
}

const OPEN_TASK_STATUSES: ReadonlySet<string> = new Set([
  "backlog",
  "todo",
  "in_progress",
  "review",
  "qa",
  "blocked",
]);

/**
 * Workload Distribution — open-task load per assignee plus a 0–100 balance
 * index (100 = perfectly even, lower = more concentrated). Unassigned open
 * tasks are bucketed under `"unassigned"`.
 */
export function workloadDistribution(tasks: TaskSnapshot[]): WorkloadDistribution {
  const open = tasks.filter((t) => OPEN_TASK_STATUSES.has(t.status));
  const byAssignee = new Map<string, { openTasks: number; storyPoints: number }>();
  for (const t of open) {
    const key = t.assigneeId ?? "unassigned";
    const bucket = byAssignee.get(key) ?? { openTasks: 0, storyPoints: 0 };
    bucket.openTasks += 1;
    bucket.storyPoints += t.storyPoints ?? 0;
    byAssignee.set(key, bucket);
  }

  const totalOpen = open.length;
  const buckets = [...byAssignee.entries()]
    .map(([key, b]) => ({
      key,
      openTasks: b.openTasks,
      storyPoints: b.storyPoints,
      sharePct: pct(b.openTasks, totalOpen),
    }))
    .sort((a, b) => b.openTasks - a.openTasks);

  return { buckets, balanceIndex: balanceIndex(buckets.map((b) => b.openTasks)) };
}

/**
 * 0–100 evenness score derived from the coefficient of variation of the loads.
 * One or zero buckets is trivially "balanced" (100).
 */
export function balanceIndex(loads: number[]): number {
  if (loads.length <= 1) return 100;
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
  if (mean === 0) return 100;
  const variance = loads.reduce((a, b) => a + (b - mean) ** 2, 0) / loads.length;
  const cv = Math.sqrt(variance) / mean;
  return round(clamp((1 - cv) * 100, 0, 100));
}

export function computeEngineeringKpis(input: EngineeringKpiInput): EngineeringKpis {
  const prev = input.previous ?? {};
  const capacity = teamCapacity(input.loggedMinutes, input.headcount, input.expectedHoursPerPerson);
  const workload = workloadDistribution(input.tasks);
  return {
    sprintVelocity: toKpi(
      "sprintVelocity",
      "Sprint Velocity",
      sprintVelocity(input.sprints, input.tasks, input.velocityWindow ?? 3),
      { format: "points", goodDirection: "up", previous: prev.sprintVelocity },
    ),
    blockedTasks: toKpi(
      "blockedTasks",
      "Blocked Tasks",
      countBlockedTasks(input.tasks, input.blockedDependencies ?? 0),
      { format: "number", goodDirection: "down", previous: prev.blockedTasks },
    ),
    teamCapacity: toKpi("teamCapacity", "Team Capacity", capacity.utilization, {
      format: "percent",
      goodDirection: "up",
      previous: prev.teamCapacity,
    }),
    workloadBalance: toKpi("workloadBalance", "Workload Balance", workload.balanceIndex, {
      format: "number",
      goodDirection: "up",
      previous: prev.workloadBalance,
    }),
    workload,
    capacity,
  };
}

// ── Reports ──────────────────────────────────────────────────────────────────

/** Count of report slots submitted for one expected employee-day (0–3). */
function submittedSlots(r: ReportComplianceSnapshot): number {
  return (r.checkin ? 1 : 0) + (r.midday ? 1 : 0) + (r.eod ? 1 : 0);
}

/**
 * Daily Report Completion — submitted report slots as a share of expected
 * slots (3 per expected employee-day: check-in, midday, EoD).
 */
export function dailyReportCompletion(records: ReportComplianceSnapshot[]): number {
  const expected = records.filter((r) => r.expected);
  const expectedSlots = expected.length * 3;
  const submitted = expected.reduce((sum, r) => sum + submittedSlots(r), 0);
  return pct(submitted, expectedSlots);
}

/** Per-type completion (each 0–100) for drill-down. */
export function reportCompletionByType(records: ReportComplianceSnapshot[]): {
  checkin: number;
  midday: number;
  eod: number;
} {
  const expected = records.filter((r) => r.expected);
  const n = expected.length;
  return {
    checkin: pct(expected.filter((r) => r.checkin).length, n),
    midday: pct(expected.filter((r) => r.midday).length, n),
    eod: pct(expected.filter((r) => r.eod).length, n),
  };
}

/** Missing Reports — count of expected-but-unfiled report slots. */
export function countMissingReports(records: ReportComplianceSnapshot[]): number {
  return records.filter((r) => r.expected).reduce((sum, r) => sum + (3 - submittedSlots(r)), 0);
}

/**
 * Average Response Time — mean minutes between when a report was due/prompted
 * and when it was submitted. Ignores entries missing either timestamp or with a
 * negative delta (submitted before prompt = clock skew / bad data).
 */
export function averageResponseTime(responses: ReportResponseSnapshot[]): number {
  const deltas = responses
    .map((r) => (Date.parse(r.submittedAt) - Date.parse(r.promptedAt)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0);
  if (deltas.length === 0) return 0;
  return round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

export function computeReportKpis(input: ReportKpiInput): ReportKpis {
  const prev = input.previous ?? {};
  return {
    reportCompletion: toKpi(
      "reportCompletion",
      "Daily Report Completion",
      dailyReportCompletion(input.compliance),
      { format: "percent", goodDirection: "up", previous: prev.reportCompletion },
    ),
    missingReports: toKpi(
      "missingReports",
      "Missing Reports",
      countMissingReports(input.compliance),
      { format: "number", goodDirection: "down", previous: prev.missingReports },
    ),
    avgResponseTime: toKpi(
      "avgResponseTime",
      "Average Response Time",
      averageResponseTime(input.responses),
      { format: "minutes", goodDirection: "down", previous: prev.avgResponseTime },
    ),
    byType: reportCompletionByType(input.compliance),
  };
}
