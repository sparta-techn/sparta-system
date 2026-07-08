import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Heatmap, LineChart, TrendCard } from "../charts";
import { ChartCard } from "./chart-card";
import { InsightGrid } from "./insight-card";
import { insightsByScope, personalAnalytics } from "../mock-data";

export function PersonalDashboard() {
  const k = personalAnalytics.kpis;
  return (
    <div className="space-y-6">
      <section aria-label="Personal KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TrendCard label="Attendance rate" value={k.attendanceRate} />
        <TrendCard label="Working hours / day" value={k.workingHours} />
        <TrendCard label="Work health" value={k.healthScore} hint="composite" />
        <TrendCard label="Avg resolution time" value={k.avgResolutionHrs} positiveIsDown />
      </section>

      <section aria-label="Personal insights">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Insights for you</h3>
        <InsightGrid insights={insightsByScope.personal} />
      </section>

      <section aria-label="Trends" className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Attendance trend" description="Weekly rate over the last 8 weeks">
          <LineChart
            data={personalAnalytics.attendanceTrend}
            colorClass="stroke-success"
            formatValue={(n) => `${n}%`}
            ariaLabel="Attendance"
          />
        </ChartCard>
        <ChartCard title="Working hours" description="Hours logged this week">
          <BarChart
            data={personalAnalytics.workingHoursTrend}
            colorClasses={["fill-primary"]}
            ariaLabel="Working hours"
          />
        </ChartCard>
        <ChartCard title="Work health" description="Composite of attendance, focus, and reporting">
          <LineChart
            data={personalAnalytics.workHealthTrend}
            colorClass="stroke-primary"
            ariaLabel="Health"
          />
        </ChartCard>
        <ChartCard title="Avg resolution time" description="Hours to resolve dependencies you own">
          <LineChart
            data={personalAnalytics.resolutionTimeTrend}
            colorClass="stroke-warning"
            formatValue={(n) => `${n}h`}
            ariaLabel="Resolution time"
          />
        </ChartCard>
      </section>

      <section aria-label="Reports & dependencies" className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report completion</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {personalAnalytics.reportCompletion.map((r) => (
              <div key={r.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{r.value}%</span>
                </div>
                <Progress value={r.value} />
              </div>
            ))}
          </CardContent>
        </Card>
        <ChartCard title="Dependencies created" description="Weekly volume">
          <BarChart
            data={personalAnalytics.dependencies}
            colorClasses={["fill-info"]}
            ariaLabel="Dependencies created"
          />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Created vs resolved</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric
              label="Created"
              value={String(k.depsCreated.current)}
              sub={`was ${k.depsCreated.previous}`}
            />
            <Metric
              label="Resolved"
              value={String(k.depsResolved.current)}
              sub={`was ${k.depsResolved.previous}`}
              positive
            />
            <Metric
              label="Avg resolution"
              value={`${k.avgResolutionHrs.current}h`}
              sub={`was ${k.avgResolutionHrs.previous}h`}
              positive
            />
          </CardContent>
        </Card>
      </section>

      <section aria-label="Activity pattern">
        <ChartCard
          title="When you do focused work"
          description="Daily activity intensity by hour band (mock)."
        >
          <Heatmap
            data={personalAnalytics.activityHeatmap}
            rowLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
            colLabels={["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p"]}
          />
        </ChartCard>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className={`text-xs ${positive ? "text-success" : "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
}
