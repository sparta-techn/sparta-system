import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { managerEmployees, workloadByDepartment } from "../mock-data";

export function WorkloadDistribution() {
  const maxTotal = Math.max(...workloadByDepartment.map((d) => d.open + d.completed));
  // Mock: tasks per employee = openDependencies * 3 + (status weight)
  const enriched = managerEmployees.map((e) => ({
    ...e,
    load: e.openDependencies * 3 + (e.status === "working" ? 6 : 1),
  }));
  const sorted = [...enriched].sort((a, b) => b.load - a.load);
  const top = sorted.slice(0, 3);
  const bottom = sorted.filter((e) => e.status === "working").slice(-3).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workload distribution</CardTitle>
        <CardDescription>Open vs completed work by department, and people to rebalance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2.5">
          {workloadByDepartment.map((d) => {
            const total = d.open + d.completed;
            const openPct = (d.open / maxTotal) * 100;
            const donePct = (d.completed / maxTotal) * 100;
            return (
              <div key={d.dept} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{d.dept}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="text-warning">{d.open} open</span> · <span className="text-success">{d.completed} done</span> · {total}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="bg-warning" style={{ width: `${openPct}%` }} aria-hidden />
                  <div className="bg-success" style={{ width: `${donePct}%` }} aria-hidden />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PeopleList title="Overloaded" tone="warning" people={top} />
          <PeopleList title="Underutilized" tone="info" people={bottom} />
        </div>
      </CardContent>
    </Card>
  );
}

function PeopleList({
  title, tone, people,
}: { title: string; tone: "warning" | "info"; people: { id: string; name: string; initials: string; role: string; load: number }[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <p className={`mb-2 text-xs font-medium uppercase tracking-wide text-${tone}`}>{title}</p>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar className="size-7"><AvatarFallback className="bg-muted text-[10px] font-semibold">{p.initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.role}</p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{p.load} tasks</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
