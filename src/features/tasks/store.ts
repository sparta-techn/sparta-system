/**
 * Tasks store — Supabase-backed CRUD facade with an in-memory cache.
 *
 * The public API (synchronous getters + `useTasksState`) is unchanged in shape,
 * so components (and the Kanban module, which reads task lists through here) are
 * untouched. Internally the task cache is **hydrated from Supabase** via
 * {@link taskRepository} and mutations are **written through** it — mirroring
 * the hydrate-then-optimistic-write pattern in `features/projects/store.ts`.
 *
 * What is connected to Supabase: the durable task columns (project, title,
 * description, status, priority, assignee, parent, sprint).
 * What stays local-only (no backing column/table): every rich task field
 * (ref, labels, epic/milestone, watchers, dates, points, checklist, attachments,
 * relations, completed/archived/deleted stamps) — persisted to localStorage as a
 * per-task **overlay** and merged on top of each row — plus the auxiliary
 * catalogs (epics, milestones, comments, activity, saved filters, favorites).
 */
import { useSyncExternalStore } from "react";
import { taskRepository } from "@/repositories";
import type { TaskRow, TaskRowInsert, TaskRowUpdate } from "@/services/tasks";
import {
  seedEpics,
  seedMilestones,
  seedSavedFilters,
} from "./mock-data";
import {
  PRIORITY_WEIGHT,
  STATUS_ORDER,
  type ChecklistItem,
  type Epic,
  type SavedFilter,
  type Task,
  type TaskActivity,
  type TaskActivityKind,
  type TaskAttachment,
  type TaskComment,
  type TaskFilters,
  type TaskLabel,
  type TaskMilestone,
  type TaskRelation,
  type TaskRelationKind,
  type TaskSort,
} from "./types";

const LOCAL_KEY = "spartaflow:tasks:local:v2";

/** Per-task fields with no backing column — overlaid on top of the DB row. */
interface TaskOverlay {
  ref?: string;
  labels?: TaskLabel[];
  epicId?: string | null;
  milestoneId?: string | null;
  reporterId?: string;
  watcherIds?: string[];
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  storyPoints?: number | null;
  checklist?: ChecklistItem[];
  attachments?: TaskAttachment[];
  relatedDependencyIds?: string[];
  relations?: TaskRelation[];
  completedAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
}

interface State {
  tasks: Task[];
  // local-only catalogs (no backing table for this slice)
  epics: Epic[];
  milestones: TaskMilestone[];
  comments: TaskComment[];
  activity: TaskActivity[];
  savedFilters: SavedFilter[];
  favoriteIds: string[];
  overlay: Record<string, TaskOverlay>;
  hydrated: boolean;
}

interface LocalBlob {
  epics: Epic[];
  milestones: TaskMilestone[];
  comments: TaskComment[];
  activity: TaskActivity[];
  savedFilters: SavedFilter[];
  favoriteIds: string[];
  overlay: Record<string, TaskOverlay>;
}

