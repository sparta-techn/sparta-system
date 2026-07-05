/**
 * Mock data for the Manager Dashboard. Pure UI scaffolding — no backend.
 */

export type ManagerStatus =
  | "working"
  | "on_break"
  | "late"
  | "absent"
  | "on_leave"
  | "holiday"
  | "finished";

export interface ManagerEmployee {
  id: string;
  name: string;
  initials: string;
  department: "Engineering" | "Design" | "Product" | "Data" | "QA" | "DevOps" | "Marketing";
  role: string;
  status: ManagerStatus;
  currentTask: string | null;
  workSeconds: number;
  breakSeconds: number;
  lastActivityAgo: string;
  workHealth: "good" | "watch" | "risk";
  openDependencies: number;
  reports: {
    checkin: "done" | "pending" | "missed";
    midday: "done" | "pending" | "missed" | "na";
    eod: "done" | "pending" | "missed" | "na";
  };
  email: string;
  joinedAt: string;
  manager: string;
  attendance7d: number[]; // hours per day
}

export interface ManagerBlocker {
  id: string;
  title: string;
  reason: string;
  employee: string;
  owner: string;
  department: string;
  ageHours: number;
  priority: "low" | "medium" | "high" | "urgent";
  status: "blocked" | "pending" | "escalated";
}

export interface ManagerActivity {
  id: string;
  kind:
    | "check_in"
    | "break_start"
    | "break_end"
    | "checkin_submitted"
    | "midday_submitted"
    | "eod_submitted"
    | "dependency_created"
    | "dependency_resolved"
    | "check_out";
  actor: string;
  detail: string;
  minutesAgo: number;
}

export interface ManagerNotification {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  body: string;
  time: string;
}

export interface CalendarItem {
  id: string;
  kind: "leave" | "holiday" | "birthday" | "meeting";
  title: string;
  date: string; // ISO
  who?: string;
}

const NAMES: Array<[string, string, ManagerEmployee["department"], string]> = [
  ["Lena Vargas", "LV", "Design", "Senior Product Designer"],
  ["Omar Said", "OS", "Engineering", "Backend Engineer"],
  ["Ana Petrova", "AP", "Engineering", "Platform Engineer"],
  ["Marek Janik", "MJ", "QA", "QA Lead"],
  ["Sara Kim", "SK", "Product", "Product Manager"],
  ["Diego Rivera", "DR", "Engineering", "Frontend Engineer"],
  ["Yuki Tanaka", "YT", "Data", "Data Analyst"],
  ["Noor Hadid", "NH", "DevOps", "DevOps Engineer"],
  ["Kerem Aydın", "KA", "Engineering", "Staff Engineer"],
  ["Priya Nair", "PN", "Marketing", "Content Strategist"],
  ["Tomás León", "TL", "Engineering", "Mobile Engineer"],
  ["Elena Rossi", "ER", "Design", "UX Researcher"],
];

const STATUSES: ManagerStatus[] = [
  "working", "working", "working", "working", "on_break",
  "working", "late", "absent", "working", "on_leave",
  "working", "finished",
];

const TASKS = [
  "Refactor onboarding wizard",
  "Review PR #284 — Reports cursor pagination",
  "Investigate flaky e2e: invite flow",
  "Polish dashboard tokens",
  "Write Q3 roadmap doc",
  "Migrate user_roles table",
  "Profile slow query on /reports/weekly",
  null,
  "Audit Lighthouse regressions",
  null,
  "Native splash screen",
  "Synthesize manager interviews",
];

const HEALTHS: ManagerEmployee["workHealth"][] = [
  "good", "good", "watch", "good", "good",
  "good", "risk", "risk", "watch", "good",
  "good", "good",
];

export const managerEmployees: ManagerEmployee[] = NAMES.map(([name, initials, dept, role], i) => {
  const status = STATUSES[i % STATUSES.length];
  return {
    id: `emp_${i + 1}`,
    name,
    initials,
    department: dept,
    role,
    status,
    currentTask: status === "working" || status === "on_break" ? TASKS[i % TASKS.length] : null,
    workSeconds:
      status === "working" ? 3600 * (2 + (i % 5)) + 60 * (i * 7) :
      status === "on_break" ? 3600 * 2 + 60 * 12 :
      status === "finished" ? 3600 * 7 + 60 * 42 :
      0,
    breakSeconds: status === "on_break" ? 60 * (8 + i) : 60 * (i % 25),
    lastActivityAgo:
      status === "working" ? `${(i % 6) + 1}m ago` :
      status === "on_break" ? `${(i % 12) + 4}m ago` :
      status === "late" ? "—" :
      status === "absent" ? "—" :
      status === "on_leave" ? "On leave" :
      "Signed out",
    workHealth: HEALTHS[i % HEALTHS.length],
    openDependencies: (i * 3) % 5,
    reports: {
      checkin: status === "absent" || status === "on_leave" ? "missed" : i % 4 === 0 ? "pending" : "done",
      midday: status === "absent" || status === "on_leave" ? "na" : i % 3 === 0 ? "pending" : "done",
      eod: status === "finished" ? "done" : status === "absent" || status === "on_leave" ? "na" : "pending",
    },
    email: `${name.split(" ")[0].toLowerCase()}@spartaflow.dev`,
    joinedAt: "2024-03-12",
    manager: i % 3 === 0 ? "Kerem Aydın" : "Sara Kim",
    attendance7d: Array.from({ length: 7 }, (_, d) => +(6 + ((i + d) % 4) + Math.random()).toFixed(1)),
  };
});

