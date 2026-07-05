/**
 * Audit-log store — localStorage-backed, append-only, reactive.
 *
 * The single sink for security/system audit events. Emitters across the app
 * (`auth-service`, employee management, projects, settings) call
 * {@link recordAudit}; the audit viewer subscribes via {@link useAuditLog}.
 * Mirrors a future append-only Supabase `audit_logs` table + `AuditService`.
 *
 * Recording is best-effort and MUST NOT throw into the action that triggered it
 * — every write is wrapped so a logging failure can never break a login,
 * deletion, or settings change.
 */
import { useSyncExternalStore } from "react";

import {
  ACTION_CATEGORY,
  type AuditAction,
  type AuditCategory,
  type AuditEvent,
  type AuditInput,
} from "./types";
import { seedAuditEvents } from "./seed";

const KEY = "spartaflow:audit:v1";
/** Keep the client-side log bounded (the real store is server-side + unbounded). */
const MAX_EVENTS = 500;

interface State {
  events: AuditEvent[];
}

function defaultState(): State {
  return { events: seedAuditEvents() };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    return { events: parsed.events ?? defaultState().events };
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

// ---------- current actor ----------

let currentActor: { id: string | null; name: string } = { id: null, name: "System" };

/** Set by the auth layer on identity load so events attribute to the real user. */
export function setCurrentActor(actor: { id: string | null; name: string } | null): void {
  currentActor = actor ?? { id: null, name: "System" };
}

// ---------- helpers ----------

function uid(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- reads ----------

/** All events, newest first. */
export function listAudit(): AuditEvent[] {
  return state.events;
}

export interface AuditFilter {
  category?: AuditCategory | "all";
  action?: AuditAction | "all";
  query?: string;
}

export function filterAudit(events: AuditEvent[], filter: AuditFilter): AuditEvent[] {
  const q = filter.query?.trim().toLowerCase();
  return events.filter((e) => {
    if (filter.category && filter.category !== "all" && e.category !== filter.category)
      return false;
    if (filter.action && filter.action !== "all" && e.action !== filter.action) return false;
    if (q) {
      const hay = [e.actor, e.target, e.oldValue ?? "", e.newValue ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function useAuditLog(): AuditEvent[] {
  return useSyncExternalStore(subscribe, listAudit, () => defaultState().events);
}

// ---------- write ----------

/**
 * Append an audit event. Best-effort: never throws. Actor + timestamp default
 * from {@link setCurrentActor} but can be overridden (e.g. failed logins carry
 * the attempted email as the actor and no id).
 */
export function recordAudit(input: AuditInput): AuditEvent | null {
  try {
    const event: AuditEvent = {
      id: uid(),
      at: new Date().toISOString(),
      actorId: input.actorId !== undefined ? input.actorId : currentActor.id,
      actor: input.actor ?? currentActor.name,
      action: input.action,
      category: ACTION_CATEGORY[input.action],
      target: input.target,
      targetType: input.targetType,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      // Reserved — the server-side phase fills these from the request context.
      ip: null,
      device: null,
      meta: input.meta,
    };
    state = { events: [event, ...state.events].slice(0, MAX_EVENTS) };
    emit();
    return event;
  } catch {
    // Auditing must never break the action that triggered it.
    return null;
  }
}

/** Test/support helper — reset to seeds. */
export function __resetAudit(): void {
  state = defaultState();
  emit();
}