function defaultLocal(): LocalBlob {
  return {
    epics: seedEpics,
    milestones: seedMilestones,
    comments: [],
    activity: [],
    savedFilters: seedSavedFilters,
    favoriteIds: [],
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
    tasks: [],
    epics: local.epics,
    milestones: local.milestones,
    comments: local.comments,
    activity: local.activity,
    savedFilters: local.savedFilters,
    favoriteIds: local.favoriteIds,
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
      epics: state.epics,
      milestones: state.milestones,
      comments: state.comments,
      activity: state.activity,
      savedFilters: state.savedFilters,
      favoriteIds: state.favoriteIds,
      overlay: state.overlay,
    };
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(blob));
  } catch {
    /* quota — ignore */
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

// ---------- Row ⇄ domain mapping ----------

function rowToTask(row: TaskRow, ov: TaskOverlay = {}): Task {
  return {
    id: row.id,
    ref: ov.ref ?? `TASK-${row.id.slice(0, 4).toUpperCase()}`,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    labels: ov.labels ?? [],
    projectId: row.project_id,
    epicId: ov.epicId ?? null,
    milestoneId: ov.milestoneId ?? null,
    sprintId: row.sprint_id,
    assigneeId: row.assignee_id,
    reporterId: ov.reporterId ?? row.created_by ?? "",
    watcherIds: ov.watcherIds ?? [],
    startDate: ov.startDate ?? null,
    dueDate: ov.dueDate ?? null,
    estimatedHours: ov.estimatedHours ?? null,
    storyPoints: ov.storyPoints ?? null,
    checklist: ov.checklist ?? [],
    attachments: ov.attachments ?? [],
    relatedDependencyIds: ov.relatedDependencyIds ?? [],
    parentTaskId: row.parent_task_id,
    relations: ov.relations ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: ov.completedAt ?? null,
    archivedAt: ov.archivedAt ?? null,
    deletedAt: ov.deletedAt ?? null,
  };
}

/** Extract the non-persisted slice of a domain task for the local overlay. */
function overlayFromTask(t: Task): TaskOverlay {
  return {
    ref: t.ref,
    labels: t.labels,
    epicId: t.epicId,
    milestoneId: t.milestoneId,
    reporterId: t.reporterId,
    watcherIds: t.watcherIds,
    startDate: t.startDate,
    dueDate: t.dueDate,
    estimatedHours: t.estimatedHours,
    storyPoints: t.storyPoints,
    checklist: t.checklist,
    attachments: t.attachments,
    relatedDependencyIds: t.relatedDependencyIds,
    relations: t.relations,
    completedAt: t.completedAt,
    archivedAt: t.archivedAt,
    deletedAt: t.deletedAt,
  };
}

function setOverlay(taskId: string, patch: TaskOverlay) {
  state = { ...state, overlay: { ...state.overlay, [taskId]: { ...(state.overlay[taskId] ?? {}), ...patch } } };
}

// ---------- Hydration ----------

let hydrating: Promise<void> | null = null;

async function hydrate() {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const rows = await taskRepository.list();
      state = {
        ...state,
        tasks: rows.map((row) => rowToTask(row, state.overlay[row.id])),
        hydrated: true,
      };
      emit();
    } catch (err) {
      // Leave the cache empty but mark hydrated so the UI shows empty states
      // rather than a perpetual blank; the error surfaces in the console.
      console.error("[tasks] Supabase hydration failed", err);
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

export function useTasksState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(defaultState()),
  );
}

// ---------- Reads ----------

export function listTasks(opts?: { includeDeleted?: boolean; includeArchived?: boolean }) {
  return state.tasks.filter((t) => {
    if (!opts?.includeDeleted && t.deletedAt) return false;
    if (!opts?.includeArchived && t.archivedAt) return false;
    return true;
  });
}

export function getTask(id: string) {
  return state.tasks.find((t) => t.id === id) ?? null;
}

export function listSubtasks(parentId: string): Task[] {
  return state.tasks.filter((t) => t.parentTaskId === parentId && !t.deletedAt);
}

