import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { listTasks, updateTask, useTasksState } from "@/features/tasks/store";
import {
  PRIORITY_WEIGHT,
  STATUS_LABEL,
  STATUS_TONE,
  type Task,
  type TaskStatus,
} from "@/features/tasks/types";
import { placeInColumn, useKanbanState } from "../store";
import type { KanbanFilters } from "../types";
import { KanbanCard } from "./kanban-card";

const TONE_DOT: Record<string, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
};

function matches(task: Task, f: KanbanFilters) {
  if (f.search) {
    const q = f.search.toLowerCase();
    if (
      !task.title.toLowerCase().includes(q) &&
      !task.ref.toLowerCase().includes(q)
    )
      return false;
  }
  if (f.projectIds?.length && !f.projectIds.includes(task.projectId)) return false;
  if (f.assigneeIds?.length && !f.assigneeIds.includes(task.assigneeId ?? "")) return false;
  if (f.priorities?.length && !f.priorities.includes(task.priority)) return false;
  if (f.epicIds?.length && !f.epicIds.includes(task.epicId ?? "")) return false;
  return true;
}

function sortTasks(tasks: Task[], orderIds: string[] | undefined): Task[] {
  if (!orderIds?.length) {
    return [...tasks].sort(
      (a, b) =>
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  const idx = new Map(orderIds.map((id, i) => [id, i]));
  return [...tasks].sort((a, b) => {
    const ai = idx.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = idx.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  });
}

export function KanbanBoard({ filters }: { filters: KanbanFilters }) {
  // Subscribe so DnD/status updates re-render.
  useTasksState((s) => s.tasks.length);
  const columns = useKanbanState((s) => s.settings.columns);
  const wipLimits = useKanbanState((s) => s.settings.wipLimits);
  const order = useKanbanState((s) => s.order);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const grouped = useMemo(() => {
    const all = listTasks().filter((t) => !t.parentTaskId && matches(t, filters));
    const map = {} as Record<TaskStatus, Task[]>;
    for (const col of columns) {
      map[col] = sortTasks(all.filter((t) => t.status === col), order[col]);
    }
    return map;
  }, [columns, order, filters]);

  function onDrop(column: TaskStatus, targetIndex: number) {
    if (!dragId) return;
    const task = grouped[column]?.find((t) => t.id === dragId);
    const fromOtherColumn = !task;
    if (fromOtherColumn) {
      updateTask(dragId, { status: column });
    }
    const visibleIds = grouped[column].map((t) => t.id);
    placeInColumn(dragId, column, targetIndex, visibleIds);
    setDragId(null);
    setOverCol(null);
  }

  return (
    <>
      {/* Desktop / tablet kanban */}
      <div className="hidden overflow-x-auto pb-2 md:block">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => {
            const items = grouped[col] ?? [];
            const limit = wipLimits[col] ?? 0;
            const over = limit > 0 && items.length > limit;
            return (
              <section
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col);
                }}
                onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
                onDrop={() => onDrop(col, items.length)}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface/40 p-2 transition",
                  overCol === col && "border-primary/50 bg-primary-soft/40",
                )}
                aria-label={`${STATUS_LABEL[col]} column`}
              >
                <header className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", TONE_DOT[STATUS_TONE[col]])} />
                    <h3 className="text-sm font-semibold">{STATUS_LABEL[col]}</h3>
                  </div>
                  <span
                    className={cn(
                      "text-xs tabular-nums text-muted-foreground",
                      over && "font-semibold text-destructive",
                    )}
                  >
                    {items.length}
                    {limit > 0 ? <span className="text-muted-foreground/70"> / {limit}</span> : null}
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-1">
                  {items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Drop tasks here
                    </div>
                  ) : (
                    items.map((task, idx) => (
                      <div
                        key={task.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          onDrop(col, idx);
                        }}
                      >
                        <KanbanCard
                          task={task}
                          draggable
                          onDragStart={(e) => {
                            setDragId(task.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverCol(null);
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked vertical lists per column */}
      <div className="space-y-4 md:hidden">
        {columns.map((col) => {
          const items = grouped[col] ?? [];
          return (
            <section
              key={col}
              className="rounded-xl border border-border bg-surface/40 p-3"
              aria-label={`${STATUS_LABEL[col]} list`}
            >
              <header className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", TONE_DOT[STATUS_TONE[col]])} />
                  <h3 className="text-sm font-semibold">{STATUS_LABEL[col]}</h3>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </header>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No tasks.</p>
                ) : (
                  items.map((task) => <KanbanCard key={task.id} task={task} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
