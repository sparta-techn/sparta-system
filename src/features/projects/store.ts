/**
 * Project store — Supabase-backed CRUD facade with an in-memory cache.
 *
 * The public API (synchronous getters + `useProjectsState`) is unchanged so the
 * components are untouched in shape; internally the cache is **hydrated from
 * Supabase** (project-execution tables + the `profiles` people directory) and
 * mutations are **written through** the repositories.
 *
 * What is connected to Supabase: projects (incl. their `client_id`), clients,
 * members, milestones, activity, and the people/department directories used by
 * the pickers.
 * What stays local-only (no backing table): templates, files, the workspace
 * settings panel, and per-project extras (favorite, environments, template) —
 * persisted to localStorage as an overlay. Derived task counts read 0 until the
 * tasks module is connected.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { employeeRepository } from "@/repositories";
import { departmentRepository } from "@/repositories/hr";
import { recordAudit } from "@/features/audit/audit-store";
import {
  clientRepository,
  milestoneRepository,
  projectActivityRepository,
  projectMemberRepository,
  projectRepository,
  projectRiskRepository,
} from "@/repositories/projects";
import { companyRepository } from "@/repositories/organization";
import { projectRolesService } from "@/services/projects";
import type { ClientUpdate, ProjectStatus as DbProjectStatus } from "@/services/projects";
import { projectProgressFromMilestones } from "@/services/projects/rules";
import { defaultWorkspace, projectTemplates as seedTemplates } from "./mock-data";
import {
  activityRowToDomain,
  clientRowToDomain,
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
  // Supabase-backed
  clients: Client[];
  companyId: string | null;
  // local-only (persisted)
  templates: ProjectTemplate[];
  workspace: WorkspaceSettings;
  overlay: Record<string, ProjectOverlay>;
  hydrated: boolean;
}

interface LocalBlob {
  templates: ProjectTemplate[];
  workspace: WorkspaceSettings;
  overlay: Record<string, ProjectOverlay>;
}

function defaultLocal(): LocalBlob {
  return {
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
    clients: [],
    companyId: null,
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
      const [projectRows, profiles, departments, roles, clientRows, company] = await Promise.all([
        projectRepository.list(),
        employeeRepository.list(),
        departmentRepository.list(),
        projectRolesService.list(),
        clientRepository.list(),
        companyRepository.getPrimary(),
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
        clients: clientRows.map(clientRowToDomain),
        companyId: company?.id ?? null,
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

/**
 * Short, user-facing detail for a failed write. Services normalize failures to a
 * `ServiceError` carrying the real Postgres/PostgREST message, so we surface that
 * verbatim instead of swallowing it — this is what makes an RLS/permission
 * rejection visible rather than a silently-vanishing row.
 */
function writeErrorDetail(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Please try again.";
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const departmentId = state.departments.find((d) => d.name === input.department)?.id ?? null;
  // Client-generated UUID = the persisted id, so the DB row and the cache row
  // share one stable id (the route the dialog navigates to stays valid).
  const id = newProjectId();

  // Persist FIRST and AWAIT — no optimistic "success". The row (and its member
  // rows) must actually land in Supabase before we treat the create as done;
  // any RLS / FK / validation failure propagates to the caller as a
  // ServiceError instead of being swallowed and silently vanishing on the next
  // hydrate. (B1-class fix: never show success for a write that did not happen.)
  const row = await projectRepository.create({
    id,
    key: input.key,
    name: input.name,
    description: input.description || undefined,
    manager_id: input.managerId,
    client_id: input.clientId ?? null,
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

  // Assign members (manager + others). Awaited so a membership failure surfaces
  // too — the Task dialog's project dropdown only lists projects where the user
  // is a member/manager, so these rows must exist for the create to be usable.
  await Promise.all(
    input.members.map((m) => projectMemberRepository.assignByRole(id, m.employeeId, m.projectRole)),
  );

  // Only now — after the writes succeeded — reflect the project in the cache.
  const created: Project = {
    ...input,
    id,
    createdAt: row.created_at,
    favorite: false,
    progress: input.progress ?? 0,
    openTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
    openDependencies: 0,
  };
  setOverlay(id, {
    environments: input.environments,
    templateId: input.templateId,
  });
  state = { ...state, projects: [created, ...state.projects] };
  emit();

  return created;
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

function persistProjectPatch(id: string, patch: Partial<Project>, restore?: () => void) {
  const corePatch: Record<string, unknown> = {};
  if (patch.managerId !== undefined) corePatch.manager_id = patch.managerId;
  if (patch.clientId !== undefined) corePatch.client_id = patch.clientId;
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
    restore?.();
    toast.error(`Couldn't save your changes. ${writeErrorDetail(err)}`);
  });
}

function reconcileMembers(
  projectId: string,
  prev: ProjectMember[],
  next: ProjectMember[],
  restore?: () => void,
) {
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
      restore?.();
      toast.error(`Couldn't update project members. ${writeErrorDetail(err)}`);
    }
  })();
}

