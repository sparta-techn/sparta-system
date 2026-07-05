import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { managerHealth } from "../mock-data";

export function TeamHealth() {
  const h = managerHealth;
  const items = [
    { label: "Attendance rate", value: Math.round(h.attendanceRate * 100), unit: "%" },
    { label: "Report completion", value: Math.round(h.reportCompletion * 100), unit: "%" },
    { label: "Dependency resolution", value: Math.round(h.dependencyResolutionRate * 100), unit: "%" },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Team health</CardTitle>
            <CardDescription>Composite score across attendance, reporting, and flow.</CardDescription>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{h.overallScore}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">/ 100</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((i) => (
          <div key={i.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{i.label}</span>
              <span className="font-medium tabular-nums text-foreground">{i.value}{i.unit}</span>
            </div>
            <Progress value={i.value} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Metric label="Avg response" value={`${h.avgResponseMins}m`} />
          <Metric label="Avg working" value={`${h.avgWorkingHours}h`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
