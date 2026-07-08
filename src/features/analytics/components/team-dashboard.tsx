import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, DonutChart, LineChart, TrendCard } from "../charts";
import { ChartCard } from "./chart-card";
import { InsightGrid } from "./insight-card";
import { insightsByScope, teamAnalytics } from "../mock-data";

export function TeamDashboard() {
  const k = teamAnalytics.kpis;
  return (
    <div className="space-y-6">
      <section aria-label="Team KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TrendCard label="Attendance" value={k.attendance} />
        <TrendCard label="Report completion" value={k.reportCompletion} />
        <TrendCard label="Open dependencies" value={k.openDeps} positiveIsDown />
        <TrendCard label="Avg blocker duration" value={k.avgBlockerHrs} positiveIsDown />
        <TrendCard label="Resolved dependencies" value={k.resolvedDeps} />
        <TrendCard label="Avg session length" value={k.avgSessionHrs} />
        <TrendCard label="Team health" value={k.healthScore} hint="composite" />
      </section>

      <section>
        <InsightGrid insights={insightsByScope.team} />
      </section>

      <section aria-label="Trends" className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Attendance trend" description="Weekly team attendance rate">
          <LineChart
            data={teamAnalytics.attendanceTrend}
            colorClass="stroke-success"
            formatValue={(n) => `${n}%`}
          />
        </ChartCard>
        <ChartCard title="Report completion trend" description="Across all daily reports">
          <LineChart
            data={teamAnalytics.reportTrend}
            colorClass="stroke-primary"
            formatValue={(n) => `${n}%`}
          />
        </ChartCard>
        <ChartCard title="Dependencies opened vs resolved" description="Weekly flow">
          <BarChart
            data={teamAnalytics.dependencyFlow}
            series={[
              { label: "opened", values: [] },
              { label: "resolved", values: [] },
            ]}
            colorClasses={["fill-warning", "fill-success"]}
          />
        </ChartCard>
        <ChartCard title="Avg blocker duration" description="Hours from open to resolved">
          <LineChart
            data={teamAnalytics.blockerDurationTrend}
            colorClass="stroke-warning"
            formatValue={(n) => `${n}h`}
          />
        </ChartCard>
      </section>

      <section aria-label="Workload & health" className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Workload distribution</CardTitle>
            <CardDescription>Open vs completed work per member.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamAnalytics.workloadByMember.map((m) => {
              const total = m.open + m.completed;
              const openPct = Math.round((m.open / total) * 100);
              return (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{m.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {m.open} open · {m.completed} done
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-warning" style={{ width: `${openPct}%` }} aria-hidden />
                    <div
                      className="bg-success"
                      style={{ width: `${100 - openPct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <ChartCard title="Team health breakdown" description="Composite signals">
          <DonutChart
            data={teamAnalytics.healthBreakdown}
            centerValue={String(k.healthScore.current)}
            centerLabel="Health"
          />
        </ChartCard>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance snapshot</CardTitle>
            <CardDescription>Daily report completion across the team.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Morning check-in", value: 94 },
              { label: "Midday status", value: 88 },
              { label: "End-of-day", value: 91 },
            ].map((c) => (
              <div key={c.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{c.value}%</span>
                </div>
                <Progress value={c.value} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
