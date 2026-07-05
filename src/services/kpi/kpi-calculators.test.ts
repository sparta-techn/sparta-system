import { describe, expect, it } from "vitest";

import {
  attendanceRate,
  averageResponseTime,
  balanceIndex,
  computeCompanyKpis,
  countActiveEmployees,
  countActiveProjects,
  countBlockedTasks,
  countDelayedProjects,
  countEmployeesOnline,
  countEmployeesOnLeave,
  countMissingReports,
  dailyReportCompletion,
  deliverySuccessRate,
  productivityScore,
  projectCompletionRate,
  sprintVelocity,
  teamCapacity,
  toKpi,
  workloadDistribution,
} from "./kpi-calculators";
import type {
  AttendanceDaySnapshot,
  EmployeeStatusSnapshot,
  ProjectSnapshot,
  ReportComplianceSnapshot,
  SprintSnapshot,
  TaskSnapshot,
} from "./kpi-types";

// ── Company ──────────────────────────────────────────────────────────────────

const employees: EmployeeStatusSnapshot[] = [
  { id: "a", status: "active" },
  { id: "b", status: "active" },
  { id: "c", status: "on_leave" },
  { id: "d", status: "invited" },
  { id: "e", status: "offboarding" },
];

describe("company KPIs", () => {
  it("counts active employees", () => {
    expect(countActiveEmployees(employees)).toBe(2);
  });

  it("counts employees on leave", () => {
    expect(countEmployeesOnLeave(employees)).toBe(1);
  });

  it("counts online employees (working or on_break)", () => {
    expect(
      countEmployeesOnline([
        { userId: "a", sessionStatus: "working" },
        { userId: "b", sessionStatus: "on_break" },
        { userId: "c", sessionStatus: "finished" },
        { userId: "d", sessionStatus: "not_started" },
      ]),
    ).toBe(2);
  });

  it("computes attendance rate over expected days only, weighting half-days", () => {
    const days: AttendanceDaySnapshot[] = [
      { userId: "a", expected: true, mark: "on_time" },
      { userId: "b", expected: true, mark: "late" },
      { userId: "c", expected: true, mark: "half_day" }, // 0.5
      { userId: "d", expected: true, mark: "absent" }, // 0
      { userId: "e", expected: false, mark: "weekend" }, // excluded
    ];
    // present = 1 + 1 + 0.5 = 2.5 over 4 expected = 62.5%
    expect(attendanceRate(days)).toBe(62.5);
  });

  it("returns 0 attendance rate with no expected days", () => {
    expect(attendanceRate([{ userId: "a", expected: false, mark: "holiday" }])).toBe(0);
  });

  it("blends the productivity score with normalized weights", () => {
    expect(
      productivityScore({
        attendanceRate: 100,
        reportCompletion: 100,
        taskThroughput: 100,
        utilization: 100,
      }),
    ).toBe(100);
    // default weights .3/.2/.3/.2 → 80*.3+60*.2+40*.3+100*.2 = 24+12+12+20 = 68
    expect(
      productivityScore({
        attendanceRate: 80,
        reportCompletion: 60,
        taskThroughput: 40,
        utilization: 100,
      }),
    ).toBe(68);
  });

  it("assembles the company group with benchmark deltas", () => {
    const kpis = computeCompanyKpis({
      employees,
      presence: [{ userId: "a", sessionStatus: "working" }],
      attendance: [{ userId: "a", expected: true, mark: "on_time" }],
      productivity: {
        attendanceRate: 100,
        reportCompletion: 100,
        taskThroughput: 100,
        utilization: 100,
      },
      previous: { activeEmployees: 1 },
    });
    expect(kpis.activeEmployees.value).toBe(2);
    expect(kpis.activeEmployees.previous).toBe(1);
    expect(kpis.activeEmployees.trend).toBe("up");
    expect(kpis.employeesOnLeave.goodDirection).toBe("down");
  });
});

// ── Projects ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-07-02T00:00:00Z");

const projects: ProjectSnapshot[] = [
  { id: "p1", status: "active", health: "healthy", endDate: "2026-08-01", progress: 40 },
  { id: "p2", status: "active", health: "delayed", endDate: "2026-09-01", progress: 20 },
  { id: "p3", status: "active", health: "healthy", endDate: "2026-06-01", progress: 55 }, // past due
  {
    id: "p4",
    status: "completed",
    health: "completed",
    endDate: "2026-06-20",
    completedAt: "2026-06-18",
    progress: 100,
  },
  {
    id: "p5",
    status: "completed",
    health: "completed",
    endDate: "2026-06-20",
    completedAt: "2026-06-25",
    progress: 100,
  }, // late
  { id: "p6", status: "archived", health: "completed", endDate: "2026-01-01", progress: 100 },
  { id: "p7", status: "cancelled", health: "at_risk", endDate: "2026-01-01", progress: 10 },
];

