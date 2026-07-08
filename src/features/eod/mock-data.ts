/**
 * End-of-Day — mock data for manager overview and history seeding.
 * Reuses Morning/Midday + Dependencies people where possible.
 */

import type { EodSubmission } from "./types";

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
