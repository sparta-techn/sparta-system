/** Log sinks. Console + Noop are live; the rest are prepared-but-inert. */
export { ConsoleAdapter, NoopAdapter, type ConsoleAdapterOptions } from "./console";
export {
  SentryAdapter,
  toSentryEvent,
  type SentryClient,
  type SentryEvent,
  type SentryLevel,
} from "./sentry";
export {
  LogtailAdapter,
  toLogtailPayload,
  type LogtailAdapterOptions,
  type LogtailPayload,
  type LogtailTransport,
} from "./logtail";
export {
  OtelAdapter,
  toOtelLogRecord,
  toOtelSeverity,
  OTEL_SEVERITY_NUMBER,
  type OtelEmit,
  type OtelLogRecord,
} from "./otel";
