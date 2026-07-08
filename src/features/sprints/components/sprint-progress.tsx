import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTasksState } from "@/features/tasks/store";
import { sprintStats } from "../utils";
import type { Sprint } from "../types";

const STATUS_BUCKETS: Array<{
  key: keyof ReturnType<typeof sprintStats>;
  label: string;
  tone: string;
}> = [
  { key: "todo", label: "To do / Backlog", tone: "bg-muted" },
  { key: "inProgress", label: "In progress", tone: "bg-amber-500" },
  { key: "review", label: "Review / QA", tone: "bg-blue-500" },
  { key: "completed", label: "Completed", tone: "bg-emerald-500" },
  { key: "blocked", label: "Blocked", tone: "bg-rose-500" },
];

export function SprintProgress({ sprint }: { sprint: Sprint }) {
  const allTasks = useTasksState((s) => s.tasks);
  const tasks = useMemo(
    () => allTasks.filter((t) => t.sprintId === sprint.id && !t.parentTaskId && !t.deletedAt),
    [allTasks, sprint.id],
  );
  const stats = sprintStats(tasks);
  const denom = Math.max(1, stats.total);
  const pointPct = sprint.capacity > 0 ? Math.round((stats.points / sprint.capacity) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Task status breakdown</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Distribution of {stats.total} task{stats.total === 1 ? "" : "s"} across the sprint.
        </p>

        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {STATUS_BUCKETS.map((b) => {
            const v = stats[b.key] as number;
            const pct = (v / denom) * 100;
            if (!pct) return null;
            return (
              <div
                key={b.key}
                className={b.tone}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ${v}`}
              />
            );
          })}
        </div>

        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STATUS_BUCKETS.map((b) => {
            const v = stats[b.key] as number;
            return (
              <li
                key={b.key}
                className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${b.tone}`} aria-hidden />
                  {b.label}
                </span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Story point capacity</h3>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Committed</span>
            <span className="font-medium">
              {stats.points} / {sprint.capacity} pts
            </span>
          </div>
          <Progress value={Math.min(100, pointPct)} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Completed: {stats.pointsCompleted} pts</span>
            <span>{pointPct}% of capacity</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
