/**
 * MetricRegistry — an in-memory, isomorphic collector for counters, gauges, and
 * histograms with labels. Provider-agnostic: it holds numbers and produces an
 * immutable {@link MetricSnapshot}; wire formats live in adapters (Prometheus).
 *
 * Optional push adapters receive each observation; pull adapters read
 * {@link MetricRegistry.snapshot}. Adapter failures are isolated.
 */
import type {
  HistogramSnapshot,
  MetricLabels,
  MetricSample,
  MetricSnapshot,
  MetricsAdapter,
} from "./types";

/** Default latency buckets (seconds) — web-request oriented. */
export const DEFAULT_LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

/** Stable series key: name + sorted labels. */
function seriesKey(name: string, labels: MetricLabels): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}{${parts.join(",")}}`;
}

interface CounterState {
  name: string;
  help?: string;
  labels: MetricLabels;
  value: number;
}
interface GaugeState extends CounterState {}
interface HistogramState {
  name: string;
  help?: string;
  labels: MetricLabels;
  bounds: readonly number[];
  counts: number[]; // per-bucket (non-cumulative); index === bounds index; last === +Inf overflow
  sum: number;
  count: number;
}

export class MetricRegistry {
  private counters = new Map<string, CounterState>();
  private gauges = new Map<string, GaugeState>();
  private histograms = new Map<string, HistogramState>();
  private adapters: MetricsAdapter[] = [];

  /** Register a push/pull adapter (e.g. a Prometheus renderer bound elsewhere). */
  addAdapter(adapter: MetricsAdapter): void {
    this.adapters.push(adapter);
  }

  private push(sample: MetricSample): void {
    for (const a of this.adapters) {
      if (!a.onObserve) continue;
      try {
        a.onObserve(sample);
      } catch {
        /* adapters must never break instrumentation */
      }
    }
  }

  // ── Counter ────────────────────────────────────────────────────────────────

  /** Add to a monotonic counter (default +1). */
  incCounter(name: string, labels: MetricLabels = {}, value = 1, help?: string): void {
    if (value < 0) return; // counters never decrease
    const key = seriesKey(name, labels);
    const cur = this.counters.get(key) ?? { name, help, labels, value: 0 };
    cur.value += value;
    if (help && !cur.help) cur.help = help;
    this.counters.set(key, cur);
    this.push({ name, type: "counter", help: cur.help, labels, value: cur.value });
  }

  // ── Gauge ──────────────────────────────────────────────────────────────────

  /** Set a gauge to an absolute value. */
  setGauge(name: string, value: number, labels: MetricLabels = {}, help?: string): void {
    const key = seriesKey(name, labels);
    this.gauges.set(key, { name, help, labels, value });
    this.push({ name, type: "gauge", help, labels, value });
  }

  /** Add a delta to a gauge (may be negative). */
  addGauge(name: string, delta: number, labels: MetricLabels = {}, help?: string): void {
    const key = seriesKey(name, labels);
    const cur = this.gauges.get(key) ?? { name, help, labels, value: 0 };
    cur.value += delta;
    if (help && !cur.help) cur.help = help;
    this.gauges.set(key, cur);
    this.push({ name, type: "gauge", help: cur.help, labels, value: cur.value });
  }

  // ── Histogram ────────────────────────────────────────────────────────────────

  /** Observe a value into a histogram (creating it with `bounds` if new). */
  observe(
    name: string,
    value: number,
    labels: MetricLabels = {},
    bounds: readonly number[] = DEFAULT_LATENCY_BUCKETS,
    help?: string,
  ): void {
    const key = seriesKey(name, labels);
    let h = this.histograms.get(key);
    if (!h) {
      const sorted = [...bounds].sort((a, b) => a - b);
      h = { name, help, labels, bounds: sorted, counts: new Array(sorted.length + 1).fill(0), sum: 0, count: 0 };
      this.histograms.set(key, h);
    }
    // Find the first bucket whose upper bound >= value; else the +Inf overflow.
    let idx = h.bounds.findIndex((b) => value <= b);
    if (idx === -1) idx = h.bounds.length; // +Inf bucket
    h.counts[idx] += 1;
    h.sum += value;
    h.count += 1;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  /** Immutable view for pull-based adapters / exposition. */
  snapshot(): MetricSnapshot {
    const counters: MetricSample[] = [...this.counters.values()].map((c) => ({
      name: c.name,
      type: "counter",
      help: c.help,
      labels: c.labels,
      value: c.value,
    }));
    const gauges: MetricSample[] = [...this.gauges.values()].map((g) => ({
      name: g.name,
      type: "gauge",
      help: g.help,
      labels: g.labels,
      value: g.value,
    }));
    const histograms: HistogramSnapshot[] = [...this.histograms.values()].map((h) => {
      // Cumulative buckets, ascending le, terminating at +Inf.
      const buckets: { le: number; count: number }[] = [];
      let cumulative = 0;
      h.bounds.forEach((le, i) => {
        cumulative += h.counts[i];
        buckets.push({ le, count: cumulative });
      });
      cumulative += h.counts[h.bounds.length]; // overflow
      buckets.push({ le: Number.POSITIVE_INFINITY, count: cumulative });
      return { name: h.name, help: h.help, labels: h.labels, buckets, sum: h.sum, count: h.count };
    });
    return { counters, gauges, histograms };
  }

  /** Render via the first adapter that supports pull rendering (else ""). */
  render(): string {
    const snap = this.snapshot();
    for (const a of this.adapters) {
      if (a.render) return a.render(snap);
    }
    return "";
  }

  /** Clear all series (tests / process reset). */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}
