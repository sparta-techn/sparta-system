/**
 * Logger — the dispatch engine.
 *
 * Builds an immutable {@link LogRecord}, redacts its structured payload, stamps
 * ambient + bound context, and fans it out to every registered {@link LogAdapter}
 * whose min-level the record meets. Adapter failures are isolated so one broken
 * sink can never break the app or the other sinks.
 *
 * Prefer the category services in `services.ts` (`appLog`, `errorLog`, …) at
 * call sites; this class is the shared primitive they build on. Use
 * {@link Logger.child} to bind context (a feature name, a request's correlation
 * id) once and inherit it on every subsequent log.
 */
import { getLogContext } from "./correlation";
import { redactRecord } from "./redact";
import {
  LEVEL_WEIGHT,
  meetsLevel,
  type LogAdapter,
  type LogCategory,
  type LogContext,
  type LogLevel,
  type LogRecord,
  type SerializedError,
} from "./types";

export interface LoggerConfig {
  /** Global minimum level; records below it are dropped before redaction. */
  level: LogLevel;
  /** Registered sinks. */
  adapters: LogAdapter[];
  /** Base context merged under the ambient + per-call context. */
  baseContext?: LogContext;
  /** When false, the ambient (module-global) context is not merged in. */
  useAmbientContext?: boolean;
}

export interface EmitOptions {
  data?: Record<string, unknown>;
  error?: SerializedError;
  durationMs?: number;
  /** Per-call context overrides (highest precedence). */
  context?: LogContext;
}

/** Normalize any thrown value into a serializable {@link SerializedError}. */
export function serializeError(error: unknown, depth = 0): SerializedError {
  if (error instanceof Error) {
    const e = error as Error & { code?: string | number; cause?: unknown };
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
      code: e.code,
      cause:
        e.cause != null && depth < 3
          ? typeof e.cause === "string"
            ? e.cause
            : serializeError(e.cause, depth + 1)
          : undefined,
    };
  }
  if (typeof error === "string") return { name: "Error", message: error };
  if (error && typeof error === "object") {
    const o = error as { name?: string; message?: string; code?: string | number };
    return { name: o.name ?? "Error", message: o.message ?? "Unknown error", code: o.code };
  }
  return { name: "Error", message: String(error) };
}

export class Logger {
  constructor(private readonly config: LoggerConfig) {}

  /** A child logger that inherits config and merges extra bound context. */
  child(context: LogContext): Logger {
    return new Logger({
      ...this.config,
      baseContext: { ...this.config.baseContext, ...context },
    });
  }

  /** Register a sink at runtime (used by `configureLogging`). */
  addAdapter(adapter: LogAdapter): void {
    this.config.adapters.push(adapter);
  }

  /** Replace the whole sink set. */
  setAdapters(adapters: LogAdapter[]): void {
    this.config.adapters = adapters;
  }

  /** Change the global level. */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[this.config.level];
  }

  /** Build, redact, and dispatch a record. The single choke point. */
  emit(level: LogLevel, category: LogCategory, message: string, options: EmitOptions = {}): void {
    if (!this.isLevelEnabled(level)) return;

    const ambient = this.config.useAmbientContext === false ? {} : getLogContext();
    const context: LogContext = {
      ...this.config.baseContext,
      ...ambient,
      ...options.context,
    };

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      data: redactRecord(options.data),
      error: options.error,
      durationMs: options.durationMs,
    };

    for (const adapter of this.config.adapters) {
      const min = adapter.minLevel;
      if (min && !meetsLevel(level, min)) continue;
      try {
        adapter.handle(record);
      } catch {
        // A sink must never break the app or sibling sinks.
      }
    }
  }

  /** Flush every batched adapter (call before shutdown / page unload). */
  async flush(): Promise<void> {
    await Promise.all(
      this.config.adapters.map((a) => {
        try {
          return a.flush?.() ?? Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      }),
    );
  }

  // Convenience methods for the `application` category — the common case.
  trace(message: string, data?: Record<string, unknown>): void {
    this.emit("trace", "application", message, { data });
  }
  debug(message: string, data?: Record<string, unknown>): void {
    this.emit("debug", "application", message, { data });
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.emit("info", "application", message, { data });
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.emit("warn", "application", message, { data });
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.emit("error", "application", message, { data });
  }
}
