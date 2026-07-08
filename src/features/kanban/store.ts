/**
 * Kanban store — UI-only settings (visible columns, order, WIP limits)
 * and per-column task ordering. Drag/drop status changes go through the
 * existing tasks store (`updateTask`); the Kanban module never owns task
 * state, only visual organization.
 */
import { useSyncExternalStore } from "react";
import type { TaskStatus } from "@/features/tasks/types";
import { DEFAULT_KANBAN_COLUMNS, type KanbanSettings } from "./types";

const KEY = "spartaflow:kanban:v1";

interface State {
  settings: KanbanSettings;
  /** Manual order of task ids per column. Tasks not listed fall back to default sort. */
  order: Partial<Record<TaskStatus, string[]>>;
}

function defaultState(): State {
  return {
    settings: { columns: [...DEFAULT_KANBAN_COLUMNS], wipLimits: {} },
    order: {},
  };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    const base = defaultState();
    return {
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      order: parsed.order ?? {},
    };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function useKanbanState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
    () => selector(defaultState()),
  );
}

export function setColumns(columns: TaskStatus[]) {
  state = { ...state, settings: { ...state.settings, columns } };
  emit();
}

export function toggleColumn(status: TaskStatus) {
  const has = state.settings.columns.includes(status);
  const next = has
    ? state.settings.columns.filter((c) => c !== status)
    : [...state.settings.columns, status];
  setColumns(next);
}

export function moveColumn(status: TaskStatus, direction: -1 | 1) {
  const cols = [...state.settings.columns];
  const idx = cols.indexOf(status);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= cols.length) return;
  [cols[idx], cols[target]] = [cols[target], cols[idx]];
  setColumns(cols);
}

export function setWipLimit(status: TaskStatus, limit: number) {
  state = {
    ...state,
    settings: {
      ...state.settings,
      wipLimits: { ...state.settings.wipLimits, [status]: limit },
    },
  };
  emit();
}

/**
 * Place `taskId` in `column` at `targetIndex`, removing it from any other
 * column's order list. Called by drag-and-drop.
 */
export function placeInColumn(
  taskId: string,
  column: TaskStatus,
  targetIndex: number,
  visibleIds: string[],
) {
  const cleaned: Partial<Record<TaskStatus, string[]>> = {};
  for (const [col, ids] of Object.entries(state.order)) {
    cleaned[col as TaskStatus] = (ids ?? []).filter((id) => id !== taskId);
  }
  const current = cleaned[column] ?? [];
  // Seed unknown ids so manual order is stable.
  const seeded = visibleIds.filter((id) => id !== taskId && !current.includes(id));
  const merged = [...current, ...seeded];
  const clamped = Math.max(0, Math.min(targetIndex, merged.length));
  merged.splice(clamped, 0, taskId);
  cleaned[column] = merged;
  state = { ...state, order: cleaned };
  emit();
}

export function resetSettings() {
  state = defaultState();
  emit();
}
