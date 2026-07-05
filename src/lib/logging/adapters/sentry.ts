/**
 * Sentry adapter — PREPARED, NOT WIRED.
 *
 * There is no `@sentry/*` dependency and no DSN yet. This module ships:
 *   1. {@link toSentryEvent} — a pure mapping from our {@link LogRecord} to the
 *      shape Sentry's SDK expects (level, message, exception, tags, contexts).
 *   2. {@link SentryAdapter} — a {@link LogAdapter} that forwards to an injected
 *      `SentryClient`. With no client it is completely inert, so registering it
 *      is safe today; wiring later is a one-liner (`new SentryAdapter(Sentry)`).
 *
 * To activate later: `npm i @sentry/browser`, `Sentry.init({ dsn })`, then
 * `configureLogging({ adapters: [..., new SentryAdapter(Sentry)] })`.
 */
import type { LogAdapter, LogLevel, LogRecord } from "../types";

/** Sentry severity strings. */
export type SentryLevel = "debug" | "info" | "warning" | "error" | "fatal";

const LEVEL_MAP: Record<LogLevel, SentryLevel> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
  fatal: "fatal",
};

/** The minimal slice of `@sentry/*` we depend on — keeps the SDK optional. */
export interface SentryClient {
  captureException(error: unknown, hint?: Record<string, unknown>): void;
  captureMessage(message: string, hint?: Record<string, unknown>): void;
  addBreadcrumb?(breadcrumb: Record<string, unknown>): void;
}

export interface SentryEvent {
  level: SentryLevel;
  message: string;
  tags: Record<string, string | undefined>;
  contexts: Record<string, unknown>;
  /** Present when the record carried an error. */
  exception?: LogRecord["error"];
}

/** Pure mapping — unit-testable without the SDK. */
export function toSentryEvent(record: LogRecord): SentryEvent {
  return {
    level: LEVEL_MAP[record.level],
    message: record.message,
    tags: {
      category: record.category,
      feature: record.context.feature,
      environment: record.context.environment,
      runtime: record.context.runtime,
      correlation_id: record.context.correlationId,
    },
    contexts: {
      log: { category: record.category, data: record.data, durationMs: record.durationMs },
      user: record.context.userId ? { id: record.context.userId } : undefined,
    },
    exception: record.error,
  };
}

export class SentryAdapter implements LogAdapter {
  readonly name = "sentry";
  readonly minLevel?: LogLevel;

  /** Pass a `Sentry` client to activate; omit to leave the adapter inert. */
  constructor(
    private readonly client?: SentryClient,
    options: { minLevel?: LogLevel } = {},
  ) {
    // Default to warnings+ — Sentry is for problems, not chatter.
    this.minLevel = options.minLevel ?? "warn";
  }

  handle(record: LogRecord): void {
    if (!this.client) return; // inert until a client is injected
    const event = toSentryEvent(record);
    const hint = { tags: event.tags, contexts: event.contexts };
    try {
      if (record.error) {
        this.client.captureException(record.error, hint);
      } else {
        this.client.captureMessage(record.message, { level: event.level, ...hint });
      }
    } catch {
      /* never throw from a sink */
    }
  }
}
