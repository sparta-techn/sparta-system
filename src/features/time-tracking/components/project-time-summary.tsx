import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { useTasksState } from "@/features/tasks/store";
import { useTimeState } from "../store";
import { formatHours, formatMinutes, groupByTask, sumMinutes } from "../utils";
import { useNow } from "../hooks/use-now";

interface Props {
  projectId: string;
}

/** Project-level time summary. UI-only aggregation across tasks. */
export function ProjectTimeSummary({ projectId }: Props) {
  const allTasks = useTasksState((s) => s.tasks);
  const projectTaskIds = useMemo(
    () => allTasks.filter((t) => t.projectId === projectId).map((t) => t.id),
    [allTasks, projectId],
  );
  const taskMap = useMemo(
    () => new Map(allTasks.filter((t) => t.projectId === projectId).map((t) => [t.id, t])),
    [allTasks, projectId],
  );
  const allLogs = useTimeState((s) => s.logs);
  const logs = useMemo(
    () => allLogs.filter((l) => projectTaskIds.includes(l.taskId)),
    [allLogs, projectTaskIds],
  );
  const now = useNow(logs.some((l) => l.endTime === null) ? 1000 : 60_000);

  const total = sumMinutes(logs, now);
  const contributors = new Set(logs.map((l) => l.userId)).size;
  const activeNow = logs.filter((l) => l.endTime === null).length;

  const top = useMemo(() => {
    const groups = groupByTask(logs);
    return Array.from(groups.entries())
      .map(([taskId, ls]) => ({
        taskId,
        minutes: sumMinutes(ls, now),
        entries: ls.length,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [logs, now]);

  const peak = Math.max(1, top[0]?.minutes ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total time"
          value={formatHours(total)}
          hint={formatMinutes(total)}
          icon={Clock}
        />
        <StatCard label="Contributors" value={contributors} hint={`${logs.length} entries`} />
        <StatCard
          label="Active timers"
          value={activeNow}
          hint={activeNow > 0 ? "Right now" : "Idle"}
        />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Top tasks by time</h3>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time logged yet on this project.</p>
        ) : (
          <ul className="space-y-2">
            {top.map((r) => {
              const task = taskMap.get(r.taskId);
              return (
                <li key={r.taskId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to="/app/tasks/$id"
                      params={{ id: r.taskId }}
                      className="truncate hover:underline"
                    >
                      <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                        {task?.ref ?? "—"}
                      </span>
                      {task?.title ?? "Unknown task"}
                    </Link>
                    <span className="font-mono text-xs tabular-nums">{formatHours(r.minutes)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${(r.minutes / peak) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
