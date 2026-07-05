/**
 * Tasks store — localStorage-backed reactive facade.
 *
 * Mirrors the future Supabase repository surface. Consumers call these
 * functions; UI subscribes via `useTasksState`. Replace internals with
 * server fns once persistence lands without touching component code.
 */
import { useSyncExternalStore } from "react";
import {
  seedActivity,
  seedComments,
  seedEpics,
  seedFavoriteIds,
  seedMilestones,
  seedSavedFilters,
  seedTasks,
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
  type TaskComment,
  type TaskFilters,
  type TaskMilestone,
  type TaskRelationKind,
  type TaskSort,
} from "./types";

const KEY = "spartaflow:tasks:v1";

interface State {
  tasks: Task[];
  epics: Epic[];
  milestones: TaskMilestone[];
  comments: TaskComment[];
  activity: TaskActivity[];
  savedFilters: SavedFilter[];
  favoriteIds: string[];
}

function defaultState(): State {
  return {
    tasks: seedTasks,
    epics: seedEpics,
    milestones: seedMilestones,
    comments: seedComments,
    activity: seedActivity,
    savedFilters: seedSavedFilters,
    favoriteIds: seedFavoriteIds,
  };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
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
  const task: Task = {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
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
