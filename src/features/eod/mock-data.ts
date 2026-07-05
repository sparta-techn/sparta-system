/**
 * End-of-Day — mock data for manager overview and history seeding.
 * Reuses Morning/Midday + Dependencies people where possible.
 */

import type { EodSubmission } from "./types";

export interface TeamEodEntry {
  employeeId: string;
  name: string;
  initials: string;
  department: string;
  role: string;
  submitted: boolean;
  submittedAt?: string; // HH:MM
  completionPct?: number;
  completedCount?: number;
  inProgressCount?: number;
  openDepsCount?: number;
  topBlocker?: string;
  tomorrowRisk?: string;
  helpRequest?: string;
}

export const MOCK_TEAM_EOD: TeamEodEntry[] = [
  {
    employeeId: "u-me",
    name: "Aylin K.",
    initials: "AK",
    department: "Mobile",
    role: "Flutter Developer",
    submitted: true,
    submittedAt: "18:12",
    completionPct: 100,
    completedCount: 3,
    inProgressCount: 1,
    openDepsCount: 1,
    topBlocker: "Waiting on /v2/orders pagination",
    tomorrowRisk: "Backend contract still in flux",
    helpRequest: "Backend: confirm pagination shape",
  },
  {
    employeeId: "u-emir",
    name: "Emir Y.",
    initials: "EY",
    department: "Backend",
    role: "Backend Engineer",
    submitted: true,
    submittedAt: "18:02",
    completionPct: 86,
    completedCount: 4,
    inProgressCount: 2,
    openDepsCount: 0,
    tomorrowRisk: "Deploy window collides with QA freeze",
  },
  {
    employeeId: "u-sena",
    name: "Sena B.",
    initials: "SB",
    department: "UI/UX",
    role: "Product Designer",
    submitted: true,
    submittedAt: "17:55",
    completionPct: 72,
    completedCount: 2,
    inProgressCount: 2,
    openDepsCount: 1,
    topBlocker: "Awaiting brand palette sign-off",
    helpRequest: "Product: review checkout empty states",
  },
  {
    employeeId: "u-can",
    name: "Can D.",
    initials: "CD",
    department: "QA",
    role: "QA Engineer",
    submitted: true,
    submittedAt: "18:30",
    completionPct: 57,
    completedCount: 1,
    inProgressCount: 3,
    openDepsCount: 2,
    topBlocker: "Flaky test infra in staging",
    tomorrowRisk: "Cannot certify release without DevOps fix",
    helpRequest: "DevOps: stabilise staging runner",
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
    submittedAt: "17:45",
    completionPct: 100,
    completedCount: 5,
    inProgressCount: 0,
    openDepsCount: 0,
  },
  {
    employeeId: "u-ali",
    name: "Ali R.",
    initials: "AR",
    department: "Web",
    role: "Frontend Engineer",
    submitted: true,
    submittedAt: "18:18",
    completionPct: 86,
    completedCount: 2,
    inProgressCount: 1,
    openDepsCount: 1,
    topBlocker: "API contract still in flux",
    helpRequest: "Backend: lock /reports schema",
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

/**
 * History seed — last 7 working days, used when the user has no real entries.
 * Display-only; the real store still wins when entries exist.
 */
export function generateHistorySeed(): EodSubmission[] {
  const seed: { offset: number; summary: string; completion: number; completed: number }[] = [
    {
      offset: 1,
      summary:
        "Shipped onboarding wizard state machine refactor. PR #312 merged. Caught a regression in invite acceptance and rolled in a fix.",
      completion: 100,
      completed: 4,
    },
    {
      offset: 2,
      summary:
        "Reviewed two PRs and unblocked design on checkout empty states. Started spike on realtime channel partitioning.",
      completion: 86,
      completed: 3,
    },
    {
      offset: 3,
      summary:
        "Pairing day with Emir on cursor pagination. Got /v2/orders rolling on staging. QA picked up smoke tests.",
      completion: 72,
      completed: 2,
    },
    {
      offset: 4,
      summary:
        "Mostly meetings — Q3 roadmap review and architecture sync. Closed two stale dependencies.",
      completion: 57,
      completed: 1,
    },
    {
      offset: 7,
      summary:
        "Knocked out flaky e2e for invite acceptance. Documented the fix and shared the runbook in #qa.",
      completion: 100,
      completed: 3,
    },
  ];
  const now = new Date();
  return seed.map((s, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - s.offset);
    const date = d.toISOString().slice(0, 10);
    return {
      id: `eod_seed_${i}`,
      submittedAt: new Date(d.setHours(18, 5 + i * 4, 0, 0)).toISOString(),
      workDate: date,
      summary: s.summary,
      completed: [],
      inProgress: [],
      openDependencies: [],
      needFromOthers: [],
      tomorrow: { priorities: [], tasks: [], meetings: [], expectedBlockers: [] },
      reflection: {},
      sessionSummary: {
        checkIn: "09:12",
        checkOut: "18:30",
        workedMinutes: 8 * 60 + 30,
        breakMinutes: 45,
        morningCheckInDone: true,
        middayStatusDone: true,
        dependenciesCreated: 1,
        dependenciesResolved: 2,
      },
    } satisfies EodSubmission;
  });
}
