/**
 * MockTelemetryService — the local, offline data source for the Integration
 * Center.
 *
 * Real providers are still placeholders (every vendor call throws
 * `notImplemented`), so the Center can't read live status/health/logs from them.
 * This service stands in: it produces **deterministic, plausible** telemetry per
 * provider — status, health, last sync, errors, configuration hints and logs —
 * seeded by the provider id so it is stable across renders (no flicker), and it
 * makes NO network calls.
 *
 * It is a reactive store (`subscribe` / `getSnapshot`) mirroring the
 * {@link IntegrationManager} idiom, so React reads it via `useSyncExternalStore`.
 * Actions (connect / disconnect / sync / refresh) mutate the cached telemetry and
 * publish, so the UI feels wired even though nothing leaves the browser. Swap this
 * for a Supabase-backed telemetry reader later — the hooks and UI don't change.
 */

import type { HealthState, IntegrationId } from "../types";
import type { ProviderStatusSnapshot } from "../models";

export interface HealthSample {
  state: HealthState;
  latencyMs: number;
  checkedAt: string;
}

export interface LastSyncInfo {
  at: string | null;
  ok: boolean;
  itemsProcessed: number;
  durationMs: number;
  cursor?: string;
}

export interface TelemetryError {
  at: string;
  code: string;
  message: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  at: string;
  level: LogLevel;
  message: string;
}

/** The full telemetry the Integration Center renders for one provider. */
export interface IntegrationTelemetry {
  integrationId: IntegrationId;
  status: ProviderStatusSnapshot;
  health: HealthSample;
  lastSync: LastSyncInfo;
  errors: TelemetryError[];
  logs: LogEntry[];
}

// ── Deterministic pseudo-randomness (seeded by provider id) ──────────────────

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEALTH_TO_STATE: Record<HealthState, ProviderStatusSnapshot["state"]> = {
  healthy: "connected",
  degraded: "degraded",
  down: "error",
};

const ERROR_POOL: ReadonlyArray<{ code: string; message: string }> = [
  { code: "rate_limited", message: "429 Too Many Requests — backing off." },
  { code: "unauthorized", message: "Credential rejected (401); refresh required." },
  { code: "provider_unavailable", message: "Upstream returned 503; retrying." },
  { code: "sync_conflict", message: "Cursor drift detected; performing full resync." },
  { code: "timeout", message: "Request exceeded 5s timeout." },
];

const LOG_POOL: ReadonlyArray<{ level: LogLevel; message: string }> = [
  { level: "info", message: "Health probe ok." },
  { level: "info", message: "Sync completed." },
  { level: "debug", message: "Token refreshed." },
  { level: "debug", message: "Webhook signature verified." },
  { level: "warn", message: "Approaching rate limit (80%)." },
  { level: "info", message: "Settings updated." },
  { level: "warn", message: "Retry scheduled (attempt 2/5)." },
  { level: "error", message: "Delivery failed; queued for retry." },
];

const HOUR = 3_600_000;

export class MockTelemetryService {
  private readonly cache = new Map<IntegrationId, IntegrationTelemetry>();
  private readonly listeners = new Set<() => void>();
  private snapshotCache: IntegrationTelemetry[] | null = null;

  constructor(private readonly ids: readonly IntegrationId[]) {
    for (const id of ids) this.cache.set(id, this.seed(id));
  }

