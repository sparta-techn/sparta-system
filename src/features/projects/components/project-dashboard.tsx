import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Clock,
  Flag,
  GaugeCircle,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { cn } from "@/lib/utils";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";
// Reuse the existing Analytics module — no analytics is recomputed here.
import {
  employeeName,
  filterProjectTasks,
  projectTimeLogs,
  snapshotTasks,
  sprintProgressList,
  totalHours,
  unifiedActivity,
} from "@/features/project-analytics/utils";
import { calcProjectHealth, type HealthLevel } from "@/features/project-analytics/insights";
import { highestOpenRiskSeverity } from "@/services/projects/rules";
import type { PriorityLevel } from "@/services/projects";
import { useTasksState } from "@/features/tasks/store";
import { useSprintsState } from "@/features/sprints/store";
import { useTimeState } from "@/features/time-tracking/store";
import { milestonesFor, personById, risksFor, useProjectsState } from "../store";
import { ProjectHealthBadge } from "./badges";
import type { Milestone } from "../types";

const HEALTH_TONE: Record<HealthLevel, string> = {
  good: "text-emerald-600",
  at_risk: "text-amber-600",
  critical: "text-red-600",
};

const RISK_TONE: Record<PriorityLevel, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * ProjectDashboard — the at-a-glance project widget grid.
 *
 * Composes real data from the projects store (progress, members, milestones,
 * activity) and the **existing Analytics module** (`project-analytics/utils` +
 * `insights`) for tasks/sprints/time/health/blocked — nothing analytical is
 * duplicated. Risk Level comes from the live risk register.
 */
