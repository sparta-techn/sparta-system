/**
 * Logging — production logging architecture for SpartaFlow.
 *
 * Reusable, isomorphic (browser / SSR / edge) logging with six category
 * services and pluggable sinks. Console output is live everywhere; Sentry,
 * Logtail, and OpenTelemetry sinks are prepared but inert until wired via
 * `configureLogging`. See `docs/LOGGING.md`.
 *
 * @example
 * import { appLog, errorLog, auditLog, perfLog } from "@/lib/logging";
 * appLog.info("checkout started", { cartSize: 3 });
 * errorLog.capture(err, { context: { feature: "attendance" } });
 */

// Category services — the primary call-site API.
export {
  appLog,
  errorLog,
  auditLog,
  authLog,
  activityLog,
  perfLog,
  type AuditRecord,
  type CaptureOptions,
} from "./services";

// Configuration + default logger.
export {
  logger,
  configureLogging,
  defaultAdapters,
  getEnvironment,
  isProduction,
  getRuntime,
  type ConfigureLoggingOptions,
} from "./config";

// Engine (for advanced use / custom loggers).
export { Logger, serializeError, type LoggerConfig, type EmitOptions } from "./logger";

// Correlation + ambient context.
export {
  newCorrelationId,
  ensureCorrelationId,
  getLogContext,
  setLogContext,
  resetLogContext,
  runWithContext,
} from "./correlation";

// Redaction.
export { redact, redactRecord, maskEmail, REDACTED, type RedactOptions } from "./redact";

// Adapters.
export {
  ConsoleAdapter,
  NoopAdapter,
  SentryAdapter,
  LogtailAdapter,
  OtelAdapter,
  toSentryEvent,
  toLogtailPayload,
  toOtelLogRecord,
  toOtelSeverity,
} from "./adapters";

// Contracts.
export {
  LOG_LEVELS,
  LEVEL_WEIGHT,
  meetsLevel,
  type LogLevel,
  type LogCategory,
  type LogContext,
  type LogRecord,
  type LogAdapter,
  type SerializedError,
  type AuditEvent,
  type AuthEvent,
  type AuthEventType,
  type ActivityEvent,
  type PerformanceEvent,
} from "./types";
