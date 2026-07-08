/**
 * Monitoring — SpartaFlow's metrics + health architecture.
 *
 * Provider-agnostic and isomorphic, in the same spirit as `@/lib/logging`:
 *   - **Metrics**  counters/gauges/histograms via a {@link MetricRegistry},
 *                  rendered to Prometheus exposition format (Grafana on top).
 *   - **Health**   a check registry + liveness/readiness reports and Web
 *                  `Response` helpers for the health endpoint.
 *
 * Error tracking, audit trail, and span timings live in `@/lib/logging`
 * (`errorLog`, `auditLog`, `perfLog`) — import those there. This module is the
 * aggregate-metrics + health half. See docs/MONITORING.md.
 *
 * @example
 * import { metrics, metricsResponse, health, pingCheck, readinessResponse } from "@/lib/monitoring";
 */

// Metrics
export { MetricRegistry, DEFAULT_LATENCY_BUCKETS } from "./registry";
export { metrics, registry, metricsResponse } from "./metrics";

// Health
export {
  HealthRegistry,
  health,
  pingCheck,
  healthStatusCode,
  livenessResponse,
  readinessResponse,
} from "./health";

// Adapters (future vendors)
export {
  PrometheusAdapter,
  renderPrometheus,
  PROMETHEUS_CONTENT_TYPE,
} from "./adapters/prometheus";

// Contracts
export type {
  MetricType,
  MetricLabels,
  MetricSample,
  HistogramSnapshot,
  MetricSnapshot,
  MetricsAdapter,
  HealthStatus,
  HealthCheck,
  HealthCheckConfig,
  HealthCheckResult,
  HealthReport,
} from "./types";
