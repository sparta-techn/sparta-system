import { describe, expect, it } from "vitest";

import type { AppRole } from "@/features/auth/types";
import {
  canArchiveProject,
  canDeleteProject,
  compareRiskSeverity,
  countCompletedMilestones,
  employeesForProject,
  highestOpenRiskSeverity,
  isCriticalRisk,
  isOpenRisk,
  isMilestoneComplete,
  isValidRiskSeverity,
  PROJECT_ARCHIVE_ROLES,
  PROJECT_DELETE_ROLES,
  projectBelongsToOneWorkspace,
  projectProgressFromMilestones,
  projectsForEmployee,
  recomputeProjectProgress,
  riskSeverityRank,
  RISK_SEVERITIES,
  taskBelongsToExactlyOneProject,
  tasksForEpic,
  tasksForMilestone,
  teamsForProject,
  withTeam,
  workspaceForProject,
  WORKSPACE_ID,
  type MilestoneLike,
  type ProjectMembership,
  type ProjectTeamLink,
  type TaskRef,
} from "./rules";

// ── R1 ───────────────────────────────────────────────────────────────────────
describe("R1: every project belongs to exactly one workspace", () => {
  it("resolves any project to the single workspace", () => {
    expect(workspaceForProject("proj-a")).toBe(WORKSPACE_ID);
    expect(workspaceForProject("proj-b")).toBe(WORKSPACE_ID);
  });

  it("a project with a workspace belongs to one; without one it does not", () => {
    expect(projectBelongsToOneWorkspace({ workspaceId: WORKSPACE_ID })).toBe(true);
    expect(projectBelongsToOneWorkspace({ workspaceId: null })).toBe(false);
    expect(projectBelongsToOneWorkspace({ workspaceId: "" })).toBe(false);
  });
});

// ── R2 ───────────────────────────────────────────────────────────────────────
describe("R2: projects can have multiple teams", () => {
  const links: ProjectTeamLink[] = [
    { projectId: "p1", teamId: "t1" },
    { projectId: "p1", teamId: "t2" },
    { projectId: "p1", teamId: "t2" }, // duplicate ignored
    { projectId: "p2", teamId: "t3" },
  ];

  it("returns every distinct team attached to a project", () => {
    expect(teamsForProject(links, "p1")).toEqual(["t1", "t2"]);
    expect(teamsForProject(links, "p2")).toEqual(["t3"]);
    expect(teamsForProject(links, "nope")).toEqual([]);
  });

  it("attaches teams without duplicating", () => {
    expect(withTeam(["t1"], "t2")).toEqual(["t1", "t2"]);
    expect(withTeam(["t1", "t2"], "t2")).toEqual(["t1", "t2"]);
  });
});

// ── R3 ───────────────────────────────────────────────────────────────────────
describe("R3: employees can belong to multiple projects", () => {
  const memberships: ProjectMembership[] = [
    { projectId: "p1", employeeId: "e1" },
    { projectId: "p2", employeeId: "e1" },
    { projectId: "p1", employeeId: "e2" },
  ];

  it("lists every distinct project an employee is on", () => {
    expect(projectsForEmployee(memberships, "e1")).toEqual(["p1", "p2"]);
    expect(projectsForEmployee(memberships, "e2")).toEqual(["p1"]);
    expect(projectsForEmployee(memberships, "e3")).toEqual([]);
  });

  it("lists every distinct employee on a project", () => {
    expect(employeesForProject(memberships, "p1")).toEqual(["e1", "e2"]);
  });
});

// ── R4 ───────────────────────────────────────────────────────────────────────
describe("R4: every task belongs to exactly one project", () => {
  it("is satisfied only with a non-empty project id", () => {
    expect(taskBelongsToExactlyOneProject({ projectId: "p1" })).toBe(true);
    expect(taskBelongsToExactlyOneProject({ projectId: null })).toBe(false);
    expect(taskBelongsToExactlyOneProject({ projectId: "  " })).toBe(false);
  });
});

// ── R5 / R6 ──────────────────────────────────────────────────────────────────
describe("R5/R6: milestones and epics group tasks", () => {
  const tasks: TaskRef[] = [
    { id: "a", projectId: "p1", milestoneId: "m1", epicId: "ep1" },
    { id: "b", projectId: "p1", milestoneId: "m1", epicId: "ep2" },
    { id: "c", projectId: "p1", milestoneId: "m2", epicId: "ep1" },
    { id: "d", projectId: "p1", milestoneId: null, epicId: null },
  ];

  it("groups tasks under a milestone", () => {
    expect(tasksForMilestone(tasks, "m1").map((t) => t.id)).toEqual(["a", "b"]);
    expect(tasksForMilestone(tasks, "m2").map((t) => t.id)).toEqual(["c"]);
    expect(tasksForMilestone(tasks, "none")).toEqual([]);
  });

  it("groups related tasks under an epic", () => {
    expect(tasksForEpic(tasks, "ep1").map((t) => t.id)).toEqual(["a", "c"]);
    expect(tasksForEpic(tasks, "ep2").map((t) => t.id)).toEqual(["b"]);
  });
});

