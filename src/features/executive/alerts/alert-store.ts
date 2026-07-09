/**
 * Executive alert store — localStorage-backed reactive lifecycle layer.
 *
 * The engine (`@/services/alerts`) decides *what* is wrong; this store owns the
 * user's decisions about each alert — active / dismissed / archived — plus an
 * append-only history log. Mirrors the future Supabase surface
 * (`executive_alerts` + `executive_alert_events`); swap internals for server fns
 * without touching components.
 *
 * Merge semantics: `sync(alerts)` upserts freshly-evaluated alerts. A recurring
 * alert keeps whatever lifecycle state the user already set (a dismissed alert
 * stays dismissed) — resolved conditions simply stop being re-raised.
 */
import { useSyncExternalStore } from "react";
import type { Alert, AlertState } from "@/services/alerts";

const KEY = "spartaflow:executive-alerts:v1";

/** A stored alert = engine content + lifecycle metadata. */
export interface StoredAlert {
  alert: Alert;
  state: AlertState;
  /** ISO — first time this alert id was seen. */
  firstSeenAt: string;
  /** ISO — last state change or content refresh. */
  updatedAt: string;
  dismissedAt?: string;
  archivedAt?: string;
}

export type AlertEventKind = "raised" | "updated" | "dismissed" | "archived" | "restored";

/** Append-only lifecycle event for the history view / audit. */
export interface AlertEvent {
  id: string;
  alertId: string;
  kind: AlertEventKind;
  at: string;
  title: string;
}

interface State {
  alerts: Record<string, StoredAlert>;
  history: AlertEvent[];
}

function defaultState(): State {
  return { alerts: {}, history: [] };
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

function logEvent(alertId: string, kind: AlertEventKind, title: string, at: string) {
  state.history = [
    { id: `${alertId}:${kind}:${at}`, alertId, kind, at, title },
    ...state.history,
  ].slice(0, 500);
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Reconcile a freshly-evaluated alert set into the store. New ids are added as
 * `active`; existing ids refresh their content but keep their lifecycle state.
 */
export function sync(alerts: Alert[]): void {
  const at = new Date().toISOString();
  const next = { ...state.alerts };

  for (const alert of alerts) {
    const existing = next[alert.id];
    if (!existing) {
      next[alert.id] = { alert, state: "active", firstSeenAt: at, updatedAt: at };
      logEvent(alert.id, "raised", alert.title, at);
    } else {
      next[alert.id] = { ...existing, alert, updatedAt: at };
    }
  }

  state = { ...state, alerts: next };
  emit();
}

function setState(id: string, next: AlertState, kind: AlertEventKind) {
  const existing = state.alerts[id];
  if (!existing || existing.state === next) return;
  const at = new Date().toISOString();
  state = {
    ...state,
    alerts: {
      ...state.alerts,
      [id]: {
        ...existing,
        state: next,
        updatedAt: at,
        dismissedAt: next === "dismissed" ? at : existing.dismissedAt,
        archivedAt: next === "archived" ? at : existing.archivedAt,
      },
    },
  };
  logEvent(id, kind, existing.alert.title, at);
  emit();
}

/** Dismiss an alert (hidden from active, kept in history). */
export function dismissAlert(id: string): void {
  setState(id, "dismissed", "dismissed");
}

/** Archive an alert (retained record, out of the working set). */
export function archiveAlert(id: string): void {
  setState(id, "archived", "archived");
}

/** Restore a dismissed/archived alert back to active. */
export function restoreAlert(id: string): void {
  setState(id, "active", "restored");
}

/** Clear archived alerts entirely (history is preserved). */
export function clearArchived(): void {
  const remaining: Record<string, StoredAlert> = {};
  for (const [id, s] of Object.entries(state.alerts)) {
    if (s.state !== "archived") remaining[id] = s;
  }
  state = { ...state, alerts: remaining };
  emit();
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Slice selectors return **referentially stable** values (the underlying store
 * objects), never freshly-derived arrays. This is required by
 * `useSyncExternalStore`: a selector that allocates a new array on every
 * `getSnapshot` call makes React see the snapshot change on every check, which
 * loops until "Maximum update depth exceeded". Callers derive/filter downstream
 * (memoized) via `filterAlertsByState`.
 */
export const selectAlerts = (s: State): Record<string, StoredAlert> => s.alerts;
export const selectHistory = (s: State): AlertEvent[] => s.history;

/** Pure derivation — filter a stored-alert record by lifecycle state. */
export function filterAlertsByState(
  alerts: Record<string, StoredAlert>,
  target: AlertState,
): StoredAlert[] {
  return Object.values(alerts).filter((a) => a.state === target);
}

export function useAlertsState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(defaultState()),
  );
}

export type { State as AlertStoreState };
