/**
 * Logging configuration + the process-wide default logger.
 *
 * On import, this picks sensible defaults from the environment:
 *   - **dev / test**: `debug` level, pretty console output.
 *   - **prod**: `info` level, structured (NDJSON) console output — parseable by
 *     any log shipper without a vendor SDK.
 *
 * External sinks (Sentry / Logtail / OTel) are NOT registered here — they are
 * prepared but inert until `configureLogging` is called with them at app
 * bootstrap. That keeps this module dependency-free and safe everywhere.
 */
import { ConsoleAdapter } from "./adapters/console";
import { setLogContext } from "./correlation";
import { Logger } from "./logger";
import type { LogAdapter, LogContext, LogLevel } from "./types";

/** Read an env var across Vite (browser build) and Node/edge (server). */
function readEnv(viteKey: string, nodeKey: string): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined> | undefined)?.[viteKey]
      : undefined;
  const fromNode = typeof process !== "undefined" ? process.env?.[nodeKey] : undefined;
  return fromVite ?? fromNode;
}

/** Resolved environment name: "development" | "production" | "test" | custom. */
export function getEnvironment(): string {
  const mode =
    (typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined> | undefined)?.MODE
      : undefined) ??
    (typeof process !== "undefined" ? process.env?.NODE_ENV : undefined) ??
    "production";
  return mode;
}

export function isProduction(): boolean {
  return getEnvironment() === "production";
}

/** Whether this module is currently executing in the browser. */
export function getRuntime(): "browser" | "server" {
  return typeof window !== "undefined" ? "browser" : "server";
}

function defaultLevel(): LogLevel {
  const explicit = readEnv("VITE_LOG_LEVEL", "LOG_LEVEL") as LogLevel | undefined;
  if (explicit) return explicit;
  return isProduction() ? "info" : "debug";
}

function baseContext(): LogContext {
  return {
    environment: getEnvironment(),
    runtime: getRuntime(),
    release: readEnv("VITE_RELEASE", "RELEASE") ?? readEnv("VITE_COMMIT_SHA", "COMMIT_SHA"),
  };
}

/** The default console sink for the current environment. */
export function defaultAdapters(): LogAdapter[] {
  return [new ConsoleAdapter({ structured: isProduction() })];
}

/** The process-wide logger. Import `logger` (or a category service) anywhere. */
export const logger = new Logger({
  level: defaultLevel(),
  adapters: defaultAdapters(),
  baseContext: baseContext(),
});

export interface ConfigureLoggingOptions {
  /** Override the global minimum level. */
  level?: LogLevel;
  /** Replace the sink set (e.g. add Sentry/Logtail/OTel at bootstrap). */
  adapters?: LogAdapter[];
  /** Append a sink without removing the defaults. */
  addAdapters?: LogAdapter[];
  /** Merge fields into the ambient context (e.g. release, sessionId). */
  context?: LogContext;
}

/**
 * Configure the default logger at app bootstrap. Idempotent and safe to call
 * from both server entry and client entry.
 *
 * @example
 * configureLogging({
 *   adapters: [...defaultAdapters(), new SentryAdapter(Sentry)],
 *   context: { release: __BUILD_SHA__ },
 * });
 */
export function configureLogging(options: ConfigureLoggingOptions = {}): Logger {
  if (options.level) logger.setLevel(options.level);
  if (options.adapters) logger.setAdapters(options.adapters);
  if (options.addAdapters) options.addAdapters.forEach((a) => logger.addAdapter(a));
  if (options.context) setLogContext(options.context);
  return logger;
}