// ── R7 ───────────────────────────────────────────────────────────────────────
describe("R7: completed milestones automatically update project progress", () => {
  const ms = (...statuses: MilestoneLike["status"][]): MilestoneLike[] =>
    statuses.map((status) => ({ status }));

  it("counts only done milestones as complete", () => {
    expect(isMilestoneComplete({ status: "done" })).toBe(true);
    expect(isMilestoneComplete({ status: "in_progress" })).toBe(false);
    expect(isMilestoneComplete({ status: "missed" })).toBe(false);
    expect(countCompletedMilestones(ms("done", "done", "upcoming"))).toBe(2);
  });

  it("derives progress as the share of completed milestones", () => {
    expect(projectProgressFromMilestones([])).toBe(0);
    expect(projectProgressFromMilestones(ms("upcoming", "in_progress"))).toBe(0);
    expect(projectProgressFromMilestones(ms("done", "upcoming"))).toBe(50);
    expect(projectProgressFromMilestones(ms("done", "done", "done", "upcoming"))).toBe(75);
    expect(projectProgressFromMilestones(ms("done", "done"))).toBe(100);
  });

  it("rounds to the nearest percent", () => {
    expect(projectProgressFromMilestones(ms("done", "upcoming", "upcoming"))).toBe(33);
  });

  it("reports whether progress changed when a milestone completes", () => {
    expect(recomputeProjectProgress(0, ms("done", "upcoming"))).toEqual({
      progress: 50,
      changed: true,
    });
    expect(recomputeProjectProgress(50, ms("done", "upcoming"))).toEqual({
      progress: 50,
      changed: false,
    });
  });
});

// ── R8 ───────────────────────────────────────────────────────────────────────
describe("R8: project risk severity is Low / Medium / High / Critical", () => {
  it("accepts exactly the four severities", () => {
    expect(RISK_SEVERITIES).toEqual(["low", "medium", "high", "critical"]);
    expect(isValidRiskSeverity("high")).toBe(true);
    expect(isValidRiskSeverity("blocker")).toBe(false);
  });

  it("orders severities low < medium < high < critical", () => {
    expect(riskSeverityRank("low")).toBeLessThan(riskSeverityRank("critical"));
    expect(compareRiskSeverity("high", "medium")).toBeGreaterThan(0);
    expect(compareRiskSeverity("low", "low")).toBe(0);
    expect(isCriticalRisk("critical")).toBe(true);
    expect(isCriticalRisk("high")).toBe(false);
  });
});

describe("overall risk level (highest open severity) — Risk Level widget", () => {
  it("treats only open/mitigating/accepted risks as open", () => {
    expect(isOpenRisk("open")).toBe(true);
    expect(isOpenRisk("mitigating")).toBe(true);
    expect(isOpenRisk("accepted")).toBe(true);
    expect(isOpenRisk("resolved")).toBe(false);
    expect(isOpenRisk("closed")).toBe(false);
  });

  it("returns the highest severity among open risks", () => {
    expect(
      highestOpenRiskSeverity([
        { severity: "low", status: "open" },
        { severity: "critical", status: "mitigating" },
        { severity: "high", status: "open" },
      ]),
    ).toBe("critical");
  });

  it("ignores resolved/closed risks", () => {
    expect(
      highestOpenRiskSeverity([
        { severity: "critical", status: "resolved" },
        { severity: "medium", status: "open" },
      ]),
    ).toBe("medium");
  });

  it("returns null when there are no open risks", () => {
    expect(highestOpenRiskSeverity([])).toBeNull();
    expect(highestOpenRiskSeverity([{ severity: "high", status: "closed" }])).toBeNull();
  });
});

// ── R9 / R10 ─────────────────────────────────────────────────────────────────
describe("R9/R10: managers archive, owners delete", () => {
  const roles = (...r: AppRole[]) => r;

  it("managers (and the project's own manager) can archive", () => {
    expect(canArchiveProject(roles("project_manager"))).toBe(true);
    expect(canArchiveProject(roles("owner"))).toBe(true);
    expect(canArchiveProject(roles("admin"))).toBe(true);
    expect(canArchiveProject(roles("employee"))).toBe(false);
    // The project's own manager may archive regardless of org role.
    expect(canArchiveProject(roles("employee"), { isProjectManager: true })).toBe(true);
  });

  it("only owners (and platform admin) can permanently delete", () => {
    expect(canDeleteProject(roles("owner"))).toBe(true);
    expect(canDeleteProject(roles("admin"))).toBe(true);
    expect(canDeleteProject(roles("project_manager"))).toBe(false);
    expect(canDeleteProject(roles("team_lead"))).toBe(false);
    expect(canDeleteProject(roles("employee"))).toBe(false);
    // A project manager who can archive still cannot delete.
    expect(canArchiveProject(roles("project_manager"))).toBe(true);
    expect(canDeleteProject(roles("project_manager"))).toBe(false);
  });

  it("keeps the archive and delete role sets distinct", () => {
    expect(PROJECT_ARCHIVE_ROLES).toContain("project_manager");
    expect(PROJECT_DELETE_ROLES).not.toContain("project_manager");
  });
});
