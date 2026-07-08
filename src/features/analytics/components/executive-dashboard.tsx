import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, LineChart, TrendCard } from "../charts";
import { ChartCard } from "./chart-card";
import { InsightGrid } from "./insight-card";
import { executiveAnalytics, insightsByScope } from "../mock-data";

const SEVERITY_CLASS: Record<"high" | "medium" | "low", string> = {
  high: "bg-destructive text-destructive-foreground border-transparent",
  medium: "bg-warning text-warning-foreground border-transparent",
  low: "bg-secondary text-secondary-foreground border-transparent",
};

const STATUS_CLASS: Record<string, string> = {
  Critical: "bg-destructive text-destructive-foreground border-transparent",
  "At risk": "bg-warning text-warning-foreground border-transparent",
  "On track": "bg-success text-success-foreground border-transparent",
};

export function ExecutiveDashboard() {
  const k = executiveAnalytics.kpis;
  return (
    <div className="space-y-6">
      <section aria-label="Executive KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TrendCard label="Company health" value={k.companyHealth} hint="composite" />
        <TrendCard label="Attendance compliance" value={k.attendance} />
        <TrendCard label="Report compliance" value={k.reportCompliance} />
        <TrendCard label="Open operational risks" value={k.openRisks} positiveIsDown />
      </section>

      <section>
        <InsightGrid insights={insightsByScope.executive} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Department health</CardTitle>
            <CardDescription>
              Composite score across attendance, reporting, and flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {executiveAnalytics.departmentHealth.map((d) => (
              <div key={d.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{d.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {d.headcount} people · score {d.score}
                  </span>
                </div>
                <Progress value={d.score} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Operational risks
            </CardTitle>
            <CardDescription>Sorted by severity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {executiveAnalytics.operationalRisks.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface/40 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge className={`capitalize ${SEVERITY_CLASS[r.severity]}`}>{r.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{r.owner}</span>
                </div>
                <p className="text-sm text-foreground">{r.title}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Dependency trend" description="Company-wide opened vs resolved">
          <BarChart
            data={executiveAnalytics.dependencyTrend}
            series={[
              { label: "opened", values: [] },
              { label: "resolved", values: [] },
            ]}
            colorClasses={["fill-warning", "fill-success"]}
          />
        </ChartCard>
        <ChartCard title="Report & attendance compliance" description="Weekly">
          <LineChart
            data={executiveAnalytics.reportTrend}
            colorClass="stroke-primary"
            formatValue={(n) => `${n}%`}
            ariaLabel="Report compliance"
          />
          <div className="mt-4">
            <LineChart
              data={executiveAnalytics.attendanceTrend}
              colorClass="stroke-success"
              formatValue={(n) => `${n}%`}
              ariaLabel="Attendance compliance"
            />
          </div>
        </ChartCard>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project health</CardTitle>
            <CardDescription>Ranked by composite score with open blockers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Blockers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executiveAnalytics.projectHealth.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CLASS[p.status] ?? ""}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.score}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.blockers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
