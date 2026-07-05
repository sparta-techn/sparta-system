import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskPriorityBadge } from "@/features/tasks/components/badges";
import { EmployeeChip } from "@/features/tasks/components/employee-chip";
import { formatDate, isOverdue, projectById } from "@/features/tasks/utils";
import type { Task } from "@/features/tasks/types";

// Board cards render across every column; memoized on a stable task reference.
// The static (non-dragging) column passes only `task`, so those cards skip
// re-render entirely when an unrelated column updates.
export const KanbanCard = memo(function KanbanCard({
  task,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const project = projectById(task.projectId);
  const overdue = isOverdue(task);
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm transition",
        "hover:border-primary/40 hover:shadow-md",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="font-mono">{task.ref}</span>
        {project ? (
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <span aria-hidden>{project.icon}</span>
            <span className="truncate">{project.name}</span>
          </span>
        ) : null}
      </div>
      <Link
        to="/app/tasks/$id"
        params={{ id: task.id }}
        className="mt-1.5 block text-sm font-medium leading-snug hover:underline"
      >
        {task.title}
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TaskPriorityBadge priority={task.priority} />
          {task.dueDate ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
                overdue && "text-destructive",
              )}
            >
              <CalendarDays className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          ) : null}
        </div>
        <EmployeeChip id={task.assigneeId} showName={false} size="xs" />
      </div>
    </div>
  );
});
