/**
 * Mock data for the Employee Dashboard.
 * NO backend calls — purely for UI/UX scaffolding.
 */

import type { StatusKind } from "@/components/status-badge";

export type WorkStatus = "not_started" | "working" | "on_break" | "late" | "finished";

export const WORK_STATUS_META: Record<
  WorkStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "info" | "primary" }
> = {
  not_started: { label: "Not started", tone: "neutral" },
  working: { label: "Working", tone: "success" },
  on_break: { label: "On break", tone: "info" },
  late: { label: "Late", tone: "warning" },
  finished: { label: "Finished", tone: "primary" },
};

export interface MockTask {
  id: string;
  title: string;
  status: "pending" | "working" | "blocked" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string;
  progress: number;
  assignee: { name: string; initials: string };
  project: string;
}

export interface MockDependency {
  id: string;
  title: string;
  direction: "waiting" | "blocking";
  status: Extract<StatusKind, "pending" | "acknowledged" | "resolved" | "blocked">;
  counterparty: { name: string; initials: string; department: string };
  priority: "low" | "medium" | "high" | "urgent";
  createdAgo: string;
}

export interface MockActivity {
  id: string;
  kind:
    | "clock_in"
    | "task_started"
    | "task_completed"
    | "dependency_created"
    | "status_update"
    | "break"
    | "clock_out";
  title: string;
  detail?: string;
  time: string;
}

export interface MockTeammate {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: "working" | "on_break" | "late" | "offline";
}

export interface MockNotification {
  id: string;
  kind: "dependency" | "message" | "reminder" | "announcement" | "status";
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

export const mockToday = {
  workStatus: "working" as WorkStatus,
  startedAt: "09:04",
  workingSeconds: 3 * 3600 + 42 * 60,
  breakSeconds: 18 * 60,
  scheduledStart: "09:00",
};

export const mockSummary = {
  totalTasks: 7,
  completed: 3,
  pending: 4,
  dependenciesWaiting: 2,
  notifications: 5,
  hoursWorked: "3h 42m",
};

export const mockCheckIn = {
  submitted: false,
  mood: "🙂",
  focus: "Ship the dashboard polish + review 2 PRs",
  blockers: "Waiting on design tokens for chart palette",
};

export const mockMidday = {
  submitted: false,
  progress: 55,
  blockers: ["Pending design review", "Awaiting API contract"],
  changedSinceMorning: "Started checkout refactor, paused for review.",
};

export const mockTasks: MockTask[] = [
  {
    id: "T-1042",
    title: "Refactor onboarding wizard state machine",
    status: "working",
    priority: "high",
    deadline: "Today · 18:00",
    progress: 60,
    assignee: { name: "Kerem A.", initials: "KA" },
    project: "Onboarding",
  },
  {
    id: "T-1051",
    title: "Review PR #284 — Reports cursor pagination",
    status: "pending",
    priority: "medium",
    deadline: "Tomorrow",
    progress: 0,
    assignee: { name: "Kerem A.", initials: "KA" },
    project: "Platform",
  },
  {
    id: "T-1038",
    title: "Fix flaky e2e: invite acceptance flow",
    status: "blocked",
    priority: "urgent",
    deadline: "Today · 14:00",
    progress: 30,
    assignee: { name: "Kerem A.", initials: "KA" },
    project: "QA",
  },
  {
    id: "T-1020",
    title: "Draft weekly engineering digest",
    status: "completed",
    priority: "low",
    deadline: "Today",
    progress: 100,
    assignee: { name: "Kerem A.", initials: "KA" },
    project: "Comms",
  },
];

export const mockDependencies: MockDependency[] = [
  {
    id: "D-21",
    title: "Need updated brand palette tokens",
    direction: "waiting",
    status: "pending",
    counterparty: { name: "Lena V.", initials: "LV", department: "Design" },
    priority: "high",
    createdAgo: "2h ago",
  },
  {
    id: "D-22",
    title: "API contract for /reports/weekly",
    direction: "waiting",
    status: "acknowledged",
    counterparty: { name: "Omar S.", initials: "OS", department: "Backend" },
    priority: "medium",
    createdAgo: "Yesterday",
  },
  {
    id: "D-19",
    title: "Review my migration plan for user_roles",
    direction: "blocking",
    status: "pending",
    counterparty: { name: "Ana P.", initials: "AP", department: "Platform" },
    priority: "urgent",
    createdAgo: "30m ago",
  },
  {
    id: "D-18",
    title: "QA pass on invite acceptance",
    direction: "blocking",
    status: "resolved",
    counterparty: { name: "Marek J.", initials: "MJ", department: "QA" },
    priority: "low",
    createdAgo: "Yesterday",
  },
];

export const mockActivity: MockActivity[] = [
  { id: "a1", kind: "clock_in", title: "Clocked in", detail: "4 min late", time: "09:04" },
  { id: "a2", kind: "status_update", title: "Submitted morning check-in", time: "09:12" },
  {
    id: "a3",
    kind: "task_started",
    title: "Started T-1042",
    detail: "Onboarding wizard",
    time: "09:18",
  },
  {
    id: "a4",
    kind: "dependency_created",
    title: "Requested brand palette tokens from Lena V.",
    time: "10:42",
  },
  {
    id: "a5",
    kind: "task_completed",
    title: "Completed T-1020",
    detail: "Weekly digest",
    time: "11:30",
  },
  { id: "a6", kind: "break", title: "Started break", time: "12:20" },
];

export const mockTeam: MockTeammate[] = [
  { id: "u1", name: "Lena V.", initials: "LV", role: "Design", status: "working" },
  { id: "u2", name: "Omar S.", initials: "OS", role: "Backend", status: "working" },
  { id: "u3", name: "Ana P.", initials: "AP", role: "Platform", status: "on_break" },
  { id: "u4", name: "Marek J.", initials: "MJ", role: "QA", status: "working" },
  { id: "u5", name: "Sara K.", initials: "SK", role: "Product", status: "late" },
  { id: "u6", name: "Diego R.", initials: "DR", role: "Frontend", status: "working" },
  { id: "u7", name: "Yuki T.", initials: "YT", role: "Data", status: "offline" },
  { id: "u8", name: "Noor H.", initials: "NH", role: "DevOps", status: "working" },
];

export const mockNotifications: MockNotification[] = [
  {
    id: "n1",
    kind: "dependency",
    title: "New dependency assigned",
    description: "Ana P. needs your review on migration plan",
    time: "30m ago",
    unread: true,
  },
  {
    id: "n2",
    kind: "message",
    title: "Lena V. mentioned you",
    description: "“Pushed the palette draft — take a look”",
    time: "1h ago",
    unread: true,
  },
  {
    id: "n3",
    kind: "reminder",
    title: "Midday report due",
    description: "Submit your midday status by 14:00",
    time: "Soon",
    unread: true,
  },
  {
    id: "n4",
    kind: "announcement",
    title: "Town hall — Friday 16:00",
    description: "Q3 roadmap review",
    time: "Today",
    unread: false,
  },
  {
    id: "n5",
    kind: "status",
    title: "Omar S. resolved a dependency",
    description: "/reports/weekly contract shared",
    time: "Yesterday",
    unread: false,
  },
];

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
