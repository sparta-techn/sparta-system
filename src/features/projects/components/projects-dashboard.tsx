import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, Briefcase, CheckCircle2, Star, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Progress } from "@/components/ui/progress";
import { useProjectsState } from "../store";
import { ProjectHealthBadge, ProjectStatusBadge } from "./badges";
import type { ProjectHealth } from "../types";

export function ProjectsDashboard() {
  const projects = useProjectsState((s) => s.projects);

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    const atRisk = active.filter((p) => ["at_risk", "blocked", "delayed"].includes(p.health));
    const totalOpen = active.reduce((acc, p) => acc + p.openTasks, 0);
    const totalOverdue = active.reduce((acc, p) => acc + p.overdueTasks, 0);
    const avgProgress = active.length
      ? Math.round(active.reduce((acc, p) => acc + p.progress, 0) / active.length)
      : 0;
    const healthBreakdown = active.reduce<Record<ProjectHealth, number>>(
      (acc, p) => {
        acc[p.health] = (acc[p.health] ?? 0) + 1;
        return acc;
      },
      { healthy: 0, at_risk: 0, blocked: 0, delayed: 0, completed: 0 },
    );
    return { active, atRisk, totalOpen, totalOverdue, avgProgress, healthBreakdown };
  }, [projects]);

  const favorites = projects.filter((p) => p.favorite).slice(0, 4);
  const recentActive = stats.active.slice(0, 5);
  const upcomingDeadlines = [...stats.active]
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={stats.active.length}
          icon={Briefcase}
          hint="Across all teams"
        />
        <StatCard label="Avg. progress" value={`${stats.avgProgress}%`} icon={TrendingUp} />
        <StatCard
          label="At-risk"
          value={stats.atRisk.length}
          icon={AlertTriangle}
          trend={
            stats.atRisk.length > 0
              ? {
                  direction: "up",
                  value: `${stats.atRisk.length} need attention`,
                  intent: "negative",
                }
              : undefined
          }
        />
        <StatCard
          label="Overdue tasks"
          value={stats.totalOverdue}
          icon={Activity}
          trend={
            stats.totalOverdue > 0
              ? { direction: "up", value: `${stats.totalOverdue} late`, intent: "negative" }
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active project health</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recentActive.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-lg"
                    style={{ background: `${p.color}22`, color: p.color }}
                    aria-hidden
                  >
                    {p.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to="/app/projects/$id" params={{ id: p.id }} className="block">
                      <p className="truncate text-sm font-medium hover:underline">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.key} · {p.openTasks} open · {p.overdueTasks} overdue
                      </p>
                    </Link>
                  </div>
                  <div className="hidden w-32 sm:block">
                    <Progress value={p.progress} className="h-1.5" />
                  </div>
                  <ProjectHealthBadge health={p.health} />
                </li>
              ))}
              {recentActive.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No active projects yet.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Health mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(stats.healthBreakdown) as ProjectHealth[]).map((h) => {
              const count = stats.healthBreakdown[h];
              const pct = stats.active.length ? (count / stats.active.length) * 100 : 0;
              return (
                <div key={h} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <ProjectHealthBadge health={h} />
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-4 text-amber-500" /> Your favorites
            </CardTitle>
          </CardHeader>
          <CardContent>
            {favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Star a project to keep it pinned here.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {favorites.map((p) => (
                  <Link
                    key={p.id}
                    to="/app/projects/$id"
                    params={{ id: p.id }}
                    className="rounded-md border p-3 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden>{p.icon}</span>
                      <p className="truncate text-sm font-medium">{p.name}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <ProjectStatusBadge status={p.status} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p.progress}%
                      </span>
                    </div>
                  </Link>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-500" /> Upcoming deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {upcomingDeadlines.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    to="/app/projects/$id"
                    params={{ id: p.id }}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(p.endDate).toLocaleDateString()}
                  </span>
                </li>
              ))}
              {upcomingDeadlines.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No upcoming deadlines.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
