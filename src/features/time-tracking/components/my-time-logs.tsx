import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { useTasksState } from "@/features/tasks/store";
import type { Task } from "@/features/tasks/types";
import { TIME_TRACKING_CURRENT_USER_ID, useTimeState } from "../store";
import {
  formatHours,
  formatMinutes,
  groupByDay,
  groupByTask,
  isInRange,
  sumMinutes,
} from "../utils";
import type { TimeLog, TimeRange } from "../types";
import { useNow } from "../hooks/use-now";
import { TimeLogsList } from "./time-logs-list";
import { ManualEntryDialog } from "./manual-entry-dialog";

export function MyTimeLogs() {
  const userId = TIME_TRACKING_CURRENT_USER_ID;
  const myLogs = useTimeState((s) => s.logs.filter((l) => l.userId === userId));
  const tasks = useTasksState((s) => s.tasks);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const now = useNow(myLogs.some((l) => l.endTime === null) ? 1000 : 60_000);
  const [tab, setTab] = useState<TimeRange>("week");
  const [manualOpen, setManualOpen] = useState(false);

  const ranged = (range: TimeRange) =>
    myLogs.filter((l) => isInRange(l.startTime, range));

  const totals = {
    today: sumMinutes(ranged("today"), now),
    week: sumMinutes(ranged("week"), now),
    month: sumMinutes(ranged("month"), now),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">My time logs</h2>
          <p className="text-sm text-muted-foreground">
            Personal aggregations across all tasks.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setManualOpen(true)}>
          <Plus className="size-4" /> Log time
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Today" value={formatHours(totals.today)} hint={formatMinutes(totals.today)} />
        <StatCard label="This week" value={formatHours(totals.week)} hint={formatMinutes(totals.week)} />
        <StatCard label="This month" value={formatHours(totals.month)} hint={formatMinutes(totals.month)} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TimeRange)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="month">This month</TabsTrigger>
        </TabsList>
        {(["today", "week", "month"] as TimeRange[]).map((r) => (
          <TabsContent key={r} value={r} className="mt-4 space-y-6">
            <RangeBreakdown logs={ranged(r)} now={now} />
            <TopTasks logs={ranged(r)} taskMap={taskMap} now={now} />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Entries</h3>
              <TimeLogsList
                logs={ranged(r)}
                showUser={false}
                emptyHint="Nothing logged yet for this range."
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}

function RangeBreakdown({ logs, now }: { logs: TimeLog[]; now: number }) {
  const byDay = groupByDay(logs).slice(-14);
  const peak = Math.max(1, ...byDay.map((d) => d.minutes));
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Daily breakdown</h3>
      {byDay.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity in this range.</p>
      ) : (
        <div className="flex h-28 items-end gap-1.5">
          {byDay.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${Math.max(4, (d.minutes / peak) * 100)}%` }}
                title={`${d.date}: ${formatMinutes(d.minutes)}`}
              />
              <span className="text-[10px] text-muted-foreground">
                {new Date(d.date).toLocaleDateString(undefined, { day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Total: {formatHours(sumMinutes(logs, now))}
      </p>
    </Card>
  );
}

function TopTasks({
  logs,
  taskMap,
  now,
}: {
  logs: TimeLog[];
  taskMap: Map<string, Task>;
  now: number;
}) {
  const groups = groupByTask(logs);
  const rows = Array.from(groups.entries())
    .map(([taskId, ls]) => ({ taskId, minutes: sumMinutes(ls, now), count: ls.length }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 8);

  if (rows.length === 0) return null;
  const peak = rows[0]!.minutes;

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Top tasks</h3>
      <ul className="space-y-2">
        {rows.map((r) => {
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
                <span className="font-mono text-xs tabular-nums">
                  {formatHours(r.minutes)}
                </span>
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
    </Card>
  );
}
