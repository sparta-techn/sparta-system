/**
 * Sprints store — localStorage-backed reactive facade.
 *
 * Mirrors the future Supabase repository surface. Mutations to
 * `task.sprintId` are delegated to the Tasks store so we never duplicate
 * task-ownership logic.
 */
import { useSyncExternalStore } from "react";
import { listTasks, updateTask } from "@/features/tasks/store";
import type { Task } from "@/features/tasks/types";
import { seedSprints } from "./mock-data";
import type { Sprint, SprintFilters, SprintStatus } from "./types";

const KEY = "spartaflow:sprints:v1";

interface State {
  sprints: Sprint[];
}

function defaultState(): State {
  return { sprints: seedSprints };
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
    /* ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getState() {
  return state;
}

export function useSprintsState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(defaultState()),
  );
}

// ---------- queries ----------

export function listSprints(): Sprint[] {
  return state.sprints;
}

export function getSprint(id: string): Sprint | null {
  return state.sprints.find((s) => s.id === id) ?? null;
}

export function tasksInSprint(sprintId: string): Task[] {
  return listTasks().filter((t) => t.sprintId === sprintId && !t.parentTaskId);
}

export function backlogForProject(projectId: string): Task[] {
  return listTasks().filter(
    (t) => t.projectId === projectId && !t.sprintId && !t.parentTaskId,
  );
}

// ---------- mutations ----------

export interface CreateSprintInput {
  name: string;
  projectId: string;
  startDate: string;
  endDate: string;
  goal: string;
  capacity?: number;
}

export function createSprint(input: CreateSprintInput): Sprint {
  const sprint: Sprint = {
    id: `sprint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    projectId: input.projectId,
    startDate: input.startDate,
    endDate: input.endDate,
    status: "planned",
    goal: input.goal,
    capacity: input.capacity ?? 40,
    createdAt: new Date().toISOString(),
  };
  state = { sprints: [sprint, ...state.sprints] };
  emit();
  return sprint;
}

export function updateSprint(id: string, patch: Partial<Sprint>) {
  state = {
    sprints: state.sprints.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
  emit();
}

export function setSprintStatus(id: string, status: SprintStatus) {
  updateSprint(id, { status });
}

export function deleteSprint(id: string) {
  // Detach tasks first so they fall back to the backlog.
  listTasks()
    .filter((t) => t.sprintId === id)
    .forEach((t) => updateTask(t.id, { sprintId: null }));
  state = { sprints: state.sprints.filter((s) => s.id !== id) };
  emit();
}

export function addTaskToSprint(sprintId: string, taskId: string) {
  updateTask(taskId, { sprintId });
}

export function removeTaskFromSprint(taskId: string) {
  updateTask(taskId, { sprintId: null });
}

export function addTasksToSprint(sprintId: string, taskIds: string[]) {
  taskIds.forEach((id) => addTaskToSprint(sprintId, id));
}

// ---------- filtering ----------

export function applySprintFilters(sprints: Sprint[], f: SprintFilters): Sprint[] {
  return sprints.filter((s) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.goal.toLowerCase().includes(q)) return false;
    }
    if (f.projectIds?.length && !f.projectIds.includes(s.projectId)) return false;
    if (f.statuses?.length && !f.statuses.includes(s.status)) return false;
    if (f.from && s.endDate < f.from) return false;
    if (f.to && s.startDate > f.to) return false;
    return true;
  });
}