export function updateProject(id: string, patch: Partial<Project>) {
  // Capture the previous snapshot BEFORE the optimistic overwrite so a failed
  // write-through can be rolled back (and so the member diff is computed against
  // the real prior state, not the already-applied patch).
  const prev = getProject(id);
  const prevMembers = patch.members !== undefined ? (prev?.members ?? []) : null;

  // Optimistic cache update (covers all fields incl. local-only). Keep the exact
  // object we applied so rollback only fires when no newer edit has landed since.
  let applied: Project | null = null;
  state = {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== id) return p;
      applied = { ...p, ...patch };
      return applied;
    }),
  };

  // Local-only overlay fields.
  const overlayPatch: ProjectOverlay = {};
  if (patch.favorite !== undefined) overlayPatch.favorite = patch.favorite;
  if (patch.environments !== undefined) overlayPatch.environments = patch.environments;
  if (patch.templateId !== undefined) overlayPatch.templateId = patch.templateId;
  if (Object.keys(overlayPatch).length > 0) setOverlay(id, overlayPatch);

  emit();

  // Revert the core (Supabase-backed) fields to the prior snapshot, but only if
  // our optimistic object is still the live one — a newer edit must win.
  const revert = () => {
    if (!prev) return;
    if (getProject(id) !== applied) return;
    state = { ...state, projects: state.projects.map((p) => (p.id === id ? prev : p)) };
    emit();
  };

  // Write-through to Supabase (the id is the persisted UUID).
  if (
    CORE_FIELDS.some((k) => patch[k] !== undefined) ||
    patch.department !== undefined ||
    patch.managerId !== undefined ||
    patch.clientId !== undefined
  ) {
    persistProjectPatch(id, patch, revert);
  }
  if (patch.members !== undefined && prevMembers !== null) {
    reconcileMembers(id, prevMembers, patch.members, revert);
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

export function duplicateProject(id: string): Promise<Project> | null {
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

// ---------- Clients (Supabase-backed — `clients` table) ----------

export function listClients() {
  return state.clients;
}
export function getClient(id: string) {
  return state.clients.find((c) => c.id === id) ?? null;
}

/**
 * Create a client. Persists to Supabase FIRST and AWAITs — no optimistic
 * "success". Any RLS / validation failure propagates as a ServiceError instead
 * of a row that silently vanishes on the next hydrate.
 */
export async function createClient(
  input: Omit<Client, "id" | "createdAt" | "projects" | "logoHue">,
): Promise<Client> {
  const companyId = state.companyId ?? (await companyRepository.getPrimary())?.id ?? null;
  if (!companyId) throw new Error("No company is configured to attach this client to.");

  const row = await clientRepository.create({
    company_id: companyId,
    company: input.company,
    contact_person: input.contactPerson || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    notes: input.notes || null,
    logo_hue: Math.floor(Math.random() * 360),
  });

  const client = clientRowToDomain(row);
  state = { ...state, clients: [client, ...state.clients], companyId };
  emit();
  return client;
}

/** Patch a client through Supabase, then reflect the persisted row in the cache. */
export async function updateClient(id: string, patch: Partial<Client>): Promise<Client> {
  const dbPatch: ClientUpdate = {};
  if (patch.company !== undefined) dbPatch.company = patch.company;
  if (patch.contactPerson !== undefined) dbPatch.contact_person = patch.contactPerson || null;
  if (patch.email !== undefined) dbPatch.email = patch.email || null;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone || null;
  if (patch.address !== undefined) dbPatch.address = patch.address || null;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes || null;
  if (patch.logoHue !== undefined) dbPatch.logo_hue = patch.logoHue;

  const existing = getClient(id);
  if (Object.keys(dbPatch).length === 0 && existing) return existing;

  const row = await clientRepository.update(id, dbPatch);
  const updated = clientRowToDomain(row);
  state = {
    ...state,
    // Preserve the derived `projects` array; it's computed from the project list.
    clients: state.clients.map((c) => (c.id === id ? { ...updated, projects: c.projects } : c)),
  };
  emit();
  return updated;
}

/**
 * Delete a client through Supabase. `projects.client_id` is ON DELETE SET NULL,
 * so any linked project is unlinked server-side; mirror that in the cache.
 */
export async function deleteClient(id: string): Promise<void> {
  await clientRepository.remove(id);
  state = {
    ...state,
    clients: state.clients.filter((c) => c.id !== id),
    projects: state.projects.map((p) => (p.clientId === id ? { ...p, clientId: null } : p)),
  };
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
