/**
 * Seed input for the Executive Alert Engine.
 *
 * Shaped to exercise all seven rules. Going live means replacing this with an
 * adapter over the Supabase rows / feature stores — the engine and store are
 * untouched. Kept consistent with the dashboard's project/risk seed data.
 */
import type { AlertEngineInput } from "@/services/alerts";

export const alertEngineInput: AlertEngineInput = {
  now: new Date("2026-07-02T09:00:00Z"),
  projects: [
    {
      id: "orbit",
      name: "Orbit Platform",
      status: "active",
      health: "blocked",
      endDate: "2026-06-25",
      progress: 27,
    },
    {
      id: "atlas",
      name: "Atlas Migration",
      status: "active",
      health: "delayed",
      endDate: "2026-06-27",
      progress: 33,
    },
    {
      id: "etb",
      name: "ETB Web",
      status: "active",
      health: "healthy",
      endDate: "2026-08-15",
      progress: 62,
    },
  ],
  sprints: [
    {
      id: "s-41",
      name: "Sprint 41",
      status: "active",
      endDate: "2026-06-27",
      totalTasks: 30,
      doneTasks: 17,
    },
    {
      id: "s-42",
      name: "Sprint 42",
      status: "active",
      endDate: "2026-07-11",
      totalTasks: 28,
      doneTasks: 9,
    },
  ],
  reports: [
    { userId: "emp-7", name: "Priya S.", expected: true, missingReports: 3, missedDays: 3 },
    { userId: "emp-12", name: "Owen T.", expected: true, missingReports: 2, missedDays: 1 },
    { userId: "emp-3", name: "Dana L.", expected: true, missingReports: 1, missedDays: 1 },
  ],
  attendance: [
    { userId: "emp-9", name: "Sami R.", lateCount: 4, absentCount: 2, windowDays: 14 },
    { userId: "emp-21", name: "Jae M.", lateCount: 3, absentCount: 0, windowDays: 14 },
  ],
  workload: [
    { assigneeId: "eng-0", name: "Mala K.", openTasks: 19 },
    { assigneeId: "eng-1", name: "Leo P.", openTasks: 13 },
    { assigneeId: "eng-2", name: "Ada N.", openTasks: 7 },
  ],
  blockers: [
    {
      id: "dep-88",
      title: "Payments API contract unresolved",
      projectName: "Orbit Platform",
      priority: "critical",
      ageDays: 4,
      isBlocking: true,
    },
    {
      id: "dep-91",
      title: "Staging environment access",
      projectName: "Atlas Migration",
      priority: "high",
      ageDays: 3,
      isBlocking: false,
    },
    {
      id: "dep-95",
      title: "Copy review for onboarding",
      projectName: "ETB Web",
      priority: "medium",
      ageDays: 5,
      isBlocking: false,
    },
  ],
  aiRisks: [
    {
      id: "risk-eod",
      title: "End-of-day reporting trending below target",
      severity: "medium",
      area: "reports",
      evidence: "EoD completion at 71% vs 75% target for 3 days.",
    },
    {
      id: "risk-capacity",
      title: "Nova Mobile capacity shortfall next sprint",
      severity: "high",
      area: "engineering",
      evidence: "Committed scope exceeds recent velocity by ~20%.",
    },
  ],
};
