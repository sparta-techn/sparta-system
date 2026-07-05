import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskCard } from "@/features/tasks/components/task-card";
import { useTasksState } from "@/features/tasks/store";
import { TASK_STATUSES, type TaskStatus } from "@/features/tasks/types";
import { removeTaskFromSprint } from "../store";
import type { Sprint } from "../types";
import { AddTasksDialog } from "./add-tasks-dialog";

export function SprintTasks({ sprint }: { sprint: Sprint }) {
  const allTasks = useTasksState((s) => s.tasks);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [adding, setAdding] = useState(false);

  const sprintTasks = useMemo(
    () =>
      allTasks.filter(
        (t) => t.sprintId === sprint.id && !t.parentTaskId && !t.deletedAt,
      ),
    [allTasks, sprint.id],
  );

  const filtered = useMemo(
    () => (statusFilter === "all" ? sprintTasks : sprintTasks.filter((t) => t.status === statusFilter)),
    [sprintTasks, statusFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add existing tasks
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-sm font-medium">
            {sprintTasks.length === 0 ? "No tasks in this sprint yet" : "No tasks match this filter"}
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Tasks live in the Tasks module. Add existing ones to plan this sprint — nothing is created here.
          </p>
          {sprintTasks.length === 0 ? (
            <Button size="sm" className="mt-2 gap-2" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add existing tasks
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="group relative">
              <TaskCard task={t} />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTaskFromSprint(t.id);
                }}
                title="Remove from sprint"
                className="absolute right-2 top-2 z-10 hidden rounded-md border bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground group-hover:block"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddTasksDialog sprint={sprint} open={adding} onOpenChange={setAdding} />
    </div>
  );
}
