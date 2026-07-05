/**
 * Executive dashboard — seed data.
 *
 * The KPI snapshots below are fed into `executiveKpiService.computeAll(...)` so
 * the dashboard renders **real calculated KPIs** (not hard-coded numbers) while
 * the backend is still mock-backed. Swapping to live data means replacing this
 * module with an adapter over the Supabase rows / feature stores — the widgets
 * and the KPI math stay unchanged.
 *
 * Section extras (trends, insights, timeline, risks) use the shared analytics
 * types so they flow straight into the reused chart components.
 */
import type { Insight, TrendPoint } from "@/features/analytics/types";
import type { TimelineEvent } from "@/features/analytics/charts";
import type { ExecutiveKpiInput } from "@/services/kpi";
import type {
  AttendancePulse,
  DashboardTrends,
  ExecRisk,
  HrPulse,
  ProjectHealthRow,
} from "./types";

const t = (labels: string[], values: number[]): TrendPoint[] =>
  labels.map((label, i) => ({ label, value: values[i] }));

const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6"];

// ── KPI snapshot inputs (fed to executiveKpiService) ─────────────────────────

/** 48 employees: 42 active, 3 on leave, 2 invited, 1 offboarding. */
const employees = Array.from({ length: 48 }, (_, i) => ({
  id: `emp-${i}`,
  status:
    i < 42
      ? ("active" as const)
      : i < 45
        ? ("on_leave" as const)
        : i < 47
          ? ("invited" as const)
          : ("offboarding" as const),
}));

/** 31 of the 42 active people are currently in a live session. */
const presence = Array.from({ length: 42 }, (_, i) => ({
  userId: `emp-${i}`,
  sessionStatus:
    i < 27
      ? ("working" as const)
      : i < 31
        ? ("on_break" as const)
        : i < 38
          ? ("finished" as const)
          : ("not_started" as const),
}));

/** One expected work-day per active person; most on time. */
const attendance = Array.from({ length: 42 }, (_, i) => ({
  userId: `emp-${i}`,
  expected: true,
  mark:
    i < 34
      ? ("on_time" as const)
      : i < 38
        ? ("late" as const)
        : i < 40
          ? ("half_day" as const)
          : ("absent" as const),
}));

const projects = [
  {
    id: "etb",
    status: "active" as const,
    health: "healthy" as const,
    endDate: "2026-08-15",
    progress: 62,
  },
  {
    id: "nova",
    status: "active" as const,
    health: "at_risk" as const,
    endDate: "2026-07-20",
    progress: 48,
  },
  {
    id: "atlas",
    status: "active" as const,
    health: "delayed" as const,
    endDate: "2026-06-25",
    progress: 33,
  },
  {
    id: "orbit",
    status: "active" as const,
    health: "blocked" as const,
    endDate: "2026-07-10",
    progress: 27,
  },
  {
    id: "pulse",
    status: "planning" as const,
    health: "healthy" as const,
    endDate: "2026-09-30",
    progress: 8,
  },
  {
    id: "flux",
    status: "completed" as const,
    health: "completed" as const,
    endDate: "2026-06-20",
    completedAt: "2026-06-18",
    progress: 100,
  },
  {
    id: "delta",
    status: "completed" as const,
    health: "completed" as const,
    endDate: "2026-06-15",
    completedAt: "2026-06-22",
    progress: 100,
  },
  {
    id: "helix",
    status: "on_hold" as const,
    health: "at_risk" as const,
    endDate: "2026-08-01",
    progress: 41,
  },
  {
    id: "arc",
    status: "archived" as const,
    health: "completed" as const,
    endDate: "2026-02-01",
    progress: 100,
  },
];

const sprints = [
  { id: "s-38", status: "completed" as const, endDate: "2026-05-16" },
  { id: "s-39", status: "completed" as const, endDate: "2026-05-30" },
  { id: "s-40", status: "completed" as const, endDate: "2026-06-13" },
  { id: "s-41", status: "active" as const, endDate: "2026-06-27" },
];

