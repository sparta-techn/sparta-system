import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ListChecks, MessageSquare, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { checklistProgress, formatDate, isOverdue, projectById } from "../utils";
import type { Task } from "../types";
import { useTasksState } from "../store";
import { TaskLabelChip, TaskPriorityBadge, TaskStatusBadge } from "./badges";
import { EmployeeChip } from "./employee-chip";

// Grid card keyed by a stable `task` reference; memoized so re-rendering the
// grid (selection, filter changes that keep the same task refs) skips untouched
// cards. Store subscriptions inside still refresh it when task data changes.
export const TaskCard = memo(function TaskCard({ task }: { task: Task }) {
  const favoriteIds = useTasksState((s) => s.favoriteIds);
  const comments = useTasksState((s) => s.comments.filter((c) => c.taskId === task.id).length);
  const project = projectById(task.projectId);
  const checklist = checklistProgress(task);
  const overdue = isOverdue(task);

  return (
    <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono uppercase">{task.ref}</span>
        {project ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 truncate">
              <span aria-hidden>{project.icon}</span>
              {project.name}
            </span>
          </>
        ) : null}
        {favoriteIds.includes(task.id) ? (
          <Star className="ml-auto size-3.5 fill-amber-400 text-amber-500" />
        ) : null}
      </div>

      <Link
        to="/app/tasks/$id"
        params={{ id: task.id }}
        className="line-clamp-2 text-sm font-semibold hover:underline"
      >
        {task.title}
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
        {task.labels.slice(0, 2).map((l) => (
          <TaskLabelChip key={l} label={l} />
        ))}
      </div>

      {checklist ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3.5" /> Checklist
            </span>
            <span>
              {checklist.done}/{checklist.total}
            </span>
          </div>
          <Progress value={checklist.pct} className="h-1.5" />
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <EmployeeChip id={task.assigneeId} />
        <div className="flex items-center gap-2">
          {comments ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {comments}
            </span>
          ) : null}
          {task.dueDate ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
              <CalendarDays className="size-3.5" />
              {formatDate(task.dueDate)}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
});
