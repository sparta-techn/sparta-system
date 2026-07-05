/**
 * Row → domain mappers bridging the Supabase project-execution tables
 * (snake_case rows from `@/services/projects` / `profiles`) to the camelCase
 * domain shapes the projects UI consumes. Keeping these here lets `store.ts`
 * swap its localStorage internals for Supabase without the components changing.
 */
import type { Profile } from "@/features/auth/types";
import type {
  MilestoneRow,
  ProjectActivityRow,
  ProjectMemberRow,
  ProjectRiskRow,
  ProjectRow,
} from "@/services/projects";
import type { Department } from "@/features/hr/mock-data";
import type {
  ActivityEvent,
  EnvironmentLink,
  Milestone,
  Person,
  Project,
  ProjectMember,
  ProjectRole,
  Risk,
} from "./types";

/** Local-only fields that have no column in the project-execution schema. */
export interface ProjectOverlay {
  favorite?: boolean;
  environments?: EnvironmentLink[];
  clientId?: string | null;
  templateId?: string;
}

/** Deterministic avatar hue from a stable id (replaces mock `avatarHue`). */
export function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/** Initials from a display name. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function profileToPerson(
  profile: Profile,
  departmentName: (id: string | null) => string,
): Person {
  const name = profile.full_name || profile.display_name || profile.email;
  return {
    id: profile.id,
    name,
    initials: initialsFrom(name),
    avatarHue: hueFromId(profile.id),
    jobTitle: profile.job_title ?? "",
    department: departmentName(profile.department_id),
  };
}

export function memberRowToDomain(
  row: ProjectMemberRow,
  roleSlug: (roleId: string | null) => ProjectRole,
): ProjectMember {
  return { employeeId: row.user_id, projectRole: roleSlug(row.project_role_id) };
}

export function projectRowToDomain(
  row: ProjectRow,
  members: ProjectMember[],
  departmentName: (id: string | null) => string,
  overlay: ProjectOverlay = {},
): Project {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? "",
    clientId: overlay.clientId ?? null,
    managerId: row.manager_id,
    members,
    department: departmentName(row.department_id) as Department,
    startDate: row.start_date ?? row.created_at.slice(0, 10),
    endDate: row.end_date ?? "",
    priority: row.priority,
    status: row.status,
    health: row.health,
    color: row.color ?? "#3B82F6",
    icon: row.icon ?? "📦",
    repositoryUrl: row.repository_url ?? undefined,
    figmaUrl: row.figma_url ?? undefined,
    apiDocsUrl: row.api_docs_url ?? undefined,
    environments: overlay.environments ?? [],
    // Derived task signals come from the tasks module (not yet connected) — 0 for now.
    progress: 0,
    openTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
    openDependencies: 0,
    templateId: overlay.templateId,
    favorite: overlay.favorite ?? false,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function milestoneRowToDomain(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    dueDate: row.due_date ?? "",
    status: row.status,
    progress: row.progress,
  };
}

/** Map the richer DB activity enum onto the narrower domain activity union. */
function mapActivityType(type: ProjectActivityRow["type"]): ActivityEvent["type"] {
  switch (type) {
    case "project_created":
    case "status_changed":
    case "member_added":
    case "member_removed":
    case "file_uploaded":
    case "report_filed":
      return type;
    case "milestone_created":
    case "milestone_reached":
      return "milestone_reached";
    case "health_changed":
      return "status_changed";
    default:
      return "report_filed";
  }
}

export function riskRowToDomain(row: ProjectRiskRow): Risk {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    severity: row.severity,
    likelihood: row.likelihood,
    status: row.status,
  };
}

export function activityRowToDomain(row: ProjectActivityRow): ActivityEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    at: row.created_at,
    actorId: row.actor_id ?? "",
    type: mapActivityType(row.type),
    summary: row.summary,
  };
}
