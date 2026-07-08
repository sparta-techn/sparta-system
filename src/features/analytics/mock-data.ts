import type { Insight, TrendPoint } from "./types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const series = (labels: string[], values: number[]): TrendPoint[] =>
  labels.map((label, i) => ({ label, value: values[i] ?? 0 }));

// ──────────────────────────── EMPLOYEE / PERSONAL ────────────────────────────
export const personalAnalytics = {
  kpis: {
    attendanceRate: { current: 96, previous: 92, format: "percent" as const },
    workingHours: { current: 7.6, previous: 7.4, format: "hours" as const },
    checkinRate: { current: 100, previous: 88, format: "percent" as const },
    middayRate: { current: 92, previous: 81, format: "percent" as const },
    eodRate: { current: 96, previous: 94, format: "percent" as const },
    depsCreated: { current: 12, previous: 9, format: "number" as const },
    depsResolved: { current: 14, previous: 8, format: "number" as const },
    avgResolutionHrs: { current: 18, previous: 26, format: "hours" as const },
    healthScore: { current: 84, previous: 78, format: "number" as const },
  },
  attendanceTrend: series(WEEKS, [88, 92, 90, 94, 95, 96, 96, 97]),
  workingHoursTrend: series(DAYS, [7.5, 8.1, 7.4, 7.8, 7.2, 0, 0]),
  reportCompletion: [
    { label: "Check-in", value: 100 },
    { label: "Midday", value: 92 },
    { label: "End-of-day", value: 96 },
  ],
  dependencies: series(WEEKS, [2, 1, 3, 2, 1, 0, 2, 1]),
  resolutionTimeTrend: series(WEEKS, [28, 26, 24, 22, 20, 19, 18, 18]),
  workHealthTrend: series(WEEKS, [72, 74, 76, 78, 80, 82, 83, 84]),
  // heatmap: 7 days x 12 work-hours (mock activity intensity 0-5)
  activityHeatmap: Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 12 }, (_, h) => {
      if (d >= 5) return 0;
      const peak = h >= 2 && h <= 9 ? 4 : 2;
      return Math.max(0, Math.min(5, peak - (Math.abs(5 - h) % 3) + (d % 2)));
    }),
  ),
};

// ──────────────────────────── TEAM ────────────────────────────
export const teamAnalytics = {
  kpis: {
    attendance: { current: 94, previous: 91, format: "percent" as const },
    reportCompletion: { current: 89, previous: 84, format: "percent" as const },
    openDeps: { current: 23, previous: 31, format: "number" as const },
    resolvedDeps: { current: 41, previous: 33, format: "number" as const },
    avgBlockerHrs: { current: 22, previous: 29, format: "hours" as const },
    avgSessionHrs: { current: 7.8, previous: 7.6, format: "hours" as const },
    healthScore: { current: 82, previous: 76, format: "number" as const },
  },
  attendanceTrend: series(WEEKS, [86, 88, 90, 91, 92, 93, 94, 94]),
  reportTrend: series(WEEKS, [78, 80, 82, 84, 85, 87, 88, 89]),
  dependencyFlow: WEEKS.map((label, i) => ({
    label,
    opened: [8, 10, 7, 9, 11, 8, 6, 5][i],
    resolved: [6, 9, 8, 9, 10, 11, 12, 11][i],
  })),
  blockerDurationTrend: series(WEEKS, [34, 32, 30, 28, 26, 25, 23, 22]),
  workloadByMember: [
    { name: "Alex Morgan", open: 8, completed: 14 },
    { name: "Priya Shah", open: 5, completed: 17 },
    { name: "Diego Ruiz", open: 11, completed: 9 },
    { name: "Mia Chen", open: 3, completed: 16 },
    { name: "Sven Olsen", open: 6, completed: 12 },
    { name: "Noor Khan", open: 7, completed: 10 },
  ],
  healthBreakdown: [
    { label: "Flow", value: 86 },
    { label: "Focus", value: 78 },
    { label: "Wellbeing", value: 81 },
    { label: "Collaboration", value: 84 },
  ],
};

