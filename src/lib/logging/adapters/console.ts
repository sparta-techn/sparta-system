/**
 * ConsoleAdapter — the always-available sink.
 *
 * - **Development**: pretty, single-line output grouped by level/category with
 *   the message and any structured data, easy to scan in a terminal/devtools.
 * - **Production**: one JSON object per line (`structured: true`) so log
 *   shippers (Logtail, Datadog agent, Cloudflare tail, …) can parse it without
 *   a vendor SDK. This is what makes the console a legitimate prod transport.
 *
 * Never throws: any formatting failure degrades to a raw `console.log`.
 */
import type { LogAdapter, LogLevel, LogRecord } from "../types";

const LEVEL_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
};

const LEVEL_TAG: Record<LogLevel, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
  fatal: "FATAL",
};

export interface ConsoleAdapterOptions {
  /** Emit newline-delimited JSON instead of pretty text. Default: prod-on. */
  structured?: boolean;
  minLevel?: LogLevel;
}

export class ConsoleAdapter implements LogAdapter {
  readonly name = "console";
  readonly minLevel?: LogLevel;
  private readonly structured: boolean;

  constructor(options: ConsoleAdapterOptions = {}) {
    this.structured = options.structured ?? false;
    this.minLevel = options.minLevel;
  }

  handle(record: LogRecord): void {
    const method = LEVEL_METHOD[record.level];
    try {
      if (this.structured) {
        // One JSON line — the record is already redacted and serializable.
        console[method](JSON.stringify(record));
        return;
      }
      const cid = record.context.correlationId;
      const prefix = `${LEVEL_TAG[record.level]} ${record.category}${cid ? ` ${cid.slice(0, 8)}` : ""}`;
      const extras: unknown[] = [];
      if (record.data && Object.keys(record.data).length) extras.push(record.data);
      if (record.error) extras.push(record.error);
      if (typeof record.durationMs === "number") extras.push(`${record.durationMs.toFixed(1)}ms`);
      console[method](`[${prefix}] ${record.message}`, ...extras);
    } catch {
      // Last resort — never let logging break the caller.
      console.log(record.level, record.category, record.message);
    }
  }
}

/** NoopAdapter — swallows everything. Useful as a prod default before wiring. */
export class NoopAdapter implements LogAdapter {
  readonly name = "noop";
  handle(): void {
    /* intentionally empty */
  }
}
