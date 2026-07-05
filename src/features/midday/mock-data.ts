/**
 * Midday — mock data for manager overview and reminders.
 * Reuses Morning Check-in directory + Dependencies people where possible.
 */

import type { MiddaySubmission, TaskProgressState, EndOfDayOutlook } from "./types";

export interface TeamMiddayEntry {
  employeeId: string;
  name: string;
  initials: string;
  department: string;
  role: string;
  submitted: boolean;
  submittedAt?: string;
  progress?: number;
  focus?: string;
  outlook?: EndOfDayOutlook;
  blockerCount?: number;
  topBlocker?: string;
  needsHelp?: boolean;
}

export const MOCK_TEAM_MIDDAY: TeamMiddayEntry[] = [
  {
    employeeId: "u-me",
    name: "Aylin K.",
    initials: "AK",
    department: "Mobile",
    role: "Flutter Developer",
    submitted: true,
    submittedAt: "13:48",
    progress: 60,
    focus: "Wiring auth middleware into checkout flow",
    outlook: "on_track",
    blockerCount: 1,
    topBlocker: "Waiting on /v2/orders pagination",
    needsHelp: false,
  },
  {
    employeeId: "u-emir",
    name: "Emir Y.",
    initials: "EY",
    department: "Backend",
    role: "Backend Engineer",
    submitted: true,
    submittedAt: "14:02",
    progress: 75,
    focus: "Shipping cursor pagination to /v2/orders",
    outlook: "on_track",
    blockerCount: 0,
    needsHelp: false,
  },
  {
    employeeId: "u-sena",
    name: "Sena B.",
    initials: "SB",
    department: "Design",
    role: "Product Designer",
    submitted: true,
    submittedAt: "13:55",
    progress: 40,
    focus: "Iterating on checkout empty states",
    outlook: "need_more_time",
    blockerCount: 1,
    topBlocker: "Awaiting brand palette sign-off",
    needsHelp: false,
  },
  {
    employeeId: "u-can",
    name: "Can D.",
    initials: "CD",
    department: "QA",
    role: "QA Engineer",
    submitted: true,
    submittedAt: "14:11",
    progress: 30,
    focus: "Re-running invite acceptance e2e",
    outlook: "blocked",
    blockerCount: 2,
    topBlocker: "Flaky test infra in staging",
    needsHelp: true,
  },
  {
    employeeId: "u-mert",
    name: "Mert A.",
    initials: "MA",
    department: "DevOps",
    role: "DevOps Engineer",
    submitted: false,
  },
  {
    employeeId: "u-zeynep",
    name: "Zeynep T.",
    initials: "ZT",
    department: "PMO",
    role: "Project Manager",
    submitted: true,
    submittedAt: "13:30",
    progress: 80,
    focus: "Q3 roadmap review prep",
    outlook: "on_track",
    blockerCount: 0,
    needsHelp: false,
  },
  {
    employeeId: "u-ali",
    name: "Ali R.",
    initials: "AR",
    department: "Web",
    role: "Frontend Engineer",
    submitted: true,
    submittedAt: "14:04",
    progress: 20,
    focus: "Refactoring reports table",
    outlook: "need_manager_help",
    blockerCount: 1,
    topBlocker: "API contract still in flux",
    needsHelp: true,
  },
  {
    employeeId: "u-deniz",
    name: "Deniz S.",
    initials: "DS",
    department: "Product",
    role: "Product Manager",
    submitted: false,
  },
];

export const MOCK_TASK_PROGRESS_SEED: { taskId: string; state: TaskProgressState }[] = [
  { taskId: "T-1042", state: "partial" },
  { taskId: "T-1051", state: "not_started" },
  { taskId: "T-1038", state: "completed" },
];

/** Used when no real submission exists, for design previews. */
export const SAMPLE_MIDDAY_SUBMISSION: MiddaySubmission = {
  id: "mid_sample",
  submittedAt: new Date().toISOString(),
  workDate: new Date().toISOString().slice(0, 10),
  progress: 60,
  taskProgress: [],
  currentFocus: "Wiring auth middleware into checkout flow",
  blockerLinks: [],
  newBlockerNotes: "",
  help: { enabled: false },
  outlook: "on_track",
};
