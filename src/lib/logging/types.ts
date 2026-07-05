/**
 * Logging contracts — the shared vocabulary every logger, adapter, and category
 * service speaks. Framework- and transport-agnostic: nothing here imports React,
 * Supabase, or a vendor SDK, so the module is safe on the client, during SSR,
 * and in Edge/worker runtimes.
 */

/** Severity, low → high. Mirrors syslog/most vendors so mapping is 1:1. */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export const LOG_LEVELS: readonly LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

/** Numeric weight for threshold comparisons (higher = more severe). */
export const LEVEL_WEIGHT: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/** True when `level` meets or exceeds `min`. */
export function meetsLevel(level: LogLevel, min: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[min];
}

/**
 * The six log streams. Each maps to a category service (see `services.ts`) and
 * can be routed/sampled independently by adapters.
 */
export type LogCategory =
  | "application" // general app/diagnostic logs
  | "error" // captured exceptions
  | "audit" // immutable trail of sensitive actions
  | "auth" // authentication lifecycle
  | "activity" // user-visible activity stream
  | "performance"; // timings / web vitals / spans

/**
 * Ambient fields attached to every record. Sparse by design — a logger binds
 * what it knows (correlation id, user, route) and adapters forward the rest.
 * Extensible via the index signature without loosening the known keys.
 */
export interface LogContext {
  /** End-to-end request/trace id — ties logs, audits, and traces together. */
  correlationId?: string;
  /** Acting user (`auth.uid()`), or null for anonymous/system. */
  userId?: string | null;
  /** Actor role captured at emit time (audit demotion-safety). */
  actorRole?: string | null;
  /** Client session id (rotates on sign-in). */
  sessionId?: string;
  /** Route/pathname the log originated from. */
  route?: string;
  /** Owning feature/module, e.g. "attendance". */
  feature?: string;
  /** "development" | "production" | "test" | custom. */
  environment?: string;
  /** Build/release identifier for correlating deploys. */
  release?: string;
  /** Where the log ran: browser vs server/edge. */
  runtime?: "browser" | "server";
  [key: string]: unknown;
}

/** Normalized, serializable error shape (never a live Error instance). */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  /** Optional category tag supplied by the caller (see `@/lib/errors`). */
  category?: string;
  /** Nested cause, already serialized. */
  cause?: SerializedError | string;
}

/** The canonical unit every adapter receives. Immutable once emitted. */
export interface LogRecord {
  /** ISO-8601 UTC timestamp. */
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  /** Human-readable summary line. */
  message: string;
  /** Ambient context bound to the emitting logger. */
  context: LogContext;
  /** Structured, already-redacted payload. */
  data?: Record<string, unknown>;
  /** Present on error logs. */
  error?: SerializedError;
  /** Present on performance logs (milliseconds). */
  durationMs?: number;
}

/**
 * A log sink. Implementations forward records to a destination (console,
 * Sentry, Logtail, an OTel exporter …). `handle` must never throw — the logger
 * isolates adapter failures, but adapters should fail quietly regardless.
 */
export interface LogAdapter {
  /** Stable identifier, e.g. "console", "sentry". */
  readonly name: string;
  /** Optional per-adapter minimum level (defaults to the logger's level). */
  readonly minLevel?: LogLevel;
  /** Handle one record. Synchronous or fire-and-forget; must not throw. */
  handle(record: LogRecord): void;
  /** Flush buffered records (batched transports). Optional. */
  flush?(): Promise<void>;
  /** Release resources. Optional. */
  close?(): Promise<void>;
}

// ── Category-specific event payloads ────────────────────────────────────────

/**
 * A sensitive-action audit event. Field names mirror `docs/AuditSystem.md`
 * (`audit_logs`) so a server sink can persist it verbatim. `before`/`after`
 * are redacted before emit.
 */
export interface AuditEvent {
  /** `audit_action` enum value, e.g. "role.grant", "attendance.override". */
  action: string;
  /** Table acted on. */
  targetTable: string;
  /** Row acted on (null for table-wide actions). */
  targetId?: string | null;
  /** Pre-image snapshot (redacted). */
  before?: Record<string, unknown> | null;
  /** Post-image snapshot (redacted). */
  after?: Record<string, unknown> | null;
  /** Computed delta (redacted). */
  diff?: Record<string, unknown> | null;
  /** Human context a generic diff can't capture. */
  reason?: string;
}

export type AuthEventType =
  | "sign_in"
  | "sign_out"
  | "sign_in_failed"
  | "sign_up"
  | "password_change"
  | "password_reset_request"
  | "mfa_enroll"
  | "mfa_disable"
  | "token_refresh"
  | "session_expired";

/** An authentication-lifecycle event. `email` is masked before emit. */
export interface AuthEvent {
  type: AuthEventType;
  /** Whether the attempt succeeded. Failures never leak which factor failed. */
  success: boolean;
  /** "password" | "oauth:google" | "magic_link" | … */
  method?: string;
  /** Safe reason code, e.g. "rate_limited", "invalid_credentials". */
  reason?: string;
  /** Raw email — masked to `j***@d***.com` by the auth service. */
  email?: string;
}

/**
 * A user-visible activity event. Mirrors `ActivityFeedInsert`
 * (`@/services/activity/types`) so it can bridge to the activity feed without
 * this module importing the service layer.
 */
export interface ActivityEvent {
  sourceType: string;
  sourceId: string;
  kind: string;
  summary: string;
  projectId?: string | null;
  meta?: Record<string, unknown>;
}

/** A performance measurement. */
export interface PerformanceEvent {
  /** Metric/operation name, e.g. "route.tasks.load", "web-vital.LCP". */
  name: string;
  durationMs: number;
  /** Optional extra dimensions (status, size, cache hit …). */
  detail?: Record<string, unknown>;
}
