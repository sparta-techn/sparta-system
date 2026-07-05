/**
 * Project store — Supabase-backed CRUD facade with an in-memory cache.
 *
 * The public API (synchronous getters + `useProjectsState`) is unchanged so the
 * components are untouched in shape; internally the cache is **hydrated from
 * Supabase** (project-execution tables + the `profiles` people directory) and
 * mutations are **written through** the repositories.
 *
 * What is connected to Supabase: projects, members, milestones, activity, and
 * the people/department directories used by the pickers.
 * What stays local-only (no backing table): clients, templates, files, the
 * workspace settings panel, and per-project extras (favorite, environments,
 * client, template) — persisted to localStorage as an overlay. Derived task
 * counts read 0 until the tasks module is connected.
 */
import { useSyncExternalStore } from "react";
import { employeeRepository } from "@/repositories";
import { departmentRepository } from "@/repositories/hr";
import { recordAudit } from "@/features/audit/audit-store";
import {
  milestoneRepository,
  projectActivityRepository,
  projectMemberRepository,
  projectRepository,
  projectRiskRepository,
} from "@/repositories/projects";
import { projectRolesService } from "@/services/projects";
import type { ProjectStatus as DbProjectStatus } from "@/services/projects";
import { projectProgressFromMilestones } from "@/services/projects/rules";
import {
  clients as seedClients,
  defaultWorkspace,
  projectTemplates as seedTemplates,
} from "./mock-data";
import {
  activityRowToDomain,
  memberRowToDomain,
  milestoneRowToDomain,
  profileToPerson,
  projectRowToDomain,
  riskRowToDomain,
  type ProjectOverlay,
} from "./mappers";
import type {
  ActivityEvent,
  Client,
  Milestone,
  Person,
  Project,
  ProjectFile,
  ProjectMember,
  ProjectRole,
  ProjectTemplate,
  Risk,
  WorkspaceSettings,
} from "./types";

const LOCAL_KEY = "spartaflow:projects:local:v2";

interface DepartmentRef {
  id: string;
  name: string;
}

interface State {
  projects: Project[];
  people: Person[];
  departments: DepartmentRef[];
  milestones: Milestone[];
  risks: Risk[];
  activity: ActivityEvent[];
  files: ProjectFile[];
  // local-only (persisted)
  clients: Client[];
  templates: ProjectTemplate[];
  workspace: WorkspaceSettings;
  overlay: Record<string, ProjectOverlay>;
  hydrated: boolean;
}

interface LocalBlob {
  clients: Client[];
  templates: ProjectTemplate[];
  workspace: WorkspaceSettings;
  overlay: Record<string, ProjectOverlay>;
}

function defaultLocal(): LocalBlob {
  return {
    clients: seedClients,
    templates: seedTemplates,
    workspace: defaultWorkspace,
    overlay: {},
  };
}

function loadLocal(): LocalBlob {
  if (typeof window === "undefined") return defaultLocal();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return defaultLocal();
    return { ...defaultLocal(), ...(JSON.parse(raw) as Partial<LocalBlob>) };
  } catch {
    return defaultLocal();
  }
}

function defaultState(): State {
  const local = loadLocal();
  return {
    projects: [],
    people: [],
    departments: [],
    milestones: [],
    risks: [],
    activity: [],
    files: [],
    clients: local.clients,
    templates: local.templates,
    workspace: local.workspace,
    overlay: local.overlay,
    hydrated: false,
  };
}

let state: State = defaultState();
const listeners = new Set<() => void>();

