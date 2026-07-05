/**
 * Time Tracking store — reactive, localStorage-backed.
 *
 * Mirrors the future server-fn surface: startTimer / stopTimer /
 * addManualEntry / deleteLog / updateLog. UI subscribes via the
 * exported hooks. Purely client mock — no backend writes.
 */
import { useSyncExternalStore } from "react";
import { seedTimeLogs, TIME_TRACKING_CURRENT_USER_ID } from "./mock-data";
import type { ManualEntryInput, TimeLog } from "./types";

const KEY = "spartaflow:time-tracking:v1";

interface State {
  logs: TimeLog[];
}

function defaultState(): State {
  return { logs: seedTimeLogs };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...(JSON.parse(raw) as Partial<State>) };
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
    /* quota - ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function setState(next: State) {
  state = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return state;
}

export function useTimeState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getServerSnapshot()),
  );
}

// ── ID helpers ────────────────────────────────────────────────────────────

function newId(): string {
  return `tl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Queries ───────────────────────────────────────────────────────────────

export function getAllLogs(): TimeLog[] {
  return state.logs;
}

export function getActiveLogForUser(userId: string): TimeLog | null {
  return state.logs.find((l) => l.userId === userId && l.endTime === null) ?? null;
}

export function getActiveLogForTask(taskId: string, userId: string): TimeLog | null {
  return (
    state.logs.find(
      (l) => l.taskId === taskId && l.userId === userId && l.endTime === null,
    ) ?? null
  );
}

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * Start a timer for the given task/user. If another timer is running for
 * the same user it is stopped first (single-active-timer policy).
 */
export function startTimer(
  taskId: string,
  userId: string,
  description?: string,
): TimeLog {
  let logs = state.logs;
  const existingActive = logs.find((l) => l.userId === userId && l.endTime === null);
  if (existingActive) {
    logs = stopLogInternal(logs, existingActive.id);
  }
  const now = new Date().toISOString();
  const log: TimeLog = {
    id: newId(),
    taskId,
    userId,
    startTime: now,
    endTime: null,
    durationMinutes: null,
    description: description?.trim() || null,
    source: "timer",
    createdAt: now,
  };
  setState({ logs: [...logs, log] });
  return log;
}

function stopLogInternal(logs: TimeLog[], logId: string): TimeLog[] {
  const now = Date.now();
  return logs.map((l) => {
    if (l.id !== logId || l.endTime !== null) return l;
    const start = new Date(l.startTime).getTime();
    const minutes = Math.max(1, Math.round((now - start) / 60_000));
    return {
      ...l,
      endTime: new Date(now).toISOString(),
      durationMinutes: minutes,
    };
  });
}

export function stopTimer(logId: string): void {
  setState({ logs: stopLogInternal(state.logs, logId) });
}

export function stopActiveTimerForUser(userId: string): void {
  const active = getActiveLogForUser(userId);
  if (active) stopTimer(active.id);
}

export function addManualEntry(input: ManualEntryInput): TimeLog {
  const start = new Date(`${input.date}T09:00:00`);
  const minutes = Math.max(1, Math.round(input.hours * 60));
  const end = new Date(start.getTime() + minutes * 60_000);
  const log: TimeLog = {
    id: newId(),
    taskId: input.taskId,
    userId: input.userId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes: minutes,
    description: input.description?.trim() || null,
    source: "manual",
    createdAt: new Date().toISOString(),
  };
  setState({ logs: [...state.logs, log] });
  return log;
}

export function deleteLog(logId: string): void {
  setState({ logs: state.logs.filter((l) => l.id !== logId) });
}

export function updateLogDescription(logId: string, description: string): void {
  setState({
    logs: state.logs.map((l) =>
      l.id === logId ? { ...l, description: description.trim() || null } : l,
    ),
  });
}

// ── Re-exports ────────────────────────────────────────────────────────────

export { TIME_TRACKING_CURRENT_USER_ID };