export function listDescendants(rootId: string): Task[] {
  const out: Task[] = [];
  const walk = (id: string) => {
    for (const child of listSubtasks(id)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(rootId);
  return out;
}

export function commentsFor(taskId: string) {
  return state.comments.filter((c) => c.taskId === taskId);
}

export function activityFor(taskId: string) {
  return state.activity.filter((a) => a.taskId === taskId).sort((a, b) => (a.at < b.at ? 1 : -1));
}

// ---------- Activity helper ----------

function logActivity(
  taskId: string,
  actorId: string,
  kind: TaskActivityKind,
  summary: string,
  meta?: TaskActivity["meta"],
) {
  const event: TaskActivity = {
    id: `act-${taskId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    at: new Date().toISOString(),
    actorId,
    kind,
    summary,
    meta,
  };
  state = { ...state, activity: [event, ...state.activity] };
}

// ---------- Write-through helpers ----------

function newTaskId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Insert the durable columns of a freshly-created task (id is client-generated). */
function persistTaskInsert(t: Task) {
  const payload: TaskRowInsert = {
    id: t.id,
    project_id: t.projectId,
    title: t.title,
    description: t.description || null,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assigneeId,
    parent_task_id: t.parentTaskId,
    sprint_id: t.sprintId,
    // created_by is left to the DB default (auth.uid()); reporterId is kept in
    // the overlay so it survives even when it differs from the acting user.
  };
  void taskRepository.create(payload).catch((err) => {
    console.error("[tasks] createTask write-through failed", err);
  });
}

/** Write through only the backed columns present in a patch. */
function persistTaskPatch(id: string, patch: Partial<Task>) {
  const col: TaskRowUpdate = {};
  if (patch.title !== undefined) col.title = patch.title;
  if (patch.description !== undefined) col.description = patch.description || null;
  if (patch.status !== undefined) col.status = patch.status;
  if (patch.priority !== undefined) col.priority = patch.priority;
  if (patch.assigneeId !== undefined) col.assignee_id = patch.assigneeId;
  if (patch.parentTaskId !== undefined) col.parent_task_id = patch.parentTaskId;
  if (patch.sprintId !== undefined) col.sprint_id = patch.sprintId;
  if (Object.keys(col).length === 0) return;
  void taskRepository.update(id, col).catch((err) => {
    console.error("[tasks] updateTask write-through failed", err);
  });
}

const BACKED_FIELDS: Array<keyof Task> = [
  "title",
  "description",
  "status",
  "priority",
  "assigneeId",
  "parentTaskId",
  "sprintId",
];

// ---------- Writes ----------

type CreateTaskInput = Partial<Task> & {
  title: string;
  projectId: string;
  reporterId: string;
};

export function nextRef(projectKey: string) {
  const existing = state.tasks.filter((t) => t.ref.startsWith(`${projectKey}-`));
  const max = existing.reduce((m, t) => {
    const n = Number(t.ref.split("-")[1] ?? 0);
    return Number.isFinite(n) && n > m ? n : m;
  }, 99);
  return `${projectKey}-${max + 1}`;
}

export function createTask(input: CreateTaskInput, projectKey: string): Task {
  const nowIso = new Date().toISOString();
  // Client-generated UUID = the persisted id, so the optimistic row and the DB
  // row share one stable id (routes the create dialog navigates to stay valid).
  const task: Task = {
    id: newTaskId(),
    ref: nextRef(projectKey),
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    labels: input.labels ?? [],
    projectId: input.projectId,
    epicId: input.epicId ?? null,
    milestoneId: input.milestoneId ?? null,
    sprintId: input.sprintId ?? null,
    assigneeId: input.assigneeId ?? null,
    reporterId: input.reporterId,
    watcherIds: input.watcherIds ?? [],
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    estimatedHours: input.estimatedHours ?? null,
    storyPoints: input.storyPoints ?? null,
    checklist: input.checklist ?? [],
    attachments: input.attachments ?? [],
    relatedDependencyIds: input.relatedDependencyIds ?? [],
    parentTaskId: input.parentTaskId ?? null,
    relations: input.relations ?? [],
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
  };
  state = { ...state, tasks: [task, ...state.tasks] };
  setOverlay(task.id, overlayFromTask(task));
  logActivity(task.id, task.reporterId, "created", `Created ${task.ref}`);
  if (task.parentTaskId) {
    logActivity(
      task.parentTaskId,
      task.reporterId,
      "subtask_added",
      `Added subtask ${task.ref}: ${task.title}`,
    );
  }
  emit();
  persistTaskInsert(task);
  return task;
}

export function updateTask(id: string, patch: Partial<Task>, actorId?: string) {
  const current = getTask(id);
  if (!current) return;
  let completedAt = current.completedAt;
  if (patch.status === "done") {
    completedAt = current.completedAt ?? new Date().toISOString();
  } else if (patch.status !== undefined) {
    completedAt = null;
  }
  const updated: Task = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    completedAt,
  };
  state = { ...state, tasks: state.tasks.map((t) => (t.id === id ? updated : t)) };
  // Keep the local overlay in sync with the merged task (covers all unbacked fields).
  setOverlay(id, overlayFromTask(updated));

  const actor = actorId ?? current.assigneeId ?? current.reporterId;
  if (patch.status && patch.status !== current.status) {
    logActivity(id, actor, "status_changed", `Status: ${current.status} → ${patch.status}`);
  }
  if (patch.priority && patch.priority !== current.priority) {
    logActivity(id, actor, "priority_changed", `Priority: ${current.priority} → ${patch.priority}`);
  }
  if (patch.assigneeId !== undefined && patch.assigneeId !== current.assigneeId) {
    logActivity(id, actor, "assignee_changed", `Assignee updated`);
  }
  if (patch.dueDate !== undefined && patch.dueDate !== current.dueDate) {
    logActivity(id, actor, "due_date_changed", `Due date updated`);
  }
  emit();

  // Write-through to Supabase only when a backed column actually changed.
  if (BACKED_FIELDS.some((k) => patch[k] !== undefined)) {
    persistTaskPatch(id, patch);
  }
}

export function duplicateTask(id: string) {
  const src = getTask(id);
  if (!src) return null;
  const project = src.projectId;
  const projectKey = src.ref.split("-")[0] ?? "DUP";
  const copy = createTask(
    {
      ...src,
      title: `${src.title} (Copy)`,
      status: "todo",
      projectId: project,
      reporterId: src.reporterId,
      checklist: src.checklist.map((c) => ({ ...c, id: `cl-${Math.random().toString(36).slice(2, 8)}`, done: false })),
      parentTaskId: src.parentTaskId,
    },
    projectKey,
  );
  logActivity(copy.id, src.reporterId, "duplicated", `Duplicated from ${src.ref}`);
  return copy;
}

export function archiveTask(id: string, actorId?: string) {
  const t = getTask(id);
  if (!t) return;
  updateTask(id, { archivedAt: new Date().toISOString() }, actorId);
  logActivity(id, actorId ?? t.reporterId, "archived", `Archived ${t.ref}`);
}

export function restoreTask(id: string, actorId?: string) {
  const t = getTask(id);
  if (!t) return;
  updateTask(id, { archivedAt: null, deletedAt: null }, actorId);
  logActivity(id, actorId ?? t.reporterId, "restored", `Restored ${t.ref}`);
}

export function softDeleteTask(id: string) {
  const t = getTask(id);
  if (!t) return;
  updateTask(id, { deletedAt: new Date().toISOString() });
}

export function bulkUpdate(ids: string[], patch: Partial<Task>, actorId?: string) {
  ids.forEach((id) => updateTask(id, patch, actorId));
}

export function bulkArchive(ids: string[], actorId?: string) {
  ids.forEach((id) => archiveTask(id, actorId));
}

export function bulkDelete(ids: string[]) {
  ids.forEach((id) => softDeleteTask(id));
}

// ---------- Checklist ----------

export function addChecklistItem(taskId: string, text: string) {
  const t = getTask(taskId);
  if (!t) return;
  const item: ChecklistItem = { id: `cl-${Math.random().toString(36).slice(2, 8)}`, text, done: false };
  updateTask(taskId, { checklist: [...t.checklist, item] });
  logActivity(taskId, t.reporterId, "checklist_updated", `Added checklist item`);
}

export function toggleChecklistItem(taskId: string, itemId: string) {
  const t = getTask(taskId);
  if (!t) return;
  updateTask(taskId, {
    checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
  });
}

export function removeChecklistItem(taskId: string, itemId: string) {
  const t = getTask(taskId);
  if (!t) return;
  updateTask(taskId, { checklist: t.checklist.filter((c) => c.id !== itemId) });
}

// ---------- Watchers ----------

export function toggleWatcher(taskId: string, employeeId: string) {
  const t = getTask(taskId);
  if (!t) return;
  const has = t.watcherIds.includes(employeeId);
  updateTask(taskId, {
    watcherIds: has ? t.watcherIds.filter((w) => w !== employeeId) : [...t.watcherIds, employeeId],
  });
}

// ---------- Comments ----------

export function addComment(taskId: string, authorId: string, body: string) {
  const c: TaskComment = {
    id: `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    authorId,
    body,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, comments: [c, ...state.comments] };
  logActivity(taskId, authorId, "comment_added", `Commented on task`);
  emit();
}

// ---------- Relations ----------

export function linkRelation(taskId: string, otherId: string, kind: TaskRelationKind) {
  const t = getTask(taskId);
  if (!t || t.relations.some((r) => r.taskId === otherId && r.kind === kind)) return;
  updateTask(taskId, {
    relations: [...t.relations, { id: `rel-${taskId}-${otherId}-${kind}`, taskId: otherId, kind }],
  });
}

export function linkDependency(taskId: string, depId: string) {
  const t = getTask(taskId);
  if (!t || t.relatedDependencyIds.includes(depId)) return;
  updateTask(taskId, { relatedDependencyIds: [...t.relatedDependencyIds, depId] });
  logActivity(taskId, t.reporterId, "linked_dependency", `Linked dependency ${depId}`);
}

// ---------- Favorites ----------

export function toggleFavorite(taskId: string) {
  const has = state.favoriteIds.includes(taskId);
  state = {
    ...state,
    favoriteIds: has ? state.favoriteIds.filter((id) => id !== taskId) : [...state.favoriteIds, taskId],
  };
  emit();
}

export function isFavorite(taskId: string) {
  return state.favoriteIds.includes(taskId);
}

// ---------- Saved filters ----------

export function saveFilter(input: Omit<SavedFilter, "id" | "createdAt">): SavedFilter {
  const sf: SavedFilter = {
    ...input,
    id: `sf-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, savedFilters: [sf, ...state.savedFilters] };
  emit();
  return sf;
}

export function removeSavedFilter(id: string) {
  state = { ...state, savedFilters: state.savedFilters.filter((f) => f.id !== id) };
  emit();
}

// ---------- Query helpers ----------

export function applyFilters(tasks: Task[], filters: TaskFilters, sort?: TaskSort): Task[] {
  const search = filters.search?.trim().toLowerCase();
  let out = tasks.filter((t) => {
    if (!filters.includeArchived && t.archivedAt) return false;
    if (t.deletedAt) return false;
    if (filters.topLevelOnly && t.parentTaskId) return false;
    if (filters.status?.length && !filters.status.includes(t.status)) return false;
    if (filters.priority?.length && !filters.priority.includes(t.priority)) return false;
    if (filters.labels?.length && !filters.labels.some((l) => t.labels.includes(l))) return false;
    if (filters.projectIds?.length && !filters.projectIds.includes(t.projectId)) return false;
    if (filters.epicIds?.length && (!t.epicId || !filters.epicIds.includes(t.epicId))) return false;
    if (filters.milestoneIds?.length && (!t.milestoneId || !filters.milestoneIds.includes(t.milestoneId))) return false;
    if (filters.assigneeIds?.length && (!t.assigneeId || !filters.assigneeIds.includes(t.assigneeId))) return false;
    if (filters.reporterIds?.length && !filters.reporterIds.includes(t.reporterId)) return false;
    if (filters.watcherIds?.length && !filters.watcherIds.some((w) => t.watcherIds.includes(w))) return false;
    if (filters.unassignedOnly && t.assigneeId) return false;
    if (filters.overdueOnly) {
      if (!t.dueDate) return false;
      if (new Date(t.dueDate).getTime() >= Date.now()) return false;
      if (t.status === "done" || t.status === "cancelled") return false;
    }
    if (filters.hasSubtasks && !state.tasks.some((c) => c.parentTaskId === t.id && !c.deletedAt)) {
      return false;
    }
    if (search) {
      const hay = `${t.ref} ${t.title} ${t.description}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (sort) {
    const dir = sort.direction === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      switch (sort.key) {
        case "priority":
          return (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]) * dir;
        case "due": {
          const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
          const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
          return (ad - bd) * dir;
        }
        case "status":
          return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "created":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case "updated":
        default:
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
      }
    });
  }
  return out;
}
