/**
 * Supabase Realtime infrastructure (framework-agnostic).
 *
 * A small manager over Realtime channels that adds the three things raw
 * `supabase.channel(...)` does not give you for free:
 *
 *  1. **Ref-counted channels** — N callers subscribing to the same
 *     `(table, event, filter)` share ONE socket subscription; the channel is
 *     torn down when the last caller unsubscribes. Keeps the client on the
 *     minimum set of relevant channels.
 *  2. **Graceful reconnects** — the socket auto-reconnects; this manager tracks
 *     per-channel status, marks channels stale on `offline` / errors, and fires
 *     an `onResync` callback once a channel re-subscribes so callers can refetch
 *     anything they missed while disconnected.
 *  3. **Auth sync** — the Realtime token is kept in step with the auth session
 *     so RLS-scoped `postgres_changes` keep flowing across token refreshes.
 *
 * React usage lives in `src/hooks/use-realtime.ts` (auto-unsubscribe on unmount)
 * and `src/features/realtime/hooks.ts` (per-domain hooks).
 */
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";
export type RealtimeStatus = "subscribed" | "reconnecting" | "error" | "closed";

/** Tables added to the `supabase_realtime` publication (migration 20260701130000). */
export const PUBLISHED_TABLES: ReadonlySet<string> = new Set([
  "notifications",
  "mentions",
  "activity_feed",
  "approval_requests",
  "dependency_requests",
  "daily_reports",
  "daily_status_updates",
  "attendance",
  "attendance_sessions",
  "break_sessions",
  "work_sessions",
  "work_session_breaks",
  // NOT YET published (tables don't exist): "tasks", "comments".
]);

export interface TableSubscription<Row extends Record<string, unknown> = Record<string, unknown>> {
  /** Table name. */
  table: string;
  /** Schema; defaults to `public`. */
  schema?: string;
  /** Row event(s) to listen for; defaults to `*`. */
  event?: PostgresEvent;
  /** PostgREST-style filter, e.g. `recipient_id=eq.<uuid>`. */
  filter?: string;
  /** Called for each matching change. */
  onChange: (payload: RealtimePostgresChangesPayload<Row>) => void;
  /** Called after a reconnect so the caller can refetch missed rows. */
  onResync?: () => void;
  /** Channel status transitions (subscribed / reconnecting / error / closed). */
  onStatus?: (status: RealtimeStatus) => void;
}

interface Handler {
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onResync?: () => void;
  onStatus?: (status: RealtimeStatus) => void;
}

interface Entry {
  channel: RealtimeChannel;
  handlers: Set<Handler>;
  /** True once the channel has errored / gone offline since last SUBSCRIBED. */
  stale: boolean;
}

function keyFor(sub: Pick<TableSubscription, "schema" | "table" | "event" | "filter">): string {
  return `${sub.schema ?? "public"}.${sub.table}:${sub.event ?? "*"}:${sub.filter ?? ""}`;
}

class RealtimeManager {
  private readonly entries = new Map<string, Entry>();
  private authWired = false;
  private netWired = false;

