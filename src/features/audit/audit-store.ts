/**
 * Audit-log store — Supabase-backed, append-only, reactive.
 *
 * The single sink for security/system audit events. Emitters across the app
 * (`auth-service`, employee management, projects, settings) call
 * {@link recordAudit}; the audit viewer subscribes via {@link useAuditLog}.
 * Backed by the append-only Supabase `public.audit_logs` table (migration
 * 20260706120000): writes go through {@link recordAudit}, reads hydrate the
 * in-memory cache from the table.
 *
 * A thin in-memory cache sits in front of the table so the viewer stays
 * synchronous (`useSyncExternalStore`) and new events appear instantly:
 *   - {@link recordAudit} optimistically prepends the event to the cache and
 *     returns it synchronously, then fires a best-effort insert to Supabase.
 *   - {@link useAuditLog} hydrates the cache from the table on first subscribe.
 * Seed events remain the offline/pre-hydration default so the viewer renders
 * before the first fetch resolves.
 *
 * Recording is best-effort and MUST NOT throw into the action that triggered it
 * — every write is wrapped so a logging failure (or a dropped network insert)
 * can never break a login, deletion, or settings change.
 *
 * Persistence goes through the relaxed service-layer client ({@link db}); this
 * store is the local stand-in for a future `AuditService` (see types.ts).
 */
import { useSyncExternalStore } from "react";

import { db } from "@/services/core/client";
import {
  ACTION_CATEGORY,
  type AuditAction,
  type AuditCategory,
  type AuditEvent,
  type AuditInput,
} from "./types";
import { seedAuditEvents } from "./seed";

/** Supabase table this store reads from and writes through to. */
const TABLE = "audit_logs";
/** Keep the client-side cache bounded (the server-side table is unbounded). */
const MAX_EVENTS = 500;
const SELECT_COLS = "id, actor_id, action, entity_type, entity_id, metadata, created_at";

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

// ---------- hydration (reads) ----------

let hydrated = false;
let hydrating = false;

/**
 * Load the audit trail from Supabase into the in-memory cache, once. Best-effort:
 * on failure the seed/optimistic cache is kept so the viewer still renders.
 */
async function hydrate(): Promise<void> {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  try {
    const { data, error } = await db
      .from(TABLE)
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTS);
    if (error) throw error;
    state = { events: (data ?? []).map(rowToEvent) };
    hydrated = true;
    emit();
  } catch {
    /* keep the seed/optimistic cache when the log can't be loaded */
  } finally {
    hydrating = false;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Lazily hydrate from the table the first time the viewer mounts.
  void hydrate();
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

/** A collision-safe uuid so the optimistic id matches the persisted row's id. */
function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Row shape of `public.audit_logs` (not yet in the generated Database types). */
interface AuditRow {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Fold an {@link AuditEvent} into an insert row (rich fields spill into metadata). */
function toRow(e: AuditEvent): AuditRow {
  return {
    id: e.id,
    actor_id: e.actorId,
    action: e.action,
    entity_type: e.targetType ?? null,
    entity_id: e.target,
    metadata: {
      actor: e.actor,
      old_value: e.oldValue ?? null,
      new_value: e.newValue ?? null,
      ...(e.ip ? { ip: e.ip } : {}),
      ...(e.device ? { device: e.device } : {}),
      ...(e.meta ? { meta: e.meta } : {}),
    },
    created_at: e.at,
  };
}

/** Reconstruct an {@link AuditEvent} from a table row (category re-derived from action). */
function rowToEvent(row: AuditRow): AuditEvent {
  const meta = (row.metadata ?? {}) as {
    actor?: string;
    old_value?: string | null;
    new_value?: string | null;
    ip?: string | null;
    device?: string | null;
    meta?: Record<string, unknown>;
  };
  return {
    id: row.id,
    at: row.created_at,
    actorId: row.actor_id,
    actor: meta.actor ?? "System",
    action: row.action,
    category: ACTION_CATEGORY[row.action],
    target: row.entity_id ?? "",
    targetType: row.entity_type ?? undefined,
    oldValue: meta.old_value ?? null,
    newValue: meta.new_value ?? null,
    ip: meta.ip ?? null,
    device: meta.device ?? null,
    meta: meta.meta,
  };
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
 * Best-effort durable write-through to Supabase. Never throws — a dropped insert
 * leaves the optimistic entry in the cache until the next {@link hydrate}.
 */
async function persist(event: AuditEvent): Promise<void> {
  try {
    const { error } = await db.from(TABLE).insert(toRow(event) as never);
    if (error) throw error;
  } catch {
    /* auditing must never break the action that triggered it */
  }
}

/**
 * Append an audit event. Best-effort: never throws. Actor + timestamp default
 * from {@link setCurrentActor} but can be overridden (e.g. failed logins carry
 * the attempted email as the actor and no id).
 *
 * The event is prepended to the local cache and returned synchronously so the
 * viewer updates instantly, while the durable insert runs in the background.
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
    // Optimistic in-memory prepend (keeps the viewer synchronous & instant)…
    state = { events: [event, ...state.events].slice(0, MAX_EVENTS) };
    emit();
    // …then the durable, best-effort write-through to the append-only table.
    void persist(event);
    return event;
  } catch {
    // Auditing must never break the action that triggered it.
    return null;
  }
}

/** Test/support helper — reset the cache to seeds and allow a fresh hydrate. */
export function __resetAudit(): void {
  state = defaultState();
  hydrated = false;
  emit();
}
