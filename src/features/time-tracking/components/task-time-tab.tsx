import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { TIME_TRACKING_CURRENT_USER_ID, useTimeState } from "../store";
import {
  formatHours,
  formatMinutes,
  formatRelative,
  groupByDay,
  isInRange,
  sumMinutes,
} from "../utils";
import { useNow } from "../hooks/use-now";
import { StartStopButton } from "./start-stop-button";
import { ManualEntryDialog } from "./manual-entry-dialog";
import { TimeLogsList } from "./time-logs-list";

interface Props {
  taskId: string;
}

/** "Time Tracking" tab content inside Task Detail. */
export function TaskTimeTab({ taskId }: Props) {
  const logs = useTimeState((s) => s.logs.filter((l) => l.taskId === taskId));
  const now = useNow(logs.some((l) => l.endTime === null) ? 1000 : 60_000);
  const [manualOpen, setManualOpen] = useState(false);

  const total = sumMinutes(logs, now);
  const lastLog = useMemo(
    () =>
      logs
        .filter((l) => l.endTime !== null)
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0] ?? null,
    [logs],
  );
  const myTotal = sumMinutes(
    logs.filter((l) => l.userId === TIME_TRACKING_CURRENT_USER_ID),
    now,
  );
  const contributors = new Set(logs.map((l) => l.userId)).size;

  const byDay = groupByDay(logs).slice(-7);
  const peak = Math.max(1, ...byDay.map((d) => d.minutes));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StartStopButton taskId={taskId} />
          <Button variant="outline" className="gap-2" onClick={() => setManualOpen(true)}>
            <Plus className="size-4" /> Log time
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {lastLog ? `Last worked ${formatRelative(lastLog.endTime!, now)}` : "Not started yet"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total time" value={formatHours(total)} hint={formatMinutes(total)} />
        <StatCard label="My time" value={formatHours(myTotal)} hint={formatMinutes(myTotal)} />
        <StatCard
          label="Entries"
          value={logs.length}
          hint={`${contributors} contributor${contributors === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Last 7 days"
          value={formatHours(
            sumMinutes(
              logs.filter((l) => isInRange(l.startTime, "week")),
              now,
            ),
          )}
        />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Last 7 days</h3>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="flex h-24 items-end gap-2">
            {byDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(4, (d.minutes / peak) * 100)}%` }}
                  title={`${d.date}: ${formatMinutes(d.minutes)}`}
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Time entries</h3>
        <TimeLogsList logs={logs} emptyHint="No time logged on this task yet." />
      </div>

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} taskId={taskId} />
    </div>
  );
}
