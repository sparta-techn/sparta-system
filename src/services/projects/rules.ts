/**
 * SpartaFlow project-execution business rules (pure, side-effect-free).
 *
 * Single source of truth for the structural/cardinality and permission rules of
 * the projects domain, mirrored by the schema (FKs, RLS `can_manage_project`)
 * and the repository layer. Kept dependency-free (types only) so it is trivially
 * unit-testable and reusable without pulling in Supabase.
 *
 * Rules encoded here:
 *  1. Every project belongs to exactly one Workspace (single-workspace OS).
 *  2. A project can have multiple Teams.
 *  3. An employee can belong to multiple Projects.
 *  4. Every Task belongs to exactly one Project.
 *  5. Milestones group Tasks.
 *  6. Epics group related Tasks.
 *  7. Completed Milestones automatically update Project Progress.
 *  8. Project Risk severity is one of Low / Medium / High / Critical.
 *  9. Managers can archive projects.
 * 10. Owners can permanently delete projects.
 */
import type { AppRole } from "@/features/auth/types";
import type { MilestoneStatus, PriorityLevel, RiskStatus } from "./types";

// ── Cardinality primitive ────────────────────────────────────────────────────

/** True when `parentId` references exactly one parent (a non-empty id). */
export function belongsToExactlyOne(parentId: string | null | undefined): boolean {
  return typeof parentId === "string" && parentId.trim().length > 0;
}

// ── R1: every project belongs to one Workspace ───────────────────────────────

/** Logical id of the single workspace (the `company_settings` singleton). */
export const WORKSPACE_ID = "workspace" as const;
export type WorkspaceId = typeof WORKSPACE_ID;

/** SpartaFlow is single-workspace: every project resolves to the one workspace. */
export function workspaceForProject(_projectId: string): WorkspaceId {
  return WORKSPACE_ID;
}

/** A project must belong to exactly one workspace. */
export function projectBelongsToOneWorkspace(project: { workspaceId: string | null }): boolean {
  return belongsToExactlyOne(project.workspaceId);
}

// ── R2: projects can have multiple Teams ─────────────────────────────────────

export interface ProjectTeamLink {
  projectId: string;
  teamId: string;
}

/** Distinct team ids attached to a project (may be zero, one, or many). */
export function teamsForProject(links: ProjectTeamLink[], projectId: string): string[] {
  return [...new Set(links.filter((l) => l.projectId === projectId).map((l) => l.teamId))];
}

/** Attach a team to a project's team set without duplicating. */
export function withTeam(teamIds: string[], teamId: string): string[] {
  return teamIds.includes(teamId) ? teamIds : [...teamIds, teamId];
}

// ── R3: employees can belong to multiple Projects ────────────────────────────

export interface ProjectMembership {
  projectId: string;
  employeeId: string;
}

/** Distinct project ids an employee belongs to (may be many). */
export function projectsForEmployee(
  memberships: ProjectMembership[],
  employeeId: string,
): string[] {
  return [
    ...new Set(memberships.filter((m) => m.employeeId === employeeId).map((m) => m.projectId)),
  ];
}

/** Distinct employee ids on a project. */
export function employeesForProject(memberships: ProjectMembership[], projectId: string): string[] {
  return [
    ...new Set(memberships.filter((m) => m.projectId === projectId).map((m) => m.employeeId)),
  ];
}

// ── R4/R5/R6: tasks belong to one project; grouped by milestone / epic ───────

export interface TaskRef {
  id: string;
  projectId: string | null;
  milestoneId?: string | null;
  epicId?: string | null;
}

/** Every Task belongs to exactly one Project. */
export function taskBelongsToExactlyOneProject(task: { projectId: string | null }): boolean {
  return belongsToExactlyOne(task.projectId);
}

/** Tasks grouped under a milestone (a milestone groups many tasks). */
export function tasksForMilestone(tasks: TaskRef[], milestoneId: string): TaskRef[] {
  return tasks.filter((t) => t.milestoneId === milestoneId);
}

/** Tasks grouped under an epic (an epic groups many related tasks). */
export function tasksForEpic(tasks: TaskRef[], epicId: string): TaskRef[] {
  return tasks.filter((t) => t.epicId === epicId);
}

