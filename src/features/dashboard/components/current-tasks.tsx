import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/features/auth/auth-context";
import { useTasksState } from "@/features/tasks/store";
import { getProject } from "@/features/projects/store";
import {
  PRIORITY_LABEL,
  PRIORITY_WEIGHT,
  STATUS_LABEL,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/types";
import { checklistProgress, formatDate, isOverdue } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<TaskPriority, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

const STATUS_TONE: Record<
  TaskStatus,
  "neutral" | "success" | "warning" | "danger" | "primary" | "info"
> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "primary",
  review: "info",
  qa: "info",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

const MAX_ROWS = 6;

export function CurrentTasks() {
  const userId = useAuth().user?.id ?? null;
  const tasks = useTasksState((s) => s.tasks);
  const hydrated = useTasksState((s) => s.hydrated);

  const mine = tasks
    .filter(
      (t) =>
        t.assigneeId === userId &&
        !t.deletedAt &&
        !t.archivedAt &&
        t.status !== "done" &&
        t.status !== "cancelled",
    )
    .sort((a, b) => {
      // Highest priority first, then soonest due date.
      const p = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (p !== 0) return p;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    })
    .slice(0, MAX_ROWS);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Current tasks</CardTitle>
          <CardDescription>The open work assigned to you.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link to="/app/tasks">
            View all <ExternalLink />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!hydrated ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading your tasks…</p>
        ) : mine.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing assigned to you right now. Enjoy the calm. 🌤️
          </p>
        ) : (
          mine.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: Task }) {
  const project = getProject(task.projectId);
  const checklist = checklistProgress(task);
  const overdue = isOverdue(task);

  return (
    <div className="group rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{task.ref}</span>
            {project ? (
              <span className="text-xs text-muted-foreground">
                · {project.icon} {project.name}
              </span>
            ) : null}
          </div>
          <Link
            to="/app/tasks/$id"
            params={{ id: task.id }}
            className="block text-sm font-medium text-foreground hover:underline"
          >
            {task.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={STATUS_TONE[task.status]}
              label={STATUS_LABEL[task.status]}
              size="sm"
            />
            <StatusBadge
              tone={PRIORITY_TONE[task.priority]}
              label={PRIORITY_LABEL[task.priority]}
              size="sm"
              withDot={false}
            />
            {task.dueDate ? (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overdue ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {formatDate(task.dueDate)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {checklist ? (
        <div className="mt-3 flex items-center gap-3">
          <Progress value={checklist.pct} className="h-1.5 flex-1" />
          <span className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">
            {checklist.done}/{checklist.total}
          </span>
        </div>
      ) : null}
    </div>
  );
}