export const managerBlockers: ManagerBlocker[] = [
  {
    id: "blk_1",
    title: "Awaiting brand palette tokens",
    reason: "Design hand-off pending for chart colors",
    employee: "Diego Rivera",
    owner: "Lena Vargas",
    department: "Design",
    ageHours: 6,
    priority: "high",
    status: "blocked",
  },
  {
    id: "blk_2",
    title: "API contract /reports/weekly",
    reason: "Backend spec not finalized",
    employee: "Kerem Aydın",
    owner: "Omar Said",
    department: "Engineering",
    ageHours: 22,
    priority: "urgent",
    status: "escalated",
  },
  {
    id: "blk_3",
    title: "Migration review for user_roles",
    reason: "Needs senior review before merge",
    employee: "Ana Petrova",
    owner: "Kerem Aydın",
    department: "Engineering",
    ageHours: 2,
    priority: "urgent",
    status: "pending",
  },
  {
    id: "blk_4",
    title: "QA pass on invite acceptance",
    reason: "Flaky e2e; environment instability",
    employee: "Marek Janik",
    owner: "Noor Hadid",
    department: "DevOps",
    ageHours: 30,
    priority: "medium",
    status: "blocked",
  },
  {
    id: "blk_5",
    title: "Copy review for Q3 announcement",
    reason: "Awaiting marketing sign-off",
    employee: "Priya Nair",
    owner: "Sara Kim",
    department: "Product",
    ageHours: 9,
    priority: "low",
    status: "pending",
  },
];

export const managerActivity: ManagerActivity[] = [
  { id: "a1", kind: "dependency_resolved", actor: "Omar Said", detail: "Resolved /reports/weekly contract", minutesAgo: 2 },
  { id: "a2", kind: "midday_submitted", actor: "Lena Vargas", detail: "Submitted midday status", minutesAgo: 5 },
  { id: "a3", kind: "break_end", actor: "Ana Petrova", detail: "Returned from break", minutesAgo: 7 },
  { id: "a4", kind: "check_in", actor: "Diego Rivera", detail: "Started work day", minutesAgo: 12 },
  { id: "a5", kind: "dependency_created", actor: "Marek Janik", detail: "Created blocker for QA", minutesAgo: 18 },
  { id: "a6", kind: "checkin_submitted", actor: "Yuki Tanaka", detail: "Morning check-in submitted", minutesAgo: 26 },
  { id: "a7", kind: "break_start", actor: "Noor Hadid", detail: "Started break", minutesAgo: 32 },
  { id: "a8", kind: "eod_submitted", actor: "Elena Rossi", detail: "Submitted EOD report", minutesAgo: 45 },
  { id: "a9", kind: "check_out", actor: "Tomás León", detail: "Checked out for the day", minutesAgo: 64 },
];

export const managerNotifications: ManagerNotification[] = [
  { id: "n1", level: "critical", title: "2 employees absent without notice", body: "Sara K. and Noor H. have no check-in by 11:00.", time: "5m ago" },
  { id: "n2", level: "critical", title: "Dependency escalated", body: "/reports/weekly contract — 22h open.", time: "12m ago" },
  { id: "n3", level: "warning", title: "4 missing morning check-ins", body: "Send a reminder to the team?", time: "20m ago" },
  { id: "n4", level: "warning", title: "Diego is approaching 9h", body: "Working session exceeds healthy threshold.", time: "35m ago" },
  { id: "n5", level: "info", title: "Announcement scheduled", body: "Town hall posts at 16:00 today.", time: "1h ago" },
];

export const managerCalendar: CalendarItem[] = [
  { id: "c1", kind: "leave", title: "Priya on leave", date: "2026-06-29", who: "Priya Nair" },
  { id: "c2", kind: "leave", title: "Tomás on leave", date: "2026-06-30", who: "Tomás León" },
  { id: "c3", kind: "birthday", title: "Lena's birthday", date: "2026-07-02", who: "Lena Vargas" },
  { id: "c4", kind: "holiday", title: "Public holiday", date: "2026-07-04" },
  { id: "c5", kind: "meeting", title: "Town hall", date: "2026-07-03" },
];

export const managerKpis = {
  working: managerEmployees.filter((e) => e.status === "working").length,
  onBreak: managerEmployees.filter((e) => e.status === "on_break").length,
  late: managerEmployees.filter((e) => e.status === "late").length,
  absent: managerEmployees.filter((e) => e.status === "absent").length,
  pendingCheckins: managerEmployees.filter((e) => e.reports.checkin === "pending").length,
  pendingMidday: managerEmployees.filter((e) => e.reports.midday === "pending").length,
  pendingEod: managerEmployees.filter((e) => e.reports.eod === "pending").length,
  openDeps: managerBlockers.filter((b) => b.status !== "escalated").length + 6,
  blockedDeps: managerBlockers.filter((b) => b.status === "blocked").length,
  critical: managerNotifications.filter((n) => n.level === "critical").length,
};

export const managerHealth = {
  overallScore: 82,
  attendanceRate: 0.91,
  reportCompletion: 0.78,
  dependencyResolutionRate: 0.84,
  avgResponseMins: 27,
  avgWorkingHours: 7.6,
};

export const workloadByDepartment = [
  { dept: "Engineering", open: 22, completed: 41 },
  { dept: "Design", open: 7, completed: 12 },
  { dept: "Product", open: 5, completed: 9 },
  { dept: "QA", open: 9, completed: 14 },
  { dept: "DevOps", open: 4, completed: 8 },
  { dept: "Data", open: 3, completed: 6 },
];

export const trendData = {
  attendance: [88, 90, 92, 89, 91, 93, 91],
  dependencies: [12, 14, 9, 16, 11, 13, 10],
  reports: [70, 74, 78, 72, 80, 76, 78],
};

export function formatHrs(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return "—";
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
