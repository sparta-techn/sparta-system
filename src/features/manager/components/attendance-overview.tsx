import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { managerEmployees, type ManagerStatus } from "../mock-data";

const BUCKETS: Array<{ key: ManagerStatus | "weekend"; label: string; cls: string }> = [
  { key: "working", label: "Working", cls: "bg-success" },
  { key: "late", label: "Late", cls: "bg-warning" },
  { key: "absent", label: "Absent", cls: "bg-destructive" },
  { key: "on_leave", label: "On leave", cls: "bg-info" },
  { key: "holiday", label: "Holiday", cls: "bg-primary" },
  { key: "weekend", label: "Weekend", cls: "bg-muted-foreground/40" },
  { key: "finished", label: "Checked out", cls: "bg-muted-foreground" },
];

export function AttendanceOverview() {
  const counts = managerEmployees.reduce(
    (acc, e) => { acc[e.status] = (acc[e.status] ?? 0) + 1; return acc; },
    {} as Record<ManagerStatus, number>,
  );
  const weekend = 0;
  const total = managerEmployees.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendance overview</CardTitle>
        <CardDescription>Today's breakdown across all states.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {BUCKETS.map((b) => {
            const value = b.key === "weekend" ? weekend : (counts[b.key as ManagerStatus] ?? 0);
            const w = (value / total) * 100;
            if (!w) return null;
            return <div key={b.key} className={b.cls} style={{ width: `${w}%` }} aria-label={`${b.label}: ${value}`} />;
          })}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          {BUCKETS.map((b) => {
            const value = b.key === "weekend" ? weekend : (counts[b.key as ManagerStatus] ?? 0);
            return (
              <li key={b.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={`size-2 rounded-full ${b.cls}`} aria-hidden />
                  {b.label}
                </span>
                <span className="tabular-nums font-medium text-foreground">{value}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