function persistLocal() {
  if (typeof window === "undefined") return;
  try {
    const blob: LocalBlob = {
      clients: state.clients,
      templates: state.templates,
      workspace: state.workspace,
      overlay: state.overlay,
    };
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

function emit() {
  persistLocal();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getState() {
  return state;
}

// ---------- Hydration ----------

let hydrating: Promise<void> | null = null;

function departmentNameResolver(departments: DepartmentRef[]) {
  const byId = new Map(departments.map((d) => [d.id, d.name]));
  return (id: string | null) => (id ? (byId.get(id) ?? "—") : "—");
}

async function hydrate() {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const [projectRows, profiles, departments, roles] = await Promise.all([
        projectRepository.list(),
        employeeRepository.list(),
        departmentRepository.list(),
        projectRolesService.list(),
      ]);

      const deptRefs: DepartmentRef[] = departments.map((d) => ({ id: d.id, name: d.name }));
      const deptName = departmentNameResolver(deptRefs);
      const roleSlugById = new Map(roles.map((r) => [r.id, r.slug as ProjectRole]));
      const roleSlug = (roleId: string | null): ProjectRole =>
        (roleId ? roleSlugById.get(roleId) : undefined) ?? "contributor";

      const people = profiles.map((p) => profileToPerson(p, deptName));

      // Per-project children, in parallel.
      const perProject = await Promise.all(
        projectRows.map(async (row) => {
          const [memberRows, milestoneRows, activityRows, riskRows] = await Promise.all([
            projectMemberRepository.listMembers(row.id),
            milestoneRepository.listForProject(row.id),
            projectActivityRepository.listForProject(row.id),
            projectRiskRepository.listForProject(row.id),
          ]);
          const members = memberRows.map((m) => memberRowToDomain(m, roleSlug));
          const milestones = milestoneRows.map(milestoneRowToDomain);
          const base = projectRowToDomain(row, members, deptName, state.overlay[row.id]);
          return {
            // R7: completed milestones automatically drive project progress.
            project: { ...base, progress: projectProgressFromMilestones(milestones) },
            milestones,
            risks: riskRows.map(riskRowToDomain),
            activity: activityRows.map(activityRowToDomain),
          };
        }),
      );

      state = {
        ...state,
        projects: perProject.map((p) => p.project),
        people,
        departments: deptRefs,
        milestones: perProject.flatMap((p) => p.milestones),
        risks: perProject.flatMap((p) => p.risks),
        activity: perProject.flatMap((p) => p.activity),
        hydrated: true,
      };
      emit();
    } catch (err) {
      // Leave the cache empty but mark hydrated so the UI shows empty states
      // rather than a perpetual blank; the error surfaces in the console.
      console.error("[projects] Supabase hydration failed", err);
      state = { ...state, hydrated: true };
      emit();
    } finally {
      hydrating = null;
    }
  })();
  return hydrating;
}

if (typeof window !== "undefined") {
  void hydrate();
}

export function useProjectsState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(defaultState()),
  );
}

// ---------- People / departments (Supabase directory) ----------

export function listPeople() {
  return state.people;
}

export function personById(id: string): Person | null {
  return state.people.find((p) => p.id === id) ?? null;
}

export function listDepartments() {
  return state.departments;
}

// ---------- Projects ----------

export function listProjects() {
  return state.projects;
}

export function getProject(id: string) {
  return state.projects.find((p) => p.id === id) ?? null;
}

export function generateProjectKey(name: string) {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "");
  if (!cleaned) return "NEW";
  const words = cleaned.split(/\s+/).filter(Boolean);
  const key =
    words.length === 1
      ? cleaned.slice(0, 3)
      : words
          .map((w) => w[0])
          .join("")
          .slice(0, 4);
  const existing = new Set(state.projects.map((p) => p.key));
  let candidate = key;
  let i = 2;
  while (existing.has(candidate)) {
    candidate = `${key}${i}`;
    i += 1;
  }
  return candidate;
}

function setOverlay(projectId: string, patch: ProjectOverlay) {
  const next = { ...(state.overlay[projectId] ?? {}), ...patch };
  state = { ...state, overlay: { ...state.overlay, [projectId]: next } };
}

type CreateProjectInput = Omit<
  Project,
  | "id"
  | "createdAt"
  | "favorite"
  | "progress"
  | "openTasks"
  | "completedTasks"
  | "overdueTasks"
  | "totalTasks"
  | "openDependencies"
> &
  Partial<Pick<Project, "progress">>;

function newProjectId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `proj-${Date.now().toString(36)}`;
}

