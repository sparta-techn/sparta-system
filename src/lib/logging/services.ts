/**
 * Category services — the reusable, purpose-built loggers call sites should use.
 *
 * Each wraps the default {@link logger} with the right category, level, and
 * payload shape so features log consistently without re-deriving conventions:
 *
 *   - {@link appLog}    — general application/diagnostic logs.
 *   - {@link errorLog}  — captured exceptions (serialized + redacted).
 *   - {@link auditLog}  — immutable trail of sensitive actions (`docs/AuditSystem.md`).
 *   - {@link authLog}   — authentication lifecycle (emails masked).
 *   - {@link activityLog} — user-visible activity (bridges to the activity feed).
 *   - {@link perfLog}   — timings / spans / web vitals.
 *
 * They emit through adapters only — persistence (audit_logs, activity_feed) is a
 * separate concern owned by the service/DB layer; `auditLog`/`activityLog`
 * expose helpers to hand their event to that layer without coupling to it here.
 */
import { logger } from "./config";
import { serializeError } from "./logger";
import { maskEmail, redactRecord } from "./redact";
import type {
  ActivityEvent,
  AuditEvent,
  AuthEvent,
  LogContext,
  LogLevel,
  PerformanceEvent,
} from "./types";

// ── Application ─────────────────────────────────────────────────────────────

export const appLog = {
  trace: (message: string, data?: Record<string, unknown>) => logger.trace(message, data),
  debug: (message: string, data?: Record<string, unknown>) => logger.debug(message, data),
  info: (message: string, data?: Record<string, unknown>) => logger.info(message, data),
  warn: (message: string, data?: Record<string, unknown>) => logger.warn(message, data),
  error: (message: string, data?: Record<string, unknown>) => logger.error(message, data),
  /** Bind context (feature/route) once and reuse. */
  child: (context: LogContext) => logger.child(context),
};

// ── Error ───────────────────────────────────────────────────────────────────

export interface CaptureOptions {
  /** Level to record the exception at. Default "error"; use "fatal" for crashes. */
  level?: Extract<LogLevel, "error" | "fatal">;
  /** Extra structured data (redacted). */
  data?: Record<string, unknown>;
  /** Context overrides (e.g. `{ feature: "attendance" }`). */
  context?: LogContext;
  /** Override the summary line (defaults to the error message). */
  message?: string;
}

export const errorLog = {
  /** Capture a thrown value as a structured, redacted error record. */
  capture(error: unknown, options: CaptureOptions = {}): void {
    const serialized = serializeError(error);
    logger.emit(options.level ?? "error", "error", options.message ?? serialized.message, {
      error: serialized,
      data: options.data,
      context: options.context,
    });
  },
  /** A fatal, likely-unrecoverable error (render crash, boot failure). */
  fatal(error: unknown, options: Omit<CaptureOptions, "level"> = {}): void {
    errorLog.capture(error, { ...options, level: "fatal" });
  },
};

// ── Audit ─────────────────────────────────────────────────────────────────

/** The audit event as it should be persisted to `audit_logs` (redacted). */
export interface AuditRecord extends AuditEvent {
  correlationId?: string;
  actorId?: string | null;
  actorRole?: string | null;
  occurredAt: string;
}

export const auditLog = {
  /**
   * Record a sensitive action. Emits to the log adapters AND returns the
   * redacted {@link AuditRecord} so a server caller can persist it to
   * `audit_logs` (append-only) in the same breath.
   */
  record(event: AuditEvent, context: LogContext = {}): AuditRecord {
    const safe: AuditEvent = {
      ...event,
      before: redactRecord(event.before),
      after: redactRecord(event.after),
      diff: redactRecord(event.diff),
    };
    logger.emit("info", "audit", `audit:${event.action}`, {
      data: { ...safe, targetTable: event.targetTable, targetId: event.targetId },
      context,
    });
    return {
      ...safe,
      correlationId: context.correlationId,
      actorId: context.userId ?? null,
      actorRole: context.actorRole ?? null,
      occurredAt: new Date().toISOString(),
    };
  },
};

// ── Authentication ──────────────────────────────────────────────────────────

export const authLog = {
  /** Record an auth-lifecycle event. Emails are masked; failures logged at warn. */
  event(event: AuthEvent, context: LogContext = {}): void {
    const level: LogLevel = event.success ? "info" : "warn";
    logger.emit(level, "auth", `auth:${event.type}`, {
      data: {
        type: event.type,
        success: event.success,
        method: event.method,
        reason: event.reason,
        email: maskEmail(event.email),
      },
      context,
    });
  },
  /** Shorthands for the common transitions. */
  signIn: (success: boolean, extra: Partial<AuthEvent> & LogContext = {}) =>
    authLog.event({ type: success ? "sign_in" : "sign_in_failed", success, ...extra }, extra),
  signOut: (context: LogContext = {}) =>
    authLog.event({ type: "sign_out", success: true }, context),
  sessionExpired: (context: LogContext = {}) =>
    authLog.event({ type: "session_expired", success: false }, context),
};

// ── Activity ─────────────────────────────────────────────────────────────────

export const activityLog = {
  /** Record a user-visible activity event (emitted to adapters). */
  record(event: ActivityEvent, context: LogContext = {}): void {
    logger.emit("info", "activity", `activity:${event.kind}`, {
      data: { ...event, meta: redactRecord(event.meta) },
      context,
    });
  },
  /**
   * Shape an {@link ActivityEvent} for the `activity_feed` table
   * (`ActivityFeedInsert`) without importing the service layer here — the
   * caller passes the result to `ActivityFeedService.log(...)`.
   */
  toFeedInsert(event: ActivityEvent) {
    return {
      source_type: event.sourceType,
      source_id: event.sourceId,
      kind: event.kind,
      summary: event.summary,
      project_id: event.projectId ?? null,
      meta: (redactRecord(event.meta) ?? {}) as Record<string, unknown>,
    };
  },
};

// ── Performance ───────────────────────────────────────────────────────────────

/** High-resolution clock (browser + server), monotonic where available. */
function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export const perfLog = {
  /** Record a measurement directly. */
  record(event: PerformanceEvent, context: LogContext = {}): void {
    logger.emit("info", "performance", `perf:${event.name}`, {
      durationMs: event.durationMs,
      data: { name: event.name, ...event.detail },
      context,
    });
  },

  /**
   * Start a timer; call the returned function to record the elapsed time.
   * @example const end = perfLog.start("route.tasks.load"); … ; end();
   */
  start(name: string, detail?: Record<string, unknown>): (extra?: Record<string, unknown>) => void {
    const t0 = now();
    return (extra) =>
      perfLog.record({ name, durationMs: now() - t0, detail: { ...detail, ...extra } });
  },

  /** Time an async operation, recording its duration (and re-throwing errors). */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    detail?: Record<string, unknown>,
  ): Promise<T> {
    const t0 = now();
    try {
      return await fn();
    } finally {
      perfLog.record({ name, durationMs: now() - t0, detail });
    }
  },
};