  /** Subscribe to a table's changes; returns an idempotent unsubscribe fn. */
  subscribe<Row extends Record<string, unknown>>(sub: TableSubscription<Row>): () => void {
    this.wireAuth();
    this.wireNetwork();

    const key = keyFor(sub);
    const handler: Handler = {
      onChange: sub.onChange as Handler["onChange"],
      onResync: sub.onResync,
      onStatus: sub.onStatus,
    };

    let entry = this.entries.get(key);
    if (entry) {
      entry.handlers.add(handler);
      if (!entry.stale) handler.onStatus?.("subscribed");
    } else {
      const channel = supabase
        .channel(`rt:${key}`)
        .on(
          // `postgres_changes` isn't in the public `.on` overloads' literal union.
          "postgres_changes" as never,
          {
            event: sub.event ?? "*",
            schema: sub.schema ?? "public",
            table: sub.table,
            ...(sub.filter ? { filter: sub.filter } : {}),
          },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const current = this.entries.get(key);
            current?.handlers.forEach((h) => h.onChange(payload));
          },
        )
        .subscribe((status, err) => this.handleStatus(key, status, err));

      entry = { channel, handlers: new Set([handler]), stale: false };
      this.entries.set(key, entry);
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(key, handler);
    };
  }

  /** Force every channel to be treated as stale + trigger a resync on rejoin. */
  markAllStale(): void {
    for (const entry of this.entries.values()) entry.stale = true;
  }

  /** Tear down every channel (e.g. on sign-out). */
  disposeAll(): void {
    for (const [key, entry] of this.entries) {
      void supabase.removeChannel(entry.channel);
      this.entries.delete(key);
    }
  }

  private release(key: string, handler: Handler): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.handlers.delete(handler);
    if (entry.handlers.size === 0) {
      void supabase.removeChannel(entry.channel);
      this.entries.delete(key);
    }
  }

  private handleStatus(key: string, status: string, err?: Error): void {
    const entry = this.entries.get(key);
    if (!entry) return;

    switch (status) {
      case "SUBSCRIBED": {
        const wasStale = entry.stale;
        entry.stale = false;
        entry.handlers.forEach((h) => h.onStatus?.("subscribed"));
        // After a drop, let callers refetch anything they missed.
        if (wasStale) entry.handlers.forEach((h) => h.onResync?.());
        break;
      }
      case "CHANNEL_ERROR":
      case "TIMED_OUT": {
        entry.stale = true; // the socket auto-retries; resync fires on rejoin
        if (err) console.warn(`[realtime] ${key} ${status}:`, err.message);
        entry.handlers.forEach((h) => h.onStatus?.("reconnecting"));
        break;
      }
      case "CLOSED": {
        entry.handlers.forEach((h) => h.onStatus?.("closed"));
        break;
      }
      default:
        break;
    }
  }

  /** Keep the Realtime auth token in step with the session (once). */
  private wireAuth(): void {
    if (this.authWired) return;
    this.authWired = true;
    const setToken = (token: string | null) => {
      try {
        supabase.realtime.setAuth(token);
      } catch {
        /* realtime not ready yet — the client wires auth automatically too */
      }
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => setToken(data.session?.access_token ?? null));
    supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token ?? null));
  }

  /** Mark channels stale on network loss so the next rejoin resyncs (once). */
  private wireNetwork(): void {
    if (this.netWired || typeof window === "undefined") return;
    this.netWired = true;
    window.addEventListener("offline", () => this.markAllStale());
    window.addEventListener("online", () => this.markAllStale());
  }
}

/** Shared singleton — all subscriptions ref-count through this instance. */
export const realtimeManager = new RealtimeManager();

/** Subscribe to a table's Postgres changes; returns an unsubscribe fn. */
export function subscribeToTable<Row extends Record<string, unknown> = Record<string, unknown>>(
  sub: TableSubscription<Row>,
): () => void {
  return realtimeManager.subscribe(sub);
}

/** Whether a table is currently in the realtime publication (else: dormant). */
export function isRealtimeEnabled(table: string): boolean {
  return PUBLISHED_TABLES.has(table);
}

// ── Ephemeral channels (broadcast + presence) ──────────────────────────────

/**
 * Open a broadcast channel for ephemeral cross-client messages (typing, cursor).
 * Returns the channel, a typed `send`, and an unsubscribe fn.
 */
export function createBroadcastChannel<Payload extends Record<string, unknown>>(
  channelName: string,
  event: string,
  onMessage?: (payload: Payload) => void,
): { channel: RealtimeChannel; send: (payload: Payload) => void; unsubscribe: () => void } {
  let channel = supabase.channel(channelName);
  if (onMessage) {
    channel = channel.on("broadcast", { event }, (message: { payload: Payload }) =>
      onMessage(message.payload),
    );
  }
  channel.subscribe();
  return {
    channel,
    send: (payload: Payload) => void channel.send({ type: "broadcast", event, payload }),
    unsubscribe: () => void supabase.removeChannel(channel),
  };
}

/** Track presence (who's online / viewing). Returns the channel + unsubscribe. */
export function createPresenceChannel(
  channelName: string,
  state: Record<string, unknown>,
  onSync?: () => void,
): { channel: RealtimeChannel; unsubscribe: () => void } {
  const channel = supabase.channel(channelName, {
    config: { presence: { key: channelName } },
  });
  if (onSync) channel.on("presence", { event: "sync" }, onSync);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") void channel.track(state);
  });
  return { channel, unsubscribe: () => void supabase.removeChannel(channel) };
}
