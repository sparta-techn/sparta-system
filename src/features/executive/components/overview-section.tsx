import { Sparkles } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import type { ExecutiveKpis } from "@/services/kpi";
import { formatKpiValue, kpiStatTrend } from "../utils";
import { DashboardSection } from "./dashboard-section";

/**
 * Overview — the 60-second read. A cross-section highlight strip (drawn from the
 * computed KPI groups) plus the AI-generated executive summary line.
 */
export function OverviewSection({ kpis, summary }: { kpis: ExecutiveKpis; summary: string }) {
  const highlights = [
    kpis.company.productivityScore,
    kpis.company.attendanceRate,
    kpis.projects.deliverySuccessRate,
    kpis.reports.reportCompletion,
  ];

  return (
    <DashboardSection
      id="overview"
      title="Overview"
      description="Company-wide health at a glance, refreshed from live operational data."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((kpi) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={formatKpiValue(kpi)}
            trend={kpiStatTrend(kpi)}
            hint="vs last period"
          />
        ))}
      </div>

      <Card className="mt-4 ring-1 ring-primary/15">
        <CardContent className="flex items-start gap-3 p-4">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">AI executive summary</h3>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
        </CardContent>
      </Card>
    </DashboardSection>
  );
}
