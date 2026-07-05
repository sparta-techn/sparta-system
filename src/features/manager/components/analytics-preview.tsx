import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trendData, workloadByDepartment } from "../mock-data";

function Sparkline({ data, color = "stroke-primary" }: { data: number[]; color?: string }) {
  const w = 160, h = 44, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" role="img" aria-label="trend">
      <polyline fill="none" strokeWidth="2" className={color} points={pts} />
    </svg>
  );
}

export function AnalyticsPreview() {
  const charts = [
    { label: "Attendance (7d)", data: trendData.attendance, color: "stroke-success" },
    { label: "Dependencies (7d)", data: trendData.dependencies, color: "stroke-warning" },
    { label: "Report completion", data: trendData.reports, color: "stroke-primary" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analytics preview</CardTitle>
        <CardDescription>Quick trends. Open analytics for the full picture.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {charts.map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-surface/40 p-3">
              <p className="mb-1 text-xs text-muted-foreground">{c.label}</p>
              <p className="font-display text-xl font-semibold tabular-nums text-foreground">
                {c.data[c.data.length - 1]}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  vs {c.data[0]}
                </span>
              </p>
              <Sparkline data={c.data} color={c.color} />
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Workload by department</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {workloadByDepartment.map((d) => {
              const total = d.open + d.completed;
              const max = Math.max(...workloadByDepartment.map((x) => x.open + x.completed));
              const h = Math.round((total / max) * 100);
              return (
                <div key={d.dept} className="flex flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-muted/60">
                    <div className="w-full rounded-t-md bg-primary" style={{ height: `${h}%` }} aria-hidden />
                  </div>
                  <span className="truncate text-[11px] text-muted-foreground">{d.dept}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
