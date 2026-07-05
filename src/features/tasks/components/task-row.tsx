import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CalendarDays, ListChecks, MessageSquare, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { checklistProgress, formatDate, isOverdue, projectById } from "../utils";
import type { Task } from "../types";
import { useTasksState } from "../store";
import { TaskLabelChip, TaskPriorityBadge, TaskStatusBadge } from "./badges";
import { EmployeeChip } from "./employee-chip";

// Memoized: with a stable `onToggle` from the parent, toggling one row's
// selection no longer re-renders every other row in the list.
export const TaskRow = memo(function TaskRow({
  task,
  selected,
  onToggle,
  showProject = true,
}: {
  task: Task;
  selected: boolean;
  onToggle: (id: string, next: boolean) => void;
  showProject?: boolean;
}) {
  const favoriteIds = useTasksState((s) => s.favoriteIds);
  const comments = useTasksState((s) => s.comments.filter((c) => c.taskId === task.id).length);
  const project = projectById(task.projectId);
  const checklist = checklistProgress(task);
  const overdue = isOverdue(task);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border/60 px-3 py-3 transition-colors hover:bg-muted/50",
        selected && "bg-primary/5",
      )}
    >
      <div className="pt-1">
        <Checkbox checked={selected} onCheckedChange={(c) => onToggle(task.id, c === true)} aria-label="Select task" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {favoriteIds.includes(task.id) ? (
            <Star className="size-3.5 fill-amber-400 text-amber-500" aria-label="Favorited" />
          ) : null}
          <span className="font-mono text-[11px] uppercase text-muted-foreground">{task.ref}</span>
          <Link
            to="/app/tasks/$id"
            params={{ id: task.id }}
            className="truncate font-medium hover:underline"
          >
            {task.title}
          </Link>
          {task.labels.slice(0, 3).map((l) => (
            <TaskLabelChip key={l} label={l} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
          {showProject && project ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>{project.icon}</span>
              {project.name}
            </span>
          ) : null}
          {task.dueDate ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
              <CalendarDays className="size-3.5" />
              {formatDate(task.dueDate)}
              {overdue ? <AlertCircle className="size-3.5" /> : null}
            </span>
          ) : null}
          {checklist ? (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3.5" />
              {checklist.done}/{checklist.total}
            </span>
          ) : null}
          {comments ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {comments}
            </span>
          ) : null}
        </div>
      </div>
      <EmployeeChip id={task.assigneeId} showName={false} />
    </div>
  );
});
