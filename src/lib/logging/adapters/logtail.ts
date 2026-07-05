/**
 * Logtail (Better Stack) adapter — PREPARED, NOT WIRED.
 *
 * No `@logtail/*` dependency and no source token yet. Ships:
 *   1. {@link toLogtailPayload} — pure mapping to Logtail's ingestion JSON
 *      (`dt`, `level`, `message`, plus flattened context/data).
 *   2. {@link LogtailAdapter} — batches records and flushes via an injected
 *      `transport` (any `fetch`-like POST). With no transport it buffers
 *      in-memory up to a cap and drops the oldest — inert but honest.
 *
 * To activate later: provide a transport that POSTs the batch to
 * `https://in.logs.betterstack.com` with the source token, e.g.
 * `new LogtailAdapter({ transport: (batch) => fetch(url, { ... }) })`.
 */
import type { LogAdapter, LogLevel, LogRecord } from "../types";

export interface LogtailPayload {
  /** Logtail's timestamp field. */
  dt: string;
  level: LogLevel;
  message: string;
  category: LogRecord["category"];
  correlation_id?: string;
  context: LogRecord["context"];
  data?: Record<string, unknown>;
  error?: LogRecord["error"];
  duration_ms?: number;
}

/** Pure mapping — unit-testable without the SDK. */
export function toLogtailPayload(record: LogRecord): LogtailPayload {
  return {
    dt: record.timestamp,
    level: record.level,
    message: record.message,
    category: record.category,
    correlation_id: record.context.correlationId,
    context: record.context,
    data: record.data,
    error: record.error,
    duration_ms: record.durationMs,
  };
}

/** POST-like transport injected at wiring time. Must not throw synchronously. */
export type LogtailTransport = (batch: LogtailPayload[]) => Promise<void>;

export interface LogtailAdapterOptions {
  transport?: LogtailTransport;
  /** Flush when this many records are buffered. Default 20. */
  batchSize?: number;
  /** Hard cap on the buffer before dropping oldest (no transport). Default 500. */
  maxBuffer?: number;
  minLevel?: LogLevel;
}

export class LogtailAdapter implements LogAdapter {
  readonly name = "logtail";
  readonly minLevel?: LogLevel;
  private readonly transport?: LogtailTransport;
  private readonly batchSize: number;
  private readonly maxBuffer: number;
  private buffer: LogtailPayload[] = [];

  constructor(options: LogtailAdapterOptions = {}) {
    this.transport = options.transport;
    this.batchSize = options.batchSize ?? 20;
    this.maxBuffer = options.maxBuffer ?? 500;
    this.minLevel = options.minLevel;
  }

  handle(record: LogRecord): void {
    this.buffer.push(toLogtailPayload(record));
    if (this.transport && this.buffer.length >= this.batchSize) {
      void this.flush();
    } else if (this.buffer.length > this.maxBuffer) {
      // No transport / backpressure: bound memory, keep the most recent.
      this.buffer.splice(0, this.buffer.length - this.maxBuffer);
    }
  }

  async flush(): Promise<void> {
    if (!this.transport || this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.transport(batch);
    } catch {
      // Re-buffer on failure, still bounded by maxBuffer next round.
      this.buffer = batch.concat(this.buffer).slice(-this.maxBuffer);
    }
  }
}
