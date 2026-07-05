import type { BenchmarkValue } from "@/features/analytics/types";
import type { Kpi } from "@/services/kpi";

/**
 * Adapt a service {@link Kpi} to the {@link BenchmarkValue} the existing
 * `TrendCard` consumes. `points` (story points) has no TrendCard format, so it
 * renders as a plain number; `previous` falls back to the current value so an
 * un-benchmarked KPI shows a flat delta rather than a divide-by-zero.
 */
export function kpiToBenchmark(kpi: Kpi): BenchmarkValue {
  const format: BenchmarkValue["format"] = kpi.format === "points" ? "number" : kpi.format;
  return {
    current: kpi.value,
    previous: kpi.previous ?? kpi.value,
    format,
  };
}

/** Optional unit hint shown under a KPI value (e.g. "story points"). */
export function kpiHint(kpi: Kpi): string | undefined {
  if (kpi.format === "points") return "story points";
  if (kpi.key === "avgResponseTime") return "prompt → submit";
  return undefined;
}

/** Format a KPI value for a plain `StatCard` (which takes a string/number). */
export function formatKpiValue(kpi: Kpi): string {
  switch (kpi.format) {
    case "percent":
      return `${Math.round(kpi.value)}%`;
    case "hours":
      return `${kpi.value}h`;
    case "minutes":
      return `${kpi.value}m`;
    case "points":
      return `${kpi.value} pts`;
    default:
      return `${kpi.value}`;
  }
}

/** Map a KPI's benchmark movement to a `StatCard` trend badge. */
export function kpiStatTrend(kpi: Kpi):
  | {
      direction: "up" | "down" | "flat";
      value: string;
      intent: "positive" | "negative" | "neutral";
    }
  | undefined {
  if (kpi.trend === undefined || kpi.deltaPct === undefined) return undefined;
  const isGood =
    kpi.trend === "flat"
      ? false
      : kpi.goodDirection === "down"
        ? kpi.trend === "down"
        : kpi.trend === "up";
  return {
    direction: kpi.trend,
    value: `${kpi.deltaPct > 0 ? "+" : ""}${kpi.deltaPct}%`,
    intent: kpi.trend === "flat" ? "neutral" : isGood ? "positive" : "negative",
  };
}