// ──────────────────────────── HR ────────────────────────────
export const hrAnalytics = {
  kpis: {
    compliance: { current: 97, previous: 95, format: "percent" as const },
    pendingLeave: { current: 6, previous: 9, format: "number" as const },
    newHires30: { current: 4, previous: 3, format: "number" as const },
    retention: { current: 94, previous: 93, format: "percent" as const },
    inviteConversion: { current: 82, previous: 76, format: "percent" as const },
    onboardingCompletion: { current: 88, previous: 79, format: "percent" as const },
  },
  attendanceCompliance: series(MONTHS, [92, 93, 95, 96, 96, 97]),
  leaveTrend: MONTHS.map((label, i) => ({
    label,
    sick: [4, 6, 5, 3, 2, 4][i],
    vacation: [8, 7, 9, 12, 14, 18][i],
    personal: [2, 3, 2, 4, 3, 5][i],
  })),
  newHiresTrend: series(MONTHS, [2, 3, 4, 5, 3, 4]),
  departmentGrowth: [
    { label: "Engineering", value: 38 },
    { label: "Design", value: 14 },
    { label: "Product", value: 11 },
    { label: "Marketing", value: 9 },
    { label: "Sales", value: 16 },
    { label: "Support", value: 12 },
  ],
  inviteFunnel: [
    { label: "Sent", value: 64 },
    { label: "Opened", value: 58 },
    { label: "Accepted", value: 52 },
    { label: "Activated", value: 47 },
  ],
  onboardingByCohort: [
    { label: "Jan", value: 72 },
    { label: "Feb", value: 78 },
    { label: "Mar", value: 82 },
    { label: "Apr", value: 85 },
    { label: "May", value: 86 },
    { label: "Jun", value: 88 },
  ],
};

// ──────────────────────────── EXECUTIVE ────────────────────────────
export const executiveAnalytics = {
  kpis: {
    companyHealth: { current: 86, previous: 82, format: "number" as const },
    attendance: { current: 95, previous: 93, format: "percent" as const },
    reportCompliance: { current: 91, previous: 87, format: "percent" as const },
    openRisks: { current: 5, previous: 8, format: "number" as const },
  },
  departmentHealth: [
    { name: "Engineering", score: 88, trend: "up" as const, headcount: 38 },
    { name: "Product", score: 84, trend: "flat" as const, headcount: 11 },
    { name: "Design", score: 86, trend: "up" as const, headcount: 14 },
    { name: "Marketing", score: 79, trend: "down" as const, headcount: 9 },
    { name: "Sales", score: 82, trend: "up" as const, headcount: 16 },
    { name: "Support", score: 81, trend: "flat" as const, headcount: 12 },
  ],
  projectHealth: [
    { name: "Atlas Platform", status: "On track", score: 88, blockers: 1 },
    { name: "Helios Mobile", status: "At risk", score: 64, blockers: 4 },
    { name: "Orion Billing", status: "On track", score: 82, blockers: 2 },
    { name: "Nimbus Data", status: "Critical", score: 51, blockers: 6 },
    { name: "Vega Insights", status: "On track", score: 90, blockers: 0 },
  ],
  operationalRisks: [
    {
      id: "r1",
      title: "Helios Mobile has 4 unresolved blockers > 5d",
      severity: "high" as const,
      owner: "Engineering",
    },
    {
      id: "r2",
      title: "Marketing report completion dropped to 71%",
      severity: "medium" as const,
      owner: "Marketing",
    },
    {
      id: "r3",
      title: "Nimbus Data dependency backlog growing",
      severity: "high" as const,
      owner: "Data",
    },
    {
      id: "r4",
      title: "Onboarding completion below target for May cohort",
      severity: "low" as const,
      owner: "People Ops",
    },
  ],
  dependencyTrend: WEEKS.map((label, i) => ({
    label,
    opened: [22, 19, 24, 21, 18, 17, 15, 14][i],
    resolved: [18, 21, 22, 23, 24, 25, 26, 28][i],
  })),
  reportTrend: series(WEEKS, [82, 84, 85, 87, 88, 89, 90, 91]),
  attendanceTrend: series(WEEKS, [91, 92, 93, 93, 94, 94, 95, 95]),
};

