import { CalendarDays, CheckCircle2, CircleDashed, ListChecks, Loader2, OctagonAlert, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProjectsState } from "@/features/projects/store";
import { useTasksState } from "@/features/tasks/store";
import { formatRange, daysRemaining, sprintStats } from "../utils";
import type { Sprint } from "../types";
import { SprintStatusBadge } from "./sprint-status-badge";

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${tone ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

export function SprintOverview({ sprint }: { sprint: Sprint }) {
  const project = useProjectsState((s) => s.projects.find((p) => p.id === sprint.projectId));
  const tasks = useTasksState((s) =>
    s.tasks.filter((t) => t.sprintId === sprint.id && !t.parentTaskId && !t.deletedAt),
  );
  const stats = sprintStats(tasks);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {project ? (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>{project.icon}</span>
                  {project.name}
                </span>
              ) : null}
              <span aria-hidden>·</span>
              <SprintStatusBadge status={sprint.status} />
            </div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Target className="size-4 text-primary" /> Sprint goal
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {sprint.goal || "No goal defined for this sprint yet."}
            </p>
          </div>

          <div className="space-y-2 text-sm md:text-right">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4" />
              {formatRange(sprint.startDate, sprint.endDate)}
            </div>
            {sprint.status === "active" ? (
              <div className="text-xs">
                <span className="font-medium text-foreground">{daysRemaining(sprint)} days</span>{" "}
                remaining
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">Capacity: {sprint.capacity} pts</div>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-medium">{stats.progress}% · {stats.completed}/{stats.total} tasks</span>
          </div>
          <Progress value={stats.progress} className="h-2" />
        </div>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Metric icon={ListChecks} label="Total tasks" value={stats.total} />
        <Metric icon={CheckCircle2} label="Completed" value={stats.completed} tone="text-emerald-500" />
        <Metric icon={Loader2} label="In progress" value={stats.inProgress} tone="text-amber-500" />
        <Metric icon={CircleDashed} label="To do" value={stats.todo} tone="text-muted-foreground" />
        <Metric icon={OctagonAlert} label="Blocked" value={stats.blocked} tone="text-rose-500" />
      </div>
    </div>
  );
}
