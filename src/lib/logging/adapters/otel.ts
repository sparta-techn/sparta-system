/**
 * OpenTelemetry adapter — PREPARED, NOT WIRED.
 *
 * No `@opentelemetry/*` dependency and no exporter yet. Ships:
 *   1. {@link toOtelSeverity} / {@link toOtelLogRecord} — pure mappings to the
 *      OTel Logs Data Model (severityNumber/Text, body, attributes, trace ids).
 *   2. {@link OtelAdapter} — forwards mapped records to an injected `emit`
 *      bridge (e.g. an OTel `Logger.emit`). Inert with no bridge.
 *
 * Performance logs additionally carry a `durationMs`, which a future span
 * bridge can turn into a span; for now it's an attribute on the log record.
 *
 * To activate later: stand up an OTel LoggerProvider + OTLP exporter, then
 * `new OtelAdapter({ emit: (r) => otelLogger.emit(r) })`.
 */
import type { LogAdapter, LogLevel, LogRecord } from "../types";

/** OTel severity numbers (subset) — see the OTel Logs Data Model spec. */
export const OTEL_SEVERITY_NUMBER: Record<LogLevel, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

export function toOtelSeverity(level: LogLevel): { number: number; text: string } {
  return { number: OTEL_SEVERITY_NUMBER[level], text: level.toUpperCase() };
}

export interface OtelLogRecord {
  timeUnixNano: number;
  severityNumber: number;
  severityText: string;
  body: string;
  /** Flat attribute bag (OTel prefers flat, string-keyed attributes). */
  attributes: Record<string, unknown>;
  /** Correlation id doubles as a trace id for cross-signal linking. */
  traceId?: string;
}

/** Pure mapping — unit-testable without the SDK. */
export function toOtelLogRecord(record: LogRecord): OtelLogRecord {
  const sev = toOtelSeverity(record.level);
  return {
    timeUnixNano: new Date(record.timestamp).getTime() * 1_000_000,
    severityNumber: sev.number,
    severityText: sev.text,
    body: record.message,
    attributes: {
      "log.category": record.category,
      "service.feature": record.context.feature,
      "deployment.environment": record.context.environment,
      "process.runtime.name": record.context.runtime,
      "enduser.id": record.context.userId ?? undefined,
      "duration.ms": record.durationMs,
      ...record.data,
      ...(record.error
        ? { "exception.type": record.error.name, "exception.message": record.error.message }
        : {}),
    },
    traceId: record.context.correlationId,
  };
}

/** Bridge injected at wiring time (e.g. OTel `Logger.emit`). */
export type OtelEmit = (record: OtelLogRecord) => void;

export class OtelAdapter implements LogAdapter {
  readonly name = "otel";
  readonly minLevel?: LogLevel;

  constructor(private readonly options: { emit?: OtelEmit; minLevel?: LogLevel } = {}) {
    this.minLevel = options.minLevel;
  }

  handle(record: LogRecord): void {
    if (!this.options.emit) return; // inert until a bridge is injected
    try {
      this.options.emit(toOtelLogRecord(record));
    } catch {
      /* never throw from a sink */
    }
  }
}