export function createProject(input: CreateProjectInput): Project {
  const departmentId = state.departments.find((d) => d.name === input.department)?.id ?? null;
  // Client-generated UUID = the persisted id, so the optimistic row and the DB
  // row share one stable id (the route the dialog navigates to stays valid).
  const id = newProjectId();
  const optimistic: Project = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    favorite: false,
    progress: input.progress ?? 0,
    openTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
    openDependencies: 0,
  };
  state = { ...state, projects: [optimistic, ...state.projects] };
  setOverlay(id, {
    environments: input.environments,
    clientId: input.clientId,
    templateId: input.templateId,
  });
  emit();

  void (async () => {
    try {
      const row = await projectRepository.create({
        id,
        key: input.key,
        name: input.name,
        description: input.description || undefined,
        manager_id: input.managerId,
        department_id: departmentId,
        priority: input.priority,
        status: input.status as DbProjectStatus,
        health: input.health,
        start_date: input.startDate || undefined,
        end_date: input.endDate || undefined,
        color: input.color,
        icon: input.icon,
        repository_url: input.repositoryUrl,
        figma_url: input.figmaUrl,
        api_docs_url: input.apiDocsUrl,
      });
      // Assign members (manager + others) against project_members.
      await Promise.all(
        input.members.map((m) =>
          projectMemberRepository.assignByRole(id, m.employeeId, m.projectRole),
        ),
      );
      // Sync server-authored fields; the id is unchanged.
      state = {
        ...state,
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, createdAt: row.created_at } : p,
        ),
      };
      emit();
    } catch (err) {
      console.error("[projects] createProject write-through failed", err);
    }
  })();

  return optimistic;
}

const CORE_FIELDS: Array<keyof Project> = [
  "name",
  "description",
  "status",
  "health",
  "priority",
  "startDate",
  "endDate",
  "color",
  "icon",
  "repositoryUrl",
  "figmaUrl",
  "apiDocsUrl",
];

function persistProjectPatch(id: string, patch: Partial<Project>) {
  const corePatch: Record<string, unknown> = {};
  if (patch.managerId !== undefined) corePatch.manager_id = patch.managerId;
  if (patch.name !== undefined) corePatch.name = patch.name;
  if (patch.description !== undefined) corePatch.description = patch.description;
  if (patch.status !== undefined) corePatch.status = patch.status;
  if (patch.health !== undefined) corePatch.health = patch.health;
  if (patch.priority !== undefined) corePatch.priority = patch.priority;
  if (patch.startDate !== undefined) corePatch.start_date = patch.startDate;
  if (patch.endDate !== undefined) corePatch.end_date = patch.endDate;
  if (patch.color !== undefined) corePatch.color = patch.color;
  if (patch.icon !== undefined) corePatch.icon = patch.icon;
  if (patch.repositoryUrl !== undefined) corePatch.repository_url = patch.repositoryUrl;
  if (patch.figmaUrl !== undefined) corePatch.figma_url = patch.figmaUrl;
  if (patch.apiDocsUrl !== undefined) corePatch.api_docs_url = patch.apiDocsUrl;
  if (patch.department !== undefined) {
    corePatch.department_id =
      state.departments.find((d) => d.name === patch.department)?.id ?? null;
  }
  if (Object.keys(corePatch).length === 0) return;
  void projectRepository.update(id, corePatch).catch((err) => {
    console.error("[projects] updateProject write-through failed", err);
  });
}

function reconcileMembers(projectId: string, prev: ProjectMember[], next: ProjectMember[]) {
  const prevById = new Map(prev.map((m) => [m.employeeId, m]));
  const nextById = new Map(next.map((m) => [m.employeeId, m]));
  void (async () => {
    try {
      // Removed
      for (const m of prev) {
        if (!nextById.has(m.employeeId)) {
          await projectMemberRepository.remove(projectId, m.employeeId);
        }
      }
      // Added or role-changed
      for (const m of next) {
        const before = prevById.get(m.employeeId);
        if (!before) {
          await projectMemberRepository.assignByRole(projectId, m.employeeId, m.projectRole);
        } else if (before.projectRole !== m.projectRole) {
          const membership = await projectMemberRepository.getMembership(projectId, m.employeeId);
          if (membership) {
            const role = await projectRolesService.getBySlug(m.projectRole);
            await projectMemberRepository.setRole(membership.id, role?.id ?? null);
          }
        }
      }
    } catch (err) {
      console.error("[projects] member reconciliation failed", err);
    }
  })();
}