const sprintPoints: Record<string, number> = { "s-38": 34, "s-39": 41, "s-40": 38 };
const tasks = [
  // Completed points per sprint, expressed as done tasks.
  ...Object.entries(sprintPoints).flatMap(([sprintId, pts]) => [
    { id: `${sprintId}-done`, status: "done", storyPoints: pts, sprintId, assigneeId: null },
  ]),
  // Open workload spread across five engineers (deliberately lopsided).
  ...Array.from({ length: 34 }, (_, i) => ({
    id: `open-${i}`,
    status: i < 6 ? "blocked" : i % 3 === 0 ? "in_progress" : i % 3 === 1 ? "review" : "todo",
    storyPoints: (i % 4) + 1,
    sprintId: "s-41",
    assigneeId: `eng-${i % 5}`,
  })),
];

const compliance = Array.from({ length: 42 }, (_, i) => ({
  userId: `emp-${i}`,
  workDate: "2026-07-01",
  expected: true,
  checkin: i < 40,
  midday: i < 33,
  eod: i < 30,
}));

const responses = Array.from({ length: 40 }, (_, i) => ({
  promptedAt: "2026-07-01T09:00:00Z",
  submittedAt: new Date(Date.parse("2026-07-01T09:00:00Z") + (18 + (i % 20)) * 60000).toISOString(),
}));

/**
 * The single snapshot the dashboard computes from. `previous` maps drive the
 * benchmark deltas rendered by the KPI cards.
 */
export const executiveKpiInput: ExecutiveKpiInput = {
  company: {
    employees,
    presence,
    attendance,
    productivity: { attendanceRate: 90, reportCompletion: 82, taskThroughput: 74, utilization: 88 },
    previous: {
      activeEmployees: 40,
      employeesOnline: 28,
      employeesOnLeave: 2,
      attendanceRate: 88.4,
      productivityScore: 80,
    },
  },
  projects: {
    projects,
    now: new Date("2026-07-02T00:00:00Z"),
    previous: {
      activeProjects: 4,
      delayedProjects: 3,
      completionRate: 22,
      deliverySuccessRate: 60,
    },
  },
  engineering: {
    sprints,
    tasks,
    loggedMinutes: 42 * 32 * 60, // ~32h logged per active person this week
    headcount: 42,
    expectedHoursPerPerson: 40,
    blockedDependencies: 4,
    velocityWindow: 3,
    previous: { sprintVelocity: 35, blockedTasks: 8, teamCapacity: 78, workloadBalance: 72 },
  },
  reports: {
    compliance,
    responses,
    previous: { reportCompletion: 78, missingReports: 34, avgResponseTime: 31 },
  },
};

// ── Section extras ───────────────────────────────────────────────────────────

export const trends: DashboardTrends = {
  attendance: t(WEEKS, [86, 88, 90, 89, 92, 91]),
  reportCompliance: t(WEEKS, [72, 74, 79, 81, 80, 82]),
  velocity: t(["S-38", "S-39", "S-40"], [34, 41, 38]),
  throughput: t(WEEKS, [41, 47, 52, 49, 58, 61]),
  depsOpened: t(WEEKS, [12, 15, 11, 14, 9, 8]),
  depsResolved: t(WEEKS, [8, 11, 13, 12, 15, 14]),
};

export const hrPulse: HrPulse = {
  totalHeadcount: 48,
  activeHeadcount: 42,
  newHires30d: 4,
  offboarding: 1,
  birthdaysThisWeek: 3,
  byDepartment: [
    { name: "Engineering", headcount: 21 },
    { name: "Design", headcount: 7 },
    { name: "Product", headcount: 6 },
    { name: "QA", headcount: 5 },
    { name: "Operations", headcount: 5 },
    { name: "Marketing", headcount: 4 },
  ],
};

export const attendancePulse: AttendancePulse = {
  present: 34,
  late: 4,
  absent: 2,
  onLeave: 3,
  trend: t(WEEKS, [86, 88, 90, 89, 92, 91]),
};