// ── R7: completed Milestones update Project Progress ─────────────────────────

export interface MilestoneLike {
  status: MilestoneStatus;
}

/** A milestone counts as complete only when `done`. */
export function isMilestoneComplete(milestone: MilestoneLike): boolean {
  return milestone.status === "done";
}

export function countCompletedMilestones(milestones: MilestoneLike[]): number {
  return milestones.filter(isMilestoneComplete).length;
}

/**
 * Project progress (0–100) derived from completed milestones. No milestones ⇒ 0.
 * This is what "completed milestones automatically update progress" means.
 */
export function projectProgressFromMilestones(milestones: MilestoneLike[]): number {
  if (milestones.length === 0) return 0;
  return Math.round((countCompletedMilestones(milestones) / milestones.length) * 100);
}

/** The progress a project should now show, and whether it changed. */
export function recomputeProjectProgress(
  current: number,
  milestones: MilestoneLike[],
): { progress: number; changed: boolean } {
  const progress = projectProgressFromMilestones(milestones);
  return { progress, changed: progress !== current };
}

// ── R8: project risk severity scale ──────────────────────────────────────────

/** Allowed risk severities, ascending. */
export const RISK_SEVERITIES: readonly PriorityLevel[] = ["low", "medium", "high", "critical"];

export function isValidRiskSeverity(value: string): value is PriorityLevel {
  return (RISK_SEVERITIES as readonly string[]).includes(value);
}

const SEVERITY_RANK: Record<PriorityLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export function riskSeverityRank(severity: PriorityLevel): number {
  return SEVERITY_RANK[severity];
}

/** Negative if `a` is less severe than `b`, positive if more, 0 if equal. */
export function compareRiskSeverity(a: PriorityLevel, b: PriorityLevel): number {
  return riskSeverityRank(a) - riskSeverityRank(b);
}

export function isCriticalRisk(severity: PriorityLevel): boolean {
  return severity === "critical";
}

/** Risk statuses that count as still-open (not resolved/closed). */
export const OPEN_RISK_STATUSES: readonly RiskStatus[] = ["open", "mitigating", "accepted"];

export function isOpenRisk(status: RiskStatus): boolean {
  return (OPEN_RISK_STATUSES as readonly string[]).includes(status);
}

/**
 * A project's overall risk level: the highest severity among its **open** risks,
 * or `null` when there are none. Drives the "Risk Level" dashboard widget.
 */
export function highestOpenRiskSeverity(
  risks: { severity: PriorityLevel; status: RiskStatus }[],
): PriorityLevel | null {
  const open = risks.filter((r) => isOpenRisk(r.status));
  if (open.length === 0) return null;
  return open.reduce<PriorityLevel>(
    (max, r) => (compareRiskSeverity(r.severity, max) > 0 ? r.severity : max),
    open[0].severity,
  );
}

// ── R9/R10: archive (managers) vs permanently delete (owners) ────────────────

function hasAnyRole(roles: AppRole[], allowed: readonly AppRole[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

/** Roles that may archive a project (managers). Mirrors `can_manage_project`. */
export const PROJECT_ARCHIVE_ROLES: readonly AppRole[] = ["owner", "admin", "project_manager"];

/** Roles that may permanently delete a project (owners; admin = platform admin). */
export const PROJECT_DELETE_ROLES: readonly AppRole[] = ["owner", "admin"];

/**
 * Managers can archive projects. The project's own manager may archive their
 * project regardless of org role (`opts.isProjectManager`), mirroring
 * `can_manage_project`'s `manager_id = auth.uid()` branch.
 */
export function canArchiveProject(
  roles: AppRole[],
  opts: { isProjectManager?: boolean } = {},
): boolean {
  return hasAnyRole(roles, PROJECT_ARCHIVE_ROLES) || opts.isProjectManager === true;
}

/** Only owners (and platform admin) can permanently delete a project. */
export function canDeleteProject(roles: AppRole[]): boolean {
  return hasAnyRole(roles, PROJECT_DELETE_ROLES);
}