export function updateProject(id: string, patch: Partial<Project>) {
  // Capture previous members BEFORE the optimistic overwrite so the write-through
  // diff is computed against the real prior state, not the already-applied patch.
  const prevMembers = patch.members !== undefined ? (getProject(id)?.members ?? []) : null;

  // Optimistic cache update (covers all fields incl. local-only).
  state = {
    ...state,
    projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };

  // Local-only overlay fields.
  const overlayPatch: ProjectOverlay = {};
  if (patch.favorite !== undefined) overlayPatch.favorite = patch.favorite;
  if (patch.environments !== undefined) overlayPatch.environments = patch.environments;
  if (patch.clientId !== undefined) overlayPatch.clientId = patch.clientId;
  if (patch.templateId !== undefined) overlayPatch.templateId = patch.templateId;
  if (Object.keys(overlayPatch).length > 0) setOverlay(id, overlayPatch);

  emit();

  // Write-through to Supabase (the id is the persisted UUID).
  if (
    CORE_FIELDS.some((k) => patch[k] !== undefined) ||
    patch.department !== undefined ||
    patch.managerId !== undefined
  ) {
    persistProjectPatch(id, patch);
  }
  if (patch.members !== undefined && prevMembers !== null) {
    reconcileMembers(id, prevMembers, patch.members);
  }
}

export function toggleFavorite(id: string) {
  const current = getProject(id);
  if (!current) return;
  updateProject(id, { favorite: !current.favorite });
}

export function archiveProject(id: string) {
  const current = getProject(id);
  updateProject(id, { status: "archived", archivedAt: new Date().toISOString() });
  if (current) {
    recordAudit({
      action: "project_deleted",
      target: current.name,
      targetType: "project",
      oldValue: current.status,
      newValue: "archived",
    });
  }
}

export function duplicateProject(id: string) {
  const src = getProject(id);
  if (!src) return null;
  return createProject({
    ...src,
    key: generateProjectKey(`${src.name} Copy`),
    name: `${src.name} (Copy)`,
    status: "planning",
    health: "healthy",
  });
}

// ---------- Clients (local-only — no backing table) ----------

export function listClients() {
  return state.clients;
}
export function getClient(id: string) {
  return state.clients.find((c) => c.id === id) ?? null;
}
export function createClient(input: Omit<Client, "id" | "createdAt" | "projects" | "logoHue">) {
  const client: Client = {
    ...input,
    id: `cli-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    projects: [],
    logoHue: Math.floor(Math.random() * 360),
  };
  state = { ...state, clients: [client, ...state.clients] };
  emit();
  return client;
}
export function updateClient(id: string, patch: Partial<Client>) {
  state = { ...state, clients: state.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
  emit();
}

// ---------- Templates (local-only — no backing table) ----------
export function listTemplates() {
  return state.templates;
}
export function getTemplate(id: string) {
  return state.templates.find((t) => t.id === id) ?? null;
}
export function createTemplate(input: Omit<ProjectTemplate, "id" | "usageCount">) {
  const tpl: ProjectTemplate = { ...input, id: `tpl-${Date.now().toString(36)}`, usageCount: 0 };
  state = { ...state, templates: [...state.templates, tpl] };
  emit();
  return tpl;
}

// ---------- Workspace (local-only panel) ----------
export function getWorkspace() {
  return state.workspace;
}
export function updateWorkspace(patch: Partial<WorkspaceSettings>) {
  state = { ...state, workspace: { ...state.workspace, ...patch } };
  emit();
}

// ---------- Activity / milestones / files ----------
export function pushActivity(event: ActivityEvent) {
  state = { ...state, activity: [event, ...state.activity] };
  emit();
}
export function activityFor(projectId: string) {
  return state.activity.filter((a) => a.projectId === projectId);
}
export function milestonesFor(projectId: string) {
  return state.milestones.filter((m) => m.projectId === projectId);
}
export function risksFor(projectId: string) {
  return state.risks.filter((r) => r.projectId === projectId);
}
export function filesFor(projectId: string) {
  return state.files.filter((f) => f.projectId === projectId);
}
