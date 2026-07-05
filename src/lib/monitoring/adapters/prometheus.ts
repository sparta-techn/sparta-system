/**
 * Prometheus adapter — pull-based exposition renderer (PREPARED).
 *
 * Pure mapping from a {@link MetricSnapshot} to the Prometheus text exposition
 * format (v0.0.4). No dependency, no HTTP — a future `/metrics` endpoint (or the
 * `metricsResponse` helper in `../metrics`) serves the string this produces, and
 * Prometheus scrapes it; **Grafana** then dashboards/alerts over Prometheus.
 *
 * Registering `new PrometheusAdapter()` on a registry lets `registry.render()`
 * return exposition text. It never mutates state, so it is safe everywhere.
 */
import type {
  HistogramSnapshot,
  MetricSample,
  MetricSnapshot,
  MetricsAdapter,
} from "../types";

/** Escape a label value per the exposition format (\\, \n, \"). */
function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function formatLabels(labels: Record<string, string>, extra?: Record<string, string>): string {
  const all = { ...labels, ...extra };
  const keys = Object.keys(all).sort();
  if (keys.length === 0) return "";
  return `{${keys.map((k) => `${k}="${escapeLabelValue(all[k])}"`).join(",")}}`;
}

function formatValue(v: number): string {
  if (v === Number.POSITIVE_INFINITY) return "+Inf";
  if (v === Number.NEGATIVE_INFINITY) return "-Inf";
  return Number.isFinite(v) ? String(v) : "NaN";
}

function renderSimple(samples: MetricSample[]): string {
  const lines: string[] = [];
  const seenMeta = new Set<string>();
  for (const s of samples) {
    if (!seenMeta.has(s.name)) {
      if (s.help) lines.push(`# HELP ${s.name} ${s.help}`);
      lines.push(`# TYPE ${s.name} ${s.type}`);
      seenMeta.add(s.name);
    }
    lines.push(`${s.name}${formatLabels(s.labels)} ${formatValue(s.value)}`);
  }
  return lines.join("\n");
}

function renderHistogram(h: HistogramSnapshot): string {
  const lines: string[] = [];
  if (h.help) lines.push(`# HELP ${h.name} ${h.help}`);
  lines.push(`# TYPE ${h.name} histogram`);
  for (const b of h.buckets) {
    lines.push(`${h.name}_bucket${formatLabels(h.labels, { le: formatValue(b.le) })} ${b.count}`);
  }
  lines.push(`${h.name}_sum${formatLabels(h.labels)} ${formatValue(h.sum)}`);
  lines.push(`${h.name}_count${formatLabels(h.labels)} ${h.count}`);
  return lines.join("\n");
}

/** Render a snapshot to Prometheus text exposition format. */
export function renderPrometheus(snapshot: MetricSnapshot): string {
  const blocks: string[] = [];
  if (snapshot.counters.length) blocks.push(renderSimple(snapshot.counters));
  if (snapshot.gauges.length) blocks.push(renderSimple(snapshot.gauges));
  for (const h of snapshot.histograms) blocks.push(renderHistogram(h));
  // Exposition format requires a trailing newline.
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

/** Content-Type for the exposition endpoint. */
export const PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

export class PrometheusAdapter implements MetricsAdapter {
  readonly name = "prometheus";
  render(snapshot: MetricSnapshot): string {
    return renderPrometheus(snapshot);
  }
}