export function ProjectDashboard({ projectId }: { projectId: string }) {
  // Subscribe to live stores so derived widgets refresh.
  useProjectsState((s) => s.projects);
  useTasksState((s) => s.tasks);
  useSprintsState((s) => s.sprints);
  useTimeState((s) => s.logs);

  const project = useProjectsState((s) => s.projects.find((p) => p.id === projectId) ?? null);
  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
  }

  const tasks = filterProjectTasks({ projectId });
  const snap = snapshotTasks(tasks);
  const sprints = sprintProgressList(projectId);
  const logs = projectTimeLogs(projectId);
  const hours = totalHours(logs);
  const health = calcProjectHealth(projectId);
  const milestones = milestonesFor(projectId);
  const activity = unifiedActivity(projectId, 6);
  const risks = risksFor(projectId);
  const riskLevel = highestOpenRiskSeverity(risks);
  const openRiskCount = risks.filter(
    (r) => r.status !== "resolved" && r.status !== "closed",
  ).length;

  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const upcoming = [...milestones]
    .filter((m) => m.status !== "done" && m.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Project progress"
          value={`${project.progress}%`}
          icon={TrendingUp}
          hint="From completed milestones"
        />
        <StatCard
          label="Project health"
          value={`${health.score}`}
          icon={GaugeCircle}
          hint={
            health.level === "good" ? "Good" : health.level === "at_risk" ? "At risk" : "Critical"
          }
        />
        <StatCard
          label="Risk level"
          value={riskLevel ? riskLevel[0].toUpperCase() + riskLevel.slice(1) : "None"}
          icon={ShieldAlert}
          hint={`${openRiskCount} open risk${openRiskCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Time logged"
          value={`${hours}h`}
          icon={Clock}
          hint={`${new Set(logs.map((l) => l.taskId)).size} tracked tasks`}
        />
        <StatCard
          label="Blocked tasks"
          value={snap.blocked}
          icon={AlertTriangle}
          trend={
            snap.blocked > 0
              ? { direction: "up", value: "Needs attention", intent: "negative" }
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {/* Project progress */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Project progress</CardTitle>
              <ProjectHealthBadge health={project.health} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall completion</span>
                <span className="font-medium tabular-nums">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                <MiniStat label="Tasks done" value={`${snap.completed}/${snap.total}`} />
                <MiniStat label="In progress" value={snap.inProgress} />
                <MiniStat
                  label="Overdue"
                  value={snap.overdue}
                  tone={snap.overdue > 0 ? "danger" : undefined}
                />
                <MiniStat label="Milestones" value={milestones.length} />
              </div>
            </CardContent>
          </Card>

          {/* Sprint progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="size-4" /> Sprint progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sprints.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No sprints for this project.</p>
              ) : (
                sprints.map((sp) => (
                  <div key={sp.sprint.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{sp.sprint.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {sp.done}/{sp.total} · {sp.pct}%
                      </span>
                    </div>
                    <Progress value={sp.pct} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                <ul className="divide-y">
                  {milestones.map((m) => (
                    <MilestoneRow key={m.id} milestone={m} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Blocked tasks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4" /> Blocked tasks
                <Badge variant="secondary" className="ml-1">
                  {blockedTasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blockedTasks.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No blocked tasks. The board is clear.
                </p>
              ) : (
                <ul className="divide-y">
                  {blockedTasks.slice(0, 6).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link
                        to="/app/tasks/$id"
                        params={{ id: t.id }}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        <span className="mr-1 font-mono text-[10px] text-muted-foreground">
                          {t.ref}
                        </span>
                        {t.title}
                      </Link>
                      <Badge variant="outline" className="border-red-500/40 text-red-600">
                        blocked
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Team members */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> Team members
                <Badge variant="secondary" className="ml-1">
                  {project.members.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.members.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No members assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {project.members.slice(0, 8).map((m) => {
                    const person = personById(m.employeeId);
                    if (!person) return null;
                    return (
                      <li key={m.employeeId} className="flex items-center gap-2">
                        <EmployeeAvatar employee={person} size={28} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{person.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {person.jobTitle}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {m.projectRole}
                        </Badge>
                      </li>
                    );
                  })}
                  {project.members.length > 8 ? (
                    <li className="pt-1 text-xs text-muted-foreground">
                      +{project.members.length - 8} more
                    </li>
                  ) : null}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Risk level */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4" /> Risk level
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-2xl font-semibold",
                    riskLevel ? RISK_TONE[riskLevel] : "text-muted-foreground",
                  )}
                >
                  {riskLevel ? riskLevel[0].toUpperCase() + riskLevel.slice(1) : "None"}
                </span>
                <span className="text-xs text-muted-foreground">{openRiskCount} open</span>
              </div>
              {risks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No risks registered.</p>
              ) : (
                <ul className="space-y-1">
                  {risks
                    .filter((r) => r.status !== "resolved" && r.status !== "closed")
                    .slice(0, 4)
                    .map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{r.title}</span>
                        <Badge
                          variant="outline"
                          className={cn("capitalize", RISK_TONE[r.severity])}
                        >
                          {r.severity}
                        </Badge>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Project health */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GaugeCircle className="size-4" /> Project health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className={cn("text-2xl font-semibold", HEALTH_TONE[health.level])}>
                  {health.score}
                </span>
                <span className={cn("text-sm font-medium", HEALTH_TONE[health.level])}>
                  {health.level === "good"
                    ? "Good"
                    : health.level === "at_risk"
                      ? "At risk"
                      : "Critical"}
                </span>
              </div>
              <ul className="space-y-1.5 pt-1">
                {health.factors.map((f) => (
                  <li key={f.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{f.label}</span>
                      <span className="tabular-nums">{Math.round(f.value)}</span>
                    </div>
                    <Progress value={f.value} className="h-1" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Upcoming deadlines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4" /> Upcoming deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No upcoming milestone deadlines.
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((m) => {
                    const days = Math.ceil((new Date(m.dueDate).getTime() - Date.now()) / DAY);
                    const overdue = days < 0;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            overdue ? "text-red-600" : "text-muted-foreground",
                          )}
                        >
                          {overdue
                            ? `${Math.abs(days)}d overdue`
                            : days === 0
                              ? "Today"
                              : `in ${days}d`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4" /> Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          {a.actorId ? (
                            <span className="font-medium">{employeeName(a.actorId)} · </span>
                          ) : null}
                          {a.summary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular-nums font-semibold", tone === "danger" && "text-destructive")}>
        {value}
      </p>
    </div>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const dot =
    milestone.status === "done"
      ? "bg-emerald-500"
      : milestone.status === "in_progress"
        ? "bg-amber-500"
        : milestone.status === "missed"
          ? "bg-rose-500"
          : "bg-muted-foreground/40";
  return (
    <li className="flex items-center gap-3 py-2">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      <span className="flex-1 text-sm">{milestone.name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{milestone.progress}%</span>
      <span className="w-24 text-right text-xs text-muted-foreground">
        {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : "—"}
      </span>
    </li>
  );
}
