import { useEffect, useState } from "react";
import { Coffee, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { formatDuration, mockToday, WORK_STATUS_META, type WorkStatus } from "../mock-data";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function TodayStatusCard() {
  const now = useNow(1000);
  const [status, setStatus] = useState<WorkStatus>(mockToday.workStatus);
  const [workSeconds, setWorkSeconds] = useState(mockToday.workingSeconds);
  const [breakSeconds, setBreakSeconds] = useState(mockToday.breakSeconds);

  useEffect(() => {
    if (status !== "working" && status !== "on_break") return;
    const id = window.setInterval(() => {
      if (status === "working") setWorkSeconds((s) => s + 1);
      if (status === "on_break") setBreakSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const meta = WORK_STATUS_META[status];
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={meta.tone} label={meta.label} />
            <span className="text-xs text-muted-foreground">
              Scheduled start {mockToday.scheduledStart} · Started {mockToday.startedAt}
            </span>
          </div>
          <div>
            <p className="font-display text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
              {timeStr}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{dateStr}</p>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <Timer label="Working" value={formatDuration(workSeconds)} />
            <Timer label="On break" value={formatDuration(breakSeconds)} muted />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch md:min-w-44">
          {status === "not_started" || status === "late" ? (
            <Button onClick={() => setStatus("working")}>
              <Play /> Start work
            </Button>
          ) : null}
          {status === "working" ? (
            <>
              <Button variant="outline" onClick={() => setStatus("on_break")}>
                <Coffee /> Start break
              </Button>
              <Button variant="secondary" onClick={() => setStatus("finished")}>
                <Square /> Finish work
              </Button>
            </>
          ) : null}
          {status === "on_break" ? (
            <Button onClick={() => setStatus("working")}>
              <Pause /> End break
            </Button>
          ) : null}
          {status === "finished" ? (
            <Button variant="outline" disabled>
              Day finished
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Timer({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-display text-xl font-semibold tabular-nums",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
