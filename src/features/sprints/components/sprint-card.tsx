import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProjectsState } from "@/features/projects/store";
import { useTasksState } from "@/features/tasks/store";
import { formatRange, daysRemaining, sprintStats } from "../utils";
import type { Sprint } from "../types";
import { SprintStatusBadge } from "./sprint-status-badge";

export function SprintCard({ sprint }: { sprint: Sprint }) {
  const project = useProjectsState((s) => s.projects.find((p) => p.id === sprint.projectId));
  const allTasks = useTasksState((s) => s.tasks);
  const tasks = useMemo(
    () => allTasks.filter((t) => t.sprintId === sprint.id && !t.parentTaskId && !t.deletedAt),
    [allTasks, sprint.id],
  );
  const stats = sprintStats(tasks);

  return (
    <Link
      to="/app/sprints/$id"
      params={{ id: sprint.id }}
      className="group block focus:outline-none"
    >
      <Card className="flex h-full flex-col gap-4 p-5 transition-all hover:border-primary/40 hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              {project ? (
                <span className="inline-flex items-center gap-1 truncate">
                  <span aria-hidden>{project.icon}</span>
                  {project.name}
                </span>
              ) : (
                <span>No project</span>
              )}
            </div>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold group-hover:underline">
              {sprint.name}
            </h3>
          </div>
          <SprintStatusBadge status={sprint.status} />
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">
          <Target className="-mt-0.5 mr-1 inline size-3" />
          {sprint.goal}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{stats.progress}%</span>
          </div>
          <Progress value={stats.progress} className="h-1.5" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-muted/40 py-1.5">
            <div className="text-sm font-semibold">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Tasks</div>
          </div>
          <div className="rounded-md bg-muted/40 py-1.5">
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.completed}
            </div>
            <div className="text-[10px] text-muted-foreground">Done</div>
          </div>
          <div className="rounded-md bg-muted/40 py-1.5">
            <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              {stats.blocked}
            </div>
            <div className="text-[10px] text-muted-foreground">Blocked</div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {formatRange(sprint.startDate, sprint.endDate)}
          </span>
          {sprint.status === "active" ? (
            <span className="font-medium text-foreground">{daysRemaining(sprint)}d left</span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