  // ── Reactive store surface ──────────────────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): IntegrationTelemetry[] => {
    if (!this.snapshotCache) {
      this.snapshotCache = this.ids.map((id) => this.get(id));
    }
    return this.snapshotCache;
  };

  get(id: IntegrationId): IntegrationTelemetry {
    let telemetry = this.cache.get(id);
    if (!telemetry) {
      telemetry = this.seed(id);
      this.cache.set(id, telemetry);
    }
    return telemetry;
  }

  // ── Mock actions (mutate cached telemetry, then publish) ─────────────────────

  connect(id: IntegrationId): void {
    const current = this.get(id);
    this.set(id, {
      ...current,
      status: { ...current.status, state: "connected", connected: true, accountCount: 1 },
      health: { state: "healthy", latencyMs: current.health.latencyMs, checkedAt: nowIso() },
      logs: prepend(current.logs, { at: nowIso(), level: "info", message: "Account connected." }),
    });
  }

  disconnect(id: IntegrationId): void {
    const current = this.get(id);
    this.set(id, {
      ...current,
      status: { ...current.status, state: "disconnected", connected: false, accountCount: 0 },
      logs: prepend(current.logs, {
        at: nowIso(),
        level: "info",
        message: "Account disconnected.",
      }),
    });
  }

  sync(id: IntegrationId): void {
    const current = this.get(id);
    const items = 1 + Math.floor(makeRng(hashSeed(id + nowIso()))() * 200);
    this.set(id, {
      ...current,
      lastSync: {
        at: nowIso(),
        ok: true,
        itemsProcessed: items,
        durationMs: 300 + Math.floor(items * 3),
        cursor: String(Date.now()),
      },
      logs: prepend(current.logs, {
        at: nowIso(),
        level: "info",
        message: `Sync completed — ${items} items processed.`,
      }),
    });
  }

  refresh(id: IntegrationId): void {
    const current = this.get(id);
    this.set(id, {
      ...current,
      health: { ...current.health, checkedAt: nowIso() },
      status: { ...current.status, lastCheckedAt: nowIso() },
      logs: prepend(current.logs, { at: nowIso(), level: "debug", message: "Health re-probed." }),
    });
  }

  refreshAll(): void {
    for (const id of this.ids) {
      const current = this.get(id);
      this.cache.set(id, {
        ...current,
        health: { ...current.health, checkedAt: nowIso() },
        status: { ...current.status, lastCheckedAt: nowIso() },
      });
    }
    this.publish();
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private set(id: IntegrationId, telemetry: IntegrationTelemetry): void {
    this.cache.set(id, telemetry);
    this.publish();
  }

  private publish(): void {
    this.snapshotCache = null;
    this.listeners.forEach((l) => l());
  }

  /** Deterministically synthesize a provider's initial telemetry. */
  private seed(id: IntegrationId): IntegrationTelemetry {
    const rng = makeRng(hashSeed(id));
    const now = Date.now();

    const roll = rng();
    const healthState: HealthState = roll < 0.7 ? "healthy" : roll < 0.9 ? "degraded" : "down";
    const latencyMs = 40 + Math.floor(rng() * 360);
    const accountCount = 1 + Math.floor(rng() * 3);
    const checkedAt = new Date(now - Math.floor(rng() * 5 * 60_000)).toISOString();

    const errorCount =
      healthState === "down"
        ? 1 + Math.floor(rng() * 2)
        : healthState === "degraded"
          ? rng() < 0.5
            ? 1
            : 0
          : 0;
    const errors: TelemetryError[] = Array.from({ length: errorCount }, (_, i) => {
      const pick = ERROR_POOL[Math.floor(rng() * ERROR_POOL.length)];
      return {
        at: new Date(now - Math.floor(rng() * 2 * HOUR)).toISOString(),
        code: pick.code,
        message: pick.message,
      };
    });

    const logCount = 5 + Math.floor(rng() * 6);
    const logs: LogEntry[] = Array.from({ length: logCount }, (_, i) => {
      const pick = LOG_POOL[Math.floor(rng() * LOG_POOL.length)];
      return {
        at: new Date(now - i * (5 + Math.floor(rng() * 40)) * 60_000).toISOString(),
        level: pick.level,
        message: pick.message,
      };
    });

    const lastSyncAt = new Date(now - Math.floor(rng() * 6 * HOUR)).toISOString();

    const status: ProviderStatusSnapshot = {
      integrationId: id,
      state: HEALTH_TO_STATE[healthState],
      connected: healthState !== "down",
      accountCount,
      lastCheckedAt: checkedAt,
      latencyMs,
      message: healthState === "down" ? "Provider probe failed." : null,
    };

    return {
      integrationId: id,
      status,
      health: { state: healthState, latencyMs, checkedAt },
      lastSync: {
        at: lastSyncAt,
        ok: healthState !== "down",
        itemsProcessed: Math.floor(rng() * 400),
        durationMs: 300 + Math.floor(rng() * 4000),
        cursor: String(now - Math.floor(rng() * 1000)),
      },
      errors,
      logs,
    };
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function prepend(logs: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  return [entry, ...logs].slice(0, 50);
}
