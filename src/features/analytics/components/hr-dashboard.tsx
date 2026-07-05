import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, DonutChart, LineChart, TrendCard } from "../charts";
import { ChartCard } from "./chart-card";
import { InsightGrid } from "./insight-card";
import { hrAnalytics, insightsByScope } from "../mock-data";

export function HrDashboard() {
  const k = hrAnalytics.kpis;
  return (
    <div className="space-y-6">
      <section aria-label="HR KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <TrendCard label="Attendance compliance" value={k.compliance} />
        <TrendCard label="Pending leave" value={k.pendingLeave} positiveIsDown />
        <TrendCard label="New hires (30d)" value={k.newHires30} />
        <TrendCard label="Retention" value={k.retention} hint="placeholder" />
        <TrendCard label="Invite conversion" value={k.inviteConversion} />
        <TrendCard label="Onboarding completion" value={k.onboardingCompletion} />
      </section>

      <section><InsightGrid insights={insightsByScope.hr} /></section>

      <section aria-label="Trends" className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Attendance compliance" description="Last 6 months">
          <LineChart data={hrAnalytics.attendanceCompliance} colorClass="stroke-success" formatValue={(n) => `${n}%`} />
        </ChartCard>
        <ChartCard title="Leave trends" description="Sick · vacation · personal">
          <BarChart
            data={hrAnalytics.leaveTrend}
            series={[
              { label: "sick", values: [] },
              { label: "vacation", values: [] },
              { label: "personal", values: [] },
            ]}
            colorClasses={["fill-destructive", "fill-success", "fill-info"]}
          />
        </ChartCard>
        <ChartCard title="New hires" description="Monthly intake">
          <BarChart data={hrAnalytics.newHiresTrend} colorClasses={["fill-primary"]} />
        </ChartCard>
        <ChartCard title="Onboarding completion" description="By cohort">
          <LineChart data={hrAnalytics.onboardingByCohort} colorClass="stroke-primary" formatValue={(n) => `${n}%`} />
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Invitation funnel</CardTitle>
            <CardDescription>Sent → opened → accepted → activated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hrAnalytics.inviteFunnel.map((s, i) => {
              const top = hrAnalytics.inviteFunnel[0].value;
              const pct = Math.round((s.value / top) * 100);
              return (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{i + 1}. {s.label}</span>
                    <span className="font-medium tabular-nums text-foreground">{s.value} · {pct}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} aria-hidden />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <ChartCard title="Department growth" description="Headcount distribution">
          <DonutChart data={hrAnalytics.departmentGrowth} centerValue="100" centerLabel="People" />
        </ChartCard>
      </section>
    </div>
  );
}