describe("project KPIs", () => {
  it("counts active projects", () => {
    expect(countActiveProjects(projects)).toBe(3);
  });

  it("counts delayed projects (flagged or past-due, still open)", () => {
    // p2 delayed flag, p3 past due → 2
    expect(countDelayedProjects(projects, NOW)).toBe(2);
  });

  it("computes completion rate over deliverable projects (excludes archived/cancelled)", () => {
    // deliverable = p1..p5 (5); completed = p4,p5 (2) → 40%
    expect(projectCompletionRate(projects)).toBe(40);
  });

  it("computes delivery success rate over completed projects", () => {
    // completed = p4 (on time), p5 (late) → 50%
    expect(deliverySuccessRate(projects)).toBe(50);
  });
});

// ── Engineering ──────────────────────────────────────────────────────────────

const sprints: SprintSnapshot[] = [
  { id: "s1", status: "completed", endDate: "2026-06-01" },
  { id: "s2", status: "completed", endDate: "2026-06-15" },
  { id: "s3", status: "active", endDate: "2026-07-15" },
];

const tasks: TaskSnapshot[] = [
  { id: "t1", status: "done", storyPoints: 5, sprintId: "s1", assigneeId: "u1" },
  { id: "t2", status: "done", storyPoints: 3, sprintId: "s1", assigneeId: "u2" },
  { id: "t3", status: "done", storyPoints: 8, sprintId: "s2", assigneeId: "u1" },
  { id: "t4", status: "in_progress", storyPoints: 2, sprintId: "s3", assigneeId: "u1" },
  { id: "t5", status: "blocked", storyPoints: 1, sprintId: "s3", assigneeId: "u2" },
  { id: "t6", status: "todo", storyPoints: 3, sprintId: null, assigneeId: null },
];

describe("engineering KPIs", () => {
  it("averages completed story points across recent completed sprints", () => {
    // s1 = 8pts, s2 = 8pts → avg 8
    expect(sprintVelocity(sprints, tasks)).toBe(8);
  });

  it("counts blocked tasks plus blocked dependencies", () => {
    expect(countBlockedTasks(tasks)).toBe(1);
    expect(countBlockedTasks(tasks, 3)).toBe(4);
  });

  it("computes team capacity utilization", () => {
    // 2400 min = 40h logged, 2 people * 40h = 80h available → 50%
    const cap = teamCapacity(2400, 2, 40);
    expect(cap.loggedHours).toBe(40);
    expect(cap.availableHours).toBe(80);
    expect(cap.utilization).toBe(50);
  });

  it("distributes open-task workload and scores balance", () => {
    const dist = workloadDistribution(tasks);
    // open = t4(u1), t5(u2), t6(unassigned) → 1 each, perfectly even
    expect(dist.buckets).toHaveLength(3);
    expect(dist.balanceIndex).toBe(100);
  });

  it("scores a lopsided workload below 100", () => {
    expect(balanceIndex([10, 1, 1])).toBeLessThan(100);
    expect(balanceIndex([5])).toBe(100);
  });
});

// ── Reports ──────────────────────────────────────────────────────────────────

const compliance: ReportComplianceSnapshot[] = [
  { userId: "u1", workDate: "2026-07-01", expected: true, checkin: true, midday: true, eod: true }, // 3/3
  {
    userId: "u2",
    workDate: "2026-07-01",
    expected: true,
    checkin: true,
    midday: false,
    eod: false,
  }, // 1/3
  {
    userId: "u3",
    workDate: "2026-07-01",
    expected: false,
    checkin: false,
    midday: false,
    eod: false,
  }, // excluded
];

describe("report KPIs", () => {
  it("computes daily report completion over expected slots", () => {
    // submitted = 4 of 6 expected slots → 66.7%
    expect(dailyReportCompletion(compliance)).toBe(66.7);
  });

  it("counts missing report slots", () => {
    // u1 missing 0, u2 missing 2 → 2
    expect(countMissingReports(compliance)).toBe(2);
  });

  it("averages response time in minutes, ignoring bad data", () => {
    expect(
      averageResponseTime([
        { promptedAt: "2026-07-01T09:00:00Z", submittedAt: "2026-07-01T09:30:00Z" }, // 30
        { promptedAt: "2026-07-01T09:00:00Z", submittedAt: "2026-07-01T10:00:00Z" }, // 60
        { promptedAt: "2026-07-01T09:00:00Z", submittedAt: "2026-07-01T08:00:00Z" }, // negative → ignored
      ]),
    ).toBe(45);
  });
});

// ── Envelope ─────────────────────────────────────────────────────────────────

describe("toKpi envelope", () => {
  it("omits benchmark fields with no previous value", () => {
    const k = toKpi("x", "X", 10, { format: "number", goodDirection: "up" });
    expect(k.previous).toBeUndefined();
    expect(k.trend).toBeUndefined();
  });

  it("computes delta, deltaPct and trend when benchmarked", () => {
    const k = toKpi("x", "X", 12, { format: "number", goodDirection: "up", previous: 10 });
    expect(k.delta).toBe(2);
    expect(k.deltaPct).toBe(20);
    expect(k.trend).toBe("up");
  });
});
