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
import { LineChart } from "@/features/analytics/charts";
import { ChartCard } from "@/features/analytics/components/chart-card";
import type { TrendPoint } from "@/features/analytics/types";
import type { ProjectKpis } from "@/services/kpi";
import type { ProjectHealthRow } from "../types";
import { KpiCard } from "./kpi-card";
import { DashboardSection } from "./dashboard-section";

const STATUS_CLASS: Record<ProjectHealthRow["status"], string> = {
  "On track": "bg-success text-success-foreground border-transparent",
  "At risk": "bg-warning text-warning-foreground border-transparent",
  Delayed: "bg-destructive text-destructive-foreground border-transparent",
  Completed: "bg-secondary text-secondary-foreground border-transparent",
};

/** Projects — portfolio KPIs, delivery throughput trend, and a health table. */
export function ProjectsSection({
  kpis,
  throughput,
  health,
}: {
  kpis: ProjectKpis;
  throughput: TrendPoint[];
  health: ProjectHealthRow[];
}) {
  const cards = [
    kpis.activeProjects,
    kpis.delayedProjects,
    kpis.completionRate,
    kpis.deliverySuccessRate,
  ];
  return (
    <DashboardSection
      id="projects"
      title="Projects"
      description="Portfolio delivery health and throughput."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Delivery throughput"
          description="Tasks completed per week"
          className="xl:col-span-1"
        >
          <LineChart data={throughput} colorClass="stroke-primary" ariaLabel="Weekly throughput" />
        </ChartCard>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Project health</CardTitle>
            <CardDescription>Ranked by risk, with open blockers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead className="text-right">Blockers</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CLASS[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="h-2" />
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {p.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.openBlockers}</TableCell>
                    <TableCell className="text-muted-foreground">{p.owner}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardSection>
  );
}
