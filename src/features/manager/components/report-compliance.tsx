import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { managerEmployees } from "../mock-data";

function rate(key: "checkin" | "midday" | "eod") {
  const eligible = managerEmployees.filter((e) => e.reports[key] !== "na");
  const done = eligible.filter((e) => e.reports[key] === "done").length;
  return {
    done,
    total: eligible.length,
    pct: Math.round((done / Math.max(1, eligible.length)) * 100),
  };
}

export function ReportCompliance() {
  const checkin = rate("checkin");
  const midday = rate("midday");
  const eod = rate("eod");
  const missing = managerEmployees.filter((e) =>
    Object.values(e.reports).includes("missed"),
  ).length;
  const late = managerEmployees.filter((e) => Object.values(e.reports).includes("pending")).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report compliance</CardTitle>
        <CardDescription>Daily reporting completion across the team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row label="Morning check-in" data={checkin} />
        <Row label="Midday status" data={midday} />
        <Row label="End-of-day report" data={eod} />
        <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
          <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Missing</p>
            <p className="font-display text-xl font-semibold tabular-nums text-destructive">
              {missing}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Late / Pending
            </p>
            <p className="font-display text-xl font-semibold tabular-nums text-warning">{late}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  data,
}: {
  label: string;
  data: { done: number; total: number; pct: number };
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {data.done}/{data.total} · {data.pct}%
        </span>
      </div>
      <Progress value={data.pct} />
    </div>
  );
}