export const projectHealth: ProjectHealthRow[] = [
  {
    id: "orbit",
    name: "Orbit Platform",
    status: "Delayed",
    progress: 27,
    openBlockers: 5,
    owner: "Mala K.",
  },
  {
    id: "atlas",
    name: "Atlas Migration",
    status: "Delayed",
    progress: 33,
    openBlockers: 3,
    owner: "Sami R.",
  },
  {
    id: "nova",
    name: "Nova Mobile",
    status: "At risk",
    progress: 48,
    openBlockers: 2,
    owner: "Priya S.",
  },
  {
    id: "etb",
    name: "ETB Web",
    status: "On track",
    progress: 62,
    openBlockers: 1,
    owner: "Dana L.",
  },
  {
    id: "pulse",
    name: "Pulse Analytics",
    status: "On track",
    progress: 8,
    openBlockers: 0,
    owner: "Owen T.",
  },
  {
    id: "flux",
    name: "Flux Billing",
    status: "Completed",
    progress: 100,
    openBlockers: 0,
    owner: "Jae M.",
  },
];

export const insights: Insight[] = [
  {
    id: "ins-1",
    title: "Delivery is accelerating",
    description:
      "Throughput is up 18% over 6 weeks while velocity held above 38 pts — capacity is being used well.",
    intent: "positive",
    delta: "+18%",
  },
  {
    id: "ins-2",
    title: "Orbit is the top delivery risk",
    description:
      "5 open blockers and 27% progress against a July 10 deadline. Escalate the API dependency this week.",
    intent: "negative",
    delta: "5 blockers",
  },
  {
    id: "ins-3",
    title: "EoD reporting lags mid-day",
    description:
      "Only 30 of 42 filed an end-of-day report yesterday. Consider a 5pm reminder automation.",
    intent: "warning",
    delta: "71%",
  },
  {
    id: "ins-4",
    title: "Attendance is stable",
    description:
      "On-time attendance sits at 91%, its highest in 6 weeks, with late arrivals trending down.",
    intent: "neutral",
    delta: "91%",
  },
];

export const timeline: TimelineEvent[] = [
  {
    id: "ev-1",
    date: "09:12",
    title: "Flux Billing shipped to production",
    description: "Delivered 4 days early.",
    intent: "positive",
  },
  {
    id: "ev-2",
    date: "08:40",
    title: "Orbit dependency marked blocked",
    description: "Awaiting payments API from Platform team.",
    intent: "negative",
  },
  {
    id: "ev-3",
    date: "Yesterday",
    title: "Sprint 40 closed at 38 pts",
    description: "Above the 3-sprint average of 37.7.",
    intent: "neutral",
  },
  {
    id: "ev-4",
    date: "Yesterday",
    title: "2 new hires onboarded",
    description: "Engineering + Design.",
    intent: "positive",
  },
  {
    id: "ev-5",
    date: "2 days ago",
    title: "Atlas Migration slipped past due date",
    description: "Health downgraded to delayed.",
    intent: "warning",
  },
];

export const risks: ExecRisk[] = [
  {
    id: "r-1",
    title: "Orbit payments API blocked — launch at risk",
    severity: "high",
    owner: "Platform team",
    area: "engineering",
    dueLabel: "in 3 days",
  },
  {
    id: "r-2",
    title: "Atlas Migration past deadline, no revised plan",
    severity: "high",
    owner: "Sami R.",
    area: "project",
    dueLabel: "overdue",
  },
  {
    id: "r-3",
    title: "EoD report completion below 75% target",
    severity: "medium",
    owner: "People Ops",
    area: "reports",
    dueLabel: "this week",
  },
  {
    id: "r-4",
    title: "Nova Mobile capacity shortfall next sprint",
    severity: "medium",
    owner: "Priya S.",
    area: "engineering",
    dueLabel: "next sprint",
  },
  {
    id: "r-5",
    title: "1 offboarding pending access revocation",
    severity: "low",
    owner: "HR",
    area: "hr",
    dueLabel: "in 5 days",
  },
];
