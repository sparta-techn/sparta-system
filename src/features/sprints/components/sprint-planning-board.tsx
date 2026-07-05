import { useMemo, useState } from "react";
import { GripVertical, Inbox, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTasksState } from "@/features/tasks/store";
import type { Task } from "@/features/tasks/types";
import { addTaskToSprint, removeTaskFromSprint } from "../store";
import { sprintStats } from "../utils";
import type { Sprint } from "../types";

function MiniTaskRow({ task, draggable = true }: { task: Task; draggable?: boolean }) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/sprint-task", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group flex cursor-grab items-start gap-2 rounded-md border bg-card p-2.5 text-sm shadow-sm transition-colors hover:border-primary/40 active:cursor-grabbing"
    >
      <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
          <span className="font-mono">{task.ref}</span>
          {task.storyPoints ? <span>· {task.storyPoints} pts</span> : null}
        </div>
        <div className="line-clamp-2 text-xs font-medium">{task.title}</div>
      </div>
    </div>
  );
}

export function SprintPlanningBoard({ sprint }: { sprint: Sprint }) {
  const tasks = useTasksState((s) => s.tasks);
  const [overSprint, setOverSprint] = useState(false);
  const [overBacklog, setOverBacklog] = useState(false);

  const backlog = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.projectId === sprint.projectId &&
          !t.parentTaskId &&
          !t.deletedAt &&
          !t.archivedAt &&
          !t.sprintId,
      ),
    [tasks, sprint.projectId],
  );

  const sprintTasks = useMemo(
    () => tasks.filter((t) => t.sprintId === sprint.id && !t.parentTaskId && !t.deletedAt),
    [tasks, sprint.id],
  );

  const stats = sprintStats(sprintTasks);
  const loadPct = sprint.capacity > 0 ? Math.round((stats.points / sprint.capacity) * 100) : 0;
  const loadTone =
    loadPct > 100 ? "text-rose-500" : loadPct > 85 ? "text-amber-500" : "text-emerald-500";

  function onDropTo(target: "sprint" | "backlog") {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/sprint-task");
      if (!id) return;
      if (target === "sprint") addTaskToSprint(sprint.id, id);
      else removeTaskFromSprint(id);
      setOverSprint(false);
      setOverBacklog(false);
    };
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setOverBacklog(true);
        }}
        onDragLeave={() => setOverBacklog(false)}
        onDrop={onDropTo("backlog")}
        className={cn(
          "flex flex-col gap-3 p-4 transition-colors",
          overBacklog && "border-primary bg-primary/5",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="size-4 text-muted-foreground" />
            Project backlog
          </h3>
          <span className="text-xs text-muted-foreground">{backlog.length} tasks</span>
        </div>
        <div className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-1">
          {backlog.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              No backlog tasks. Drop a task here to remove it from the sprint.
            </p>
          ) : (
            backlog.map((t) => <MiniTaskRow key={t.id} task={t} />)
          )}
        </div>
      </Card>

      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setOverSprint(true);
        }}
        onDragLeave={() => setOverSprint(false)}
        onDrop={onDropTo("sprint")}
        className={cn(
          "flex flex-col gap-3 p-4 transition-colors",
          overSprint && "border-primary bg-primary/5",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-primary" />
            {sprint.name}
          </h3>
          <span className={cn("text-xs font-medium", loadTone)}>
            {stats.points}/{sprint.capacity} pts · {loadPct}%
          </span>
        </div>

        <div className="space-y-1">
          <Progress value={Math.min(100, loadPct)} className="h-1.5" />
          {loadPct > 100 ? (
            <p className="text-[11px] text-rose-500">Over capacity by {stats.points - sprint.capacity} pts.</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {Math.max(0, sprint.capacity - stats.points)} pts of capacity remaining.
            </p>
          )}
        </div>

        <div className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-1">
          {sprintTasks.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              Drag tasks from the backlog into this sprint.
            </p>
          ) : (
            sprintTasks.map((t) => <MiniTaskRow key={t.id} task={t} />)
          )}
        </div>
      </Card>
    </div>
  );
}
