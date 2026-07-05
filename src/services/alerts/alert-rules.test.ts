import { describe, expect, it } from "vitest";

import { executiveAlertEngine } from "./alert-engine";
import {
  attendanceAnomalyRule,
  criticalBlockerRule,
  highWorkloadRule,
  missingReportsRule,
  projectOverdueRule,
  sprintDelayedRule,
} from "./alert-rules";
import { DEFAULT_THRESHOLDS, type AlertEngineInput } from "./alert-types";

const NOW = new Date("2026-07-02T00:00:00Z");
const RAISED = NOW.toISOString();

describe("project overdue rule", () => {
  it("raises for open projects past their end date, skips closed ones", () => {
    const alerts = projectOverdueRule(
      [
        {
          id: "a",
          name: "A",
          status: "active",
          health: "healthy",
          endDate: "2026-06-01",
          progress: 50,
        },
        {
          id: "b",
          name: "B",
          status: "active",
          health: "healthy",
          endDate: "2026-08-01",
          progress: 50,
        }, // future
        {
          id: "c",
          name: "C",
          status: "completed",
          health: "completed",
          endDate: "2026-01-01",
          progress: 100,
        },
      ],
      NOW,
      RAISED,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["a"]);
    expect(alerts[0].type).toBe("project_overdue");
  });

  it("escalates to critical when >14 days overdue or blocked", () => {
    const [alert] = projectOverdueRule(
      [
        {
          id: "x",
          name: "X",
          status: "active",
          health: "blocked",
          endDate: "2026-06-30",
          progress: 20,
        },
      ],
      NOW,
      RAISED,
    );
    expect(alert.severity).toBe("critical");
    expect(alert.priority).toBe("urgent");
  });
});

describe("sprint delayed rule", () => {
  it("raises only for active sprints past end with remaining work", () => {
    const alerts = sprintDelayedRule(
      [
        {
          id: "s1",
          name: "S1",
          status: "active",
          endDate: "2026-06-20",
          totalTasks: 10,
          doneTasks: 4,
        },
        {
          id: "s2",
          name: "S2",
          status: "active",
          endDate: "2026-06-20",
          totalTasks: 10,
          doneTasks: 10,
        }, // done
        {
          id: "s3",
          name: "S3",
          status: "completed",
          endDate: "2026-06-20",
          totalTasks: 10,
          doneTasks: 5,
        },
      ],
      NOW,
      RAISED,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["s1"]);
    expect(alerts[0].evidence).toBe("60% work remaining");
  });
});

describe("missing reports rule", () => {
  it("raises at/over the threshold for expected employees", () => {
    const alerts = missingReportsRule(
      [
        { userId: "u1", name: "U1", expected: true, missingReports: 3, missedDays: 3 },
        { userId: "u2", name: "U2", expected: true, missingReports: 1 }, // below threshold
        { userId: "u3", name: "U3", expected: false, missingReports: 3 }, // not expected
      ],
      DEFAULT_THRESHOLDS,
      RAISED,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["u1"]);
    expect(alerts[0].severity).toBe("high");
  });
});

describe("attendance anomaly rule", () => {
  it("raises on absence or lateness over thresholds", () => {
    const alerts = attendanceAnomalyRule(
      [
        { userId: "u1", name: "U1", lateCount: 0, absentCount: 2, windowDays: 14 }, // absence
        { userId: "u2", name: "U2", lateCount: 3, absentCount: 0, windowDays: 14 }, // lateness
        { userId: "u3", name: "U3", lateCount: 1, absentCount: 1, windowDays: 14 }, // below both
      ],
      DEFAULT_THRESHOLDS,
      RAISED,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["u1", "u2"]);
    expect(alerts[0].severity).toBe("high"); // absence-driven
  });
});

describe("high workload rule", () => {
  it("raises over the threshold and escalates at 1.5x", () => {
    const alerts = highWorkloadRule(
      [
        { assigneeId: "e1", name: "E1", openTasks: 19 }, // >= 18 → high
        { assigneeId: "e2", name: "E2", openTasks: 13 }, // medium
        { assigneeId: "e3", name: "E3", openTasks: 7 }, // below
      ],
      DEFAULT_THRESHOLDS,
      RAISED,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["e1", "e2"]);
    expect(alerts[0].severity).toBe("high");
    expect(alerts[1].severity).toBe("medium");
  });
});

describe("critical blocker rule", () => {
  it("raises for critical, or aged high-priority blockers", () => {
    const alerts = criticalBlockerRule(
      [
        { id: "d1", title: "D1", priority: "critical", ageDays: 1 },
        { id: "d2", title: "D2", priority: "high", ageDays: 3 }, // aged high
        { id: "d3", title: "D3", priority: "high", ageDays: 1 }, // fresh high → skip
        { id: "d4", title: "D4", priority: "medium", ageDays: 9 }, // skip
      ],
      DEFAULT_THRESHOLDS,
      RAISED,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["d1", "d2"]);
    expect(alerts[0].severity).toBe("critical");
  });
});

describe("engine", () => {
  const input: AlertEngineInput = {
    now: NOW,
    projects: [
      {
        id: "p",
        name: "P",
        status: "active",
        health: "blocked",
        endDate: "2026-06-01",
        progress: 20,
      },
    ],
    aiRisks: [
      { id: "r", title: "AI risk", severity: "critical", area: "engineering", evidence: "e" },
    ],
  };

  it("aggregates rules and ranks by priority then severity", () => {
    const alerts = executiveAlertEngine.evaluate(input);
    expect(alerts).toHaveLength(2);
    // Critical project overdue (urgent) ranks above the capped AI risk (high).
    expect(alerts[0].type).toBe("project_overdue");
    expect(alerts[0].priority).toBe("urgent");
    expect(alerts[1].type).toBe("ai_risk");
    expect(alerts[1].priority).toBe("high"); // AI critical is capped one notch
  });

  it("produces stable dedupe ids", () => {
    const first = executiveAlertEngine.evaluate(input);
    const second = executiveAlertEngine.evaluate(input);
    expect(first.map((a) => a.id)).toEqual(second.map((a) => a.id));
    expect(first[0].id).toBe("project_overdue:p");
  });
});
