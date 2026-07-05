import { TrendCard } from "@/features/analytics/charts";
import type { Kpi } from "@/services/kpi";
import { kpiHint, kpiToBenchmark } from "../utils";

/**
 * Reusable KPI widget — renders any service {@link Kpi} through the shared
 * `TrendCard` (value + benchmark delta). Used by every section so KPIs look and
 * behave identically across the dashboard. Direction is taken from the KPI's
 * own `goodDirection`, so "lower is better" metrics (blocked tasks, missing
 * reports, response time) colour correctly without per-call config.
 */
export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <TrendCard
      label={kpi.label}
      value={kpiToBenchmark(kpi)}
      positiveIsDown={kpi.goodDirection === "down"}
      hint={kpiHint(kpi)}
    />
  );
}

/** A responsive grid of KPI cards. */
export function KpiCardGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}