// ──────────────────────────── INSIGHTS ────────────────────────────
export const insightsByScope: Record<string, Insight[]> = {
  personal: [
    {
      id: "p1",
      title: "Attendance steady at 96%",
      description: "Up from 92% last month — consistent start times this week.",
      intent: "positive",
      delta: "+4pp",
    },
    {
      id: "p2",
      title: "Resolution time down 31%",
      description: "You resolved dependencies in 18h on average, down from 26h.",
      intent: "positive",
      delta: "-31%",
    },
    {
      id: "p3",
      title: "Midday completion improved",
      description: "From 81% to 92% over the last 4 weeks.",
      intent: "positive",
      delta: "+11pp",
    },
    {
      id: "p4",
      title: "Friday focus dips",
      description: "Working hours on Friday average 7.2h, ~10% below the weekly mean.",
      intent: "neutral",
    },
  ],
  team: [
    {
      id: "t1",
      title: "Open dependencies down 26%",
      description: "23 open this week vs 31 last week. Resolution pace is outrunning new blockers.",
      intent: "positive",
      delta: "-26%",
    },
    {
      id: "t2",
      title: "Avg blocker duration dropped to 22h",
      description: "Down from 29h. Engineering escalations were responded to faster.",
      intent: "positive",
      delta: "-24%",
    },
    {
      id: "t3",
      title: "Workload imbalance: Diego",
      description: "Diego Ruiz holds 11 open dependencies — 2.5x team average.",
      intent: "warning",
    },
    {
      id: "t4",
      title: "Report completion at 89%",
      description: "Up 5pp month-over-month, above 85% target.",
      intent: "positive",
      delta: "+5pp",
    },
  ],
  hr: [
    {
      id: "h1",
      title: "Attendance compliance at 97%",
      description: "Highest in 6 months. Late starts down 18%.",
      intent: "positive",
      delta: "+2pp",
    },
    {
      id: "h2",
      title: "Invite conversion up to 82%",
      description: "Sent 64 invitations, 52 accepted within the window.",
      intent: "positive",
      delta: "+6pp",
    },
    {
      id: "h3",
      title: "Vacation requests spiking",
      description: "18 vacation requests in Jun vs 14 in May — plan coverage early.",
      intent: "warning",
      delta: "+29%",
    },
    {
      id: "h4",
      title: "Onboarding completion improving",
      description: "May cohort reached 86%, up from 79% in April.",
      intent: "positive",
      delta: "+7pp",
    },
  ],
  executive: [
    {
      id: "e1",
      title: "Company health at 86",
      description: "Composite score up 4 points QoQ across all departments except Marketing.",
      intent: "positive",
      delta: "+5%",
    },
    {
      id: "e2",
      title: "Nimbus Data critical",
      description: "Health 51 and 6 unresolved blockers. Recommend exec review this week.",
      intent: "negative",
    },
    {
      id: "e3",
      title: "Report compliance at 91%",
      description: "Highest since launch — automation reminders effective.",
      intent: "positive",
      delta: "+4pp",
    },
    {
      id: "e4",
      title: "Open operational risks reduced",
      description: "From 8 to 5 quarter-over-quarter.",
      intent: "positive",
      delta: "-38%",
    },
  ],
};

export const initialSavedReports = [
  {
    id: "sr1",
    name: "Weekly engineering snapshot",
    scope: "team" as const,
    filters: { range: "7d" as const, benchmark: "wow" as const, department: "Engineering" },
    pinned: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    schedule: "weekly" as const,
  },
  {
    id: "sr2",
    name: "Monthly compliance review",
    scope: "hr" as const,
    filters: { range: "30d" as const, benchmark: "mom" as const },
    pinned: true,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    schedule: "monthly" as const,
  },
  {
    id: "sr3",
    name: "Q2 executive readout",
    scope: "executive" as const,
    filters: { range: "qtd" as const, benchmark: "qoq" as const },
    pinned: false,
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
];

export const filterOptions = {
  departments: ["Engineering", "Product", "Design", "Marketing", "Sales", "Support", "People Ops"],
  teams: ["Platform", "Mobile", "Web", "Data", "Growth", "Customer Success"],
  roles: ["Employee", "Team Lead", "Manager", "HR", "Owner"],
  employees: ["Alex Morgan", "Priya Shah", "Diego Ruiz", "Mia Chen", "Sven Olsen", "Noor Khan"],
  projects: ["Atlas Platform", "Helios Mobile", "Orion Billing", "Nimbus Data", "Vega Insights"],
};
