import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTasksState } from "../store";
import type { Task } from "../types";
import { TaskPriorityBadge, TaskStatusBadge } from "./badges";
import { EmployeeChip } from "./employee-chip";
import { CreateTaskDialog } from "./create-task-dialog";
import { checklistProgress, formatDate, isOverdue } from "../utils";

export function SubtaskTree({ rootId }: { rootId: string }) {
  const tasks = useTasksState((s) => s.tasks);
  const [open, setOpen] = useState(false);

  function children(id: string) {
    return tasks.filter((t) => t.parentTaskId === id && !t.deletedAt);
  }

  const root = tasks.find((t) => t.id === rootId);
  if (!root) return null;
  const direct = children(rootId);

  const totalDescendants = countDescendants(rootId, tasks);
  const doneDescendants = countDescendants(rootId, tasks, (t) => t.status === "done");
  const pct = totalDescendants ? Math.round((doneDescendants / totalDescendants) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Subtasks</p>
          <p className="text-xs text-muted-foreground">
            {totalDescendants
              ? `${doneDescendants}/${totalDescendants} complete · ${pct}%`
              : "No subtasks yet"}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add subtask
        </Button>
      </div>
      {totalDescendants ? <Progress value={pct} className="h-1.5" /> : null}

      <div className="rounded-lg border bg-card">
        {direct.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Break this task into smaller pieces.
          </p>
        ) : (
          direct.map((child) => <SubtaskNode key={child.id} task={child} depth={0} />)
        )}
      </div>

      <CreateTaskDialog
        open={open}
        onOpenChange={setOpen}
        defaultProjectId={root.projectId}
        parentTaskId={root.id}
      />
    </div>
  );
}

function SubtaskNode({ task, depth }: { task: Task; depth: number }) {
  const tasks = useTasksState((s) => s.tasks);
  const [expanded, setExpanded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const children = tasks.filter((t) => t.parentTaskId === task.id && !t.deletedAt);
  const cl = checklistProgress(task);
  const overdue = isOverdue(task);

  return (
    <div>
      <div
        className="flex items-center gap-2 border-b border-border/40 px-3 py-2 last:border-b-0"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {children.length ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-5" aria-hidden />
        )}
        <Link
          to="/app/tasks/$id"
          params={{ id: task.id }}
          className="min-w-0 flex-1 truncate text-sm hover:underline"
        >
          <span className="mr-2 font-mono text-[11px] text-muted-foreground">{task.ref}</span>
          {task.title}
        </Link>
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
        {cl ? (
          <span className="text-[11px] text-muted-foreground">
            {cl.done}/{cl.total}
          </span>
        ) : null}
        {task.dueDate ? (
          <span className={cn("text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>
            {formatDate(task.dueDate)}
          </span>
        ) : null}
        <EmployeeChip id={task.assigneeId} showName={false} size="xs" />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setCreateOpen(true)}
          aria-label="Add nested subtask"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {expanded && children.map((c) => <SubtaskNode key={c.id} task={c} depth={depth + 1} />)}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={task.projectId}
        parentTaskId={task.id}
      />
    </div>
  );
}

function countDescendants(id: string, all: Task[], predicate?: (t: Task) => boolean): number {
  const direct = all.filter((t) => t.parentTaskId === id && !t.deletedAt);
  let n = 0;
  for (const child of direct) {
    if (!predicate || predicate(child)) n += 1;
    n += countDescendants(child.id, all, predicate);
  }
  return n;
}
