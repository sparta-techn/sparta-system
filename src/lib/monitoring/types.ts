/**
 * Monitoring contracts — the shared vocabulary for metrics, health, and their
 * adapters. Framework- and vendor-agnostic: nothing here imports React,
 * Supabase, or an SDK, so the module is safe on the client, during SSR, and in
 * edge/worker runtimes (same discipline as `@/lib/logging`).
 *
 * This subsystem is COMPLEMENTARY to logging:
 *   - error tracking / audit / span timings → `@/lib/logging` (errorLog, auditLog, perfLog)
 *   - counters / gauges / histograms + health → here (`@/lib/monitoring`)
 *
 * See docs/MONITORING.md.
 */

// ── Metrics ──────────────────────────────────────────────────────────────────

export type MetricType = "counter" | "gauge" | "histogram";

/** Flat, string-keyed labels (Prometheus/OTel convention). */
export type MetricLabels = Record<string, string>;

/** A single counter/gauge series value at snapshot time. */
export interface MetricSample {
  name: string;
  type: Extract<MetricType, "counter" | "gauge">;
  help?: string;
  labels: MetricLabels;
  value: number;
}

/** A histogram series at snapshot time (Prometheus cumulative buckets). */
export interface HistogramSnapshot {
  name: string;
  help?: string;
  labels: MetricLabels;
  /** Cumulative counts, ascending `le` (last bucket is +Inf). */
  buckets: readonly { le: number; count: number }[];
  sum: number;
  count: number;
}

/** Immutable view of the whole registry — what pull-based adapters render. */
export interface MetricSnapshot {
  counters: MetricSample[];
  gauges: MetricSample[];
  histograms: HistogramSnapshot[];
}

/**
 * A metrics sink. Two shapes are supported so vendors fit naturally:
 *   - **pull** (Prometheus): implement `render(snapshot)` → exposition text.
 *   - **push** (StatsD/OTel): implement `onObserve(sample)` per observation.
 * Neither must throw — the registry isolates failures.
 */
export interface MetricsAdapter {
  readonly name: string;
  /** Push model: called for each counter/gauge mutation and histogram observe. */
  onObserve?(sample: MetricSample): void;
  /** Pull model: render the current snapshot to a wire format. */
  render?(snapshot: MetricSnapshot): string;
}

// ── Health ───────────────────────────────────────────────────────────────────

/** Tri-state health, ordered worst → best for `min` comparisons. */
export type HealthStatus = "unhealthy" | "degraded" | "healthy";

export interface HealthCheckResult {
  status: HealthStatus;
  /** Short human-readable note (redacted; never secrets). */
  detail?: string;
  /** How long the check took, if measured. */
  durationMs?: number;
}

/** A single probe. May be sync or async; must resolve, not throw (wrapped). */
export type HealthCheck = () => Promise<HealthCheckResult> | HealthCheckResult;

export interface HealthCheckConfig {
  /** A failing critical check makes the whole report `unhealthy` (→ 503). */
  critical?: boolean;
  /** Per-check timeout; a timeout counts as a failure. Default 2000ms. */
  timeoutMs?: number;
}

export interface HealthReport {
  status: HealthStatus;
  /** Build/release identifiers, when available. */
  version?: string;
  release?: string;
  /** Process uptime in whole seconds. */
  uptimeSeconds: number;
  /** ISO-8601 UTC. */
  timestamp: string;
  /** Per-check results, keyed by name. Empty for a liveness report. */
  checks: Record<string, HealthCheckResult>;
}
