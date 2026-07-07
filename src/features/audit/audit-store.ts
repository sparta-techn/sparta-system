/**
 * Audit-log store — in-memory, append-only, reactive.
 *
 * The single sink for security/system audit events. Emitters across the app
 * (`auth-service`, employee management, projects, settings) call
 * {@link recordAudit}; the audit viewer subscribes via {@link useAuditLog}.
 *
 * NOTE (MVP): the durable Supabase `public.audit_logs` table (migration
 * 20260706120000) is deferred past the MVP and is NOT applied, so this store is
 * intentionally in-memory only — no Supabase write-through and no hydration.
 * Every {@link recordAudit} prepends to a bounded in-memory cache and returns
 * synchronously; nothing touches the network. Seeded events remain the default
 * so the viewer (when re-enabled) still renders. Re-introduce the best-effort
 * write-through + hydrate against `audit_logs` when finishing the audit module
 * post-MVP.
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

/** Keep the in-memory cache bounded. */
const MAX_EVENTS = 500;

interface State {
  events: AuditEvent[];
}

function defaultState(): State {
  return { events: seedAuditEvents() };
}

let state: State = defaultState();
const listeners = new Set<() => void>();

function emit() {
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

/** The current audit actor — the signed-in user, or a "System" fallback. */
export function getCurrentActor(): { id: string | null; name: string } {
  return currentActor;
}

// ---------- helpers ----------

/** A collision-safe uuid for the event id. */
function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------- reads ----------

/** All cached events, newest first. */
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
 *
 * The event is prepended to the local cache and returned synchronously so the
 * viewer updates instantly. In-memory only for the MVP — see the file header.
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
      // Reserved — a future server-side phase fills these from request context.
      ip: null,
      device: null,
      meta: input.meta,
    };
    // Optimistic in-memory prepend (keeps the viewer synchronous & instant).
    state = { events: [event, ...state.events].slice(0, MAX_EVENTS) };
    emit();
    return event;
  } catch {
    // Auditing must never break the action that triggered it.
    return null;
  }
}

/** Test/support helper — reset the cache to seeds. */
export function __resetAudit(): void {
  state = defaultState();
  emit();
}
