import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityPill } from "@/features/dependencies/components/dep-badges";
import { DepStatGrid } from "@/features/dependencies/components/dep-widgets";
import { personById } from "@/features/dependencies/mock-data";
import { useDependencies } from "@/features/dependencies/store";
import {
  DEPENDENCY_PRIORITIES,
  PRIORITY_LABEL,
  type Dependency,
} from "@/features/dependencies/types";
import { avgResolutionHours, isOpen } from "@/features/dependencies/utils";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/dependencies/manager")({
  staticData: routeGuard({ roles: ["owner", "admin", "hr", "project_manager", "team_lead"] }),
  component: ManagerView,
});

function ManagerView() {
  const all = useDependencies();
  const open = all.filter(isOpen);

  const byDept = useMemo(() => groupCount(open, (d) => d.department), [open]);
  const byOwner = useMemo(
    () => groupCount(open, (d) => personById(d.ownerId)?.name ?? "Unassigned"),
    [open],
  );
  const byPriority = useMemo(
    () =>
      DEPENDENCY_PRIORITIES.map((p) => ({
        key: p,
        count: open.filter((d) => d.priority === p).length,
      })),
    [open],
  );
  const byProject = useMemo(() => {
    const blocked = open.filter((d) => d.state === "blocked" || d.priority === "critical");
    return groupCount(blocked, (d) => d.project);
  }, [open]);
  const avg = avgResolutionHours(all);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Manager view"
        title="Dependency operations"
        description="Where work is stuck, who's blocking, and how long things take."
      />

      <DepStatGrid items={all} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarsCard title="Open by department" rows={byDept} />
        <BarsCard title="Open by owner" rows={byOwner} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By priority</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byPriority.map((r) => (
              <div key={r.key} className="flex items-center justify-between">
                <PriorityPill priority={r.key} />
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {r.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <BarsCard
          title="Top blocked projects"
          rows={byProject}
          emptyLabel="No blocked work right now."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Average resolution time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-semibold tabular-nums text-foreground">{avg}h</p>
          <p className="text-xs text-muted-foreground">
            Across {all.filter((d) => d.resolvedAt).length} resolved dependencies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function groupCount(items: Dependency[], key: (d: Dependency) => string) {
  const map = new Map<string, number>();
  items.forEach((d) => map.set(key(d), (map.get(key(d)) ?? 0) + 1));
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function BarsCard({
  title,
  rows,
  emptyLabel = "Nothing to show.",
}: {
  title: string;
  rows: { key: string; count: number }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          rows.map((r) => (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{r.key}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// Used internally for the priority key labelling, kept exported-free
void PRIORITY_LABEL;
