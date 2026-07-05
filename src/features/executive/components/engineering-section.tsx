import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart } from "@/features/analytics/charts";
import { ChartCard } from "@/features/analytics/components/chart-card";
import type { TrendPoint } from "@/features/analytics/types";
import type { EngineeringKpis } from "@/services/kpi";
import { KpiCard } from "./kpi-card";
import { DashboardSection } from "./dashboard-section";

/** Engineering — velocity, blockers, capacity, and workload balance (Sprint + Tasks + Time). */
export function EngineeringSection({
  kpis,
  velocity,
}: {
  kpis: EngineeringKpis;
  velocity: TrendPoint[];
}) {
  const cards = [kpis.sprintVelocity, kpis.blockedTasks, kpis.teamCapacity, kpis.workloadBalance];
  const buckets = kpis.workload.buckets.slice(0, 6);

  return (
    <DashboardSection
      id="engineering"
      title="Engineering"
      description="Delivery velocity, blockers, and how load is spread across the team."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Sprint velocity" description="Completed story points per sprint">
          <BarChart data={velocity} colorClasses={["fill-primary"]} ariaLabel="Sprint velocity" />
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workload distribution</CardTitle>
            <CardDescription>
              Open tasks per engineer · balance {kpis.workload.balanceIndex}/100
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {buckets.map((b) => (
              <div key={b.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {b.key === "unassigned" ? "Unassigned" : b.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {b.openTasks} tasks · {b.sharePct}%
                  </span>
                </div>
                <Progress value={b.sharePct} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardSection>
  );
}
