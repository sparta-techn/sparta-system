/**
 * Application + performance metrics facade.
 *
 * A process-wide {@link MetricRegistry} plus a small, purpose-built `metrics`
 * API so call sites instrument consistently (mirrors the `appLog`/`perfLog`
 * category-service idea in `@/lib/logging`). Complements `perfLog` (which emits
 * timing *logs*): here we aggregate the same events into counters/histograms
 * suitable for Prometheus/Grafana.
 *
 * @example
 *   import { metrics } from "@/lib/monitoring";
 *   const stop = metrics.startTimer("route.tasks.load", { route: "/app/tasks" });
 *   // …work…
 *   stop();                       // observes duration into a histogram
 *   metrics.recordError("render"); // errors_captured_total{kind="render"}++
 */
import { MetricRegistry } from "./registry";
import { PrometheusAdapter, PROMETHEUS_CONTENT_TYPE } from "./adapters/prometheus";
import type { MetricLabels } from "./types";

/** The default, process-wide registry. Import `registry` for custom series. */
export const registry = new MetricRegistry();

// A Prometheus renderer is registered so `registry.render()` / `metricsResponse`
// produce exposition text out of the box. It is pull-only and side-effect-free.
registry.addAdapter(new PrometheusAdapter());

const HTTP_REQUESTS = "http_requests_total";
const HTTP_ERRORS = "http_errors_total";
const HTTP_DURATION = "http_request_duration_seconds";
const OP_DURATION = "operation_duration_seconds";
const ERRORS_CAPTURED = "errors_captured_total";

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export const metrics = {
  /** The underlying registry (custom counters/gauges/histograms). */
  registry,

  /** Increment an arbitrary counter. */
  inc(name: string, labels?: MetricLabels, value = 1, help?: string): void {
    registry.incCounter(name, labels, value, help);
  },

  /** Set an arbitrary gauge (e.g. queue depth, active sessions). */
  gauge(name: string, value: number, labels?: MetricLabels, help?: string): void {
    registry.setGauge(name, value, labels, help);
  },

  /** Observe a duration (ms) into a histogram (stored in seconds). */
  observeDuration(name: string, durationMs: number, labels?: MetricLabels): void {
    registry.observe(name, durationMs / 1000, labels);
  },

  /** Start a timer; call the returned fn to observe elapsed time into `name`. */
  startTimer(name: string, labels?: MetricLabels): () => void {
    const t0 = now();
    return () => metrics.observeDuration(name, now() - t0, labels);
  },

  /** Record one HTTP request (count + optional error + optional latency). */
  recordHttp(method: string, route: string, status: number, durationMs?: number): void {
    const labels = { method, route, status: String(status) };
    registry.incCounter(HTTP_REQUESTS, labels, 1, "Total HTTP requests");
    if (status >= 500) {
      registry.incCounter(HTTP_ERRORS, { method, route }, 1, "Total HTTP 5xx responses");
    }
    if (durationMs !== undefined) {
      registry.observe(HTTP_DURATION, durationMs / 1000, { method, route });
    }
  },

  /** Record a captured exception (pair with `errorLog.capture`). */
  recordError(kind: string, labels?: MetricLabels): void {
    registry.incCounter(ERRORS_CAPTURED, { kind, ...labels }, 1, "Exceptions captured");
  },

  /** Observe a named operation's duration (ms) — generic app/perf timing. */
  observeOperation(name: string, durationMs: number, labels?: MetricLabels): void {
    registry.observe(OP_DURATION, durationMs / 1000, { op: name, ...labels });
  },
};

/**
 * Build a Web `Response` exposing the current metrics in Prometheus format.
 * Mount this behind an internal/authorized path (see docs/MONITORING.md).
 */
export function metricsResponse(): Response {
  return new Response(registry.render(), {
    status: 200,
    headers: { "content-type": PROMETHEUS_CONTENT_TYPE },
  });
}
