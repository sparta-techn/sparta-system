import { Clock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeState } from "../store";
import {
  formatHours,
  formatRelative,
  liveDurationMinutes,
  sumMinutes,
} from "../utils";
import { useNow } from "../hooks/use-now";

/**
 * Compact time chip for a task — total hours, last worked, active indicator.
 * Use in task cards, rows, and detail headers.
 */
export function TaskTimeSummary({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const logs = useTimeState((s) => s.logs.filter((l) => l.taskId === taskId));
  const now = useNow(logs.some((l) => l.endTime === null) ? 1000 : 60_000);

  const total = sumMinutes(logs, now);
  const active = logs.find((l) => l.endTime === null) ?? null;
  const last =
    logs
      .filter((l) => l.endTime !== null)
      .sort(
        (a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime(),
      )[0] ?? null;

  if (total === 0 && !active) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground",
        active && "border-primary/30 bg-primary/10 text-primary",
        className,
      )}
      title={
        active
          ? `Running · ${liveDurationMinutes(active, now)}m`
          : last
            ? `Last worked ${formatRelative(last.endTime!, now)}`
            : undefined
      }
    >
      {active ? (
        <Play className="size-3 animate-pulse fill-current" />
      ) : (
        <Clock className="size-3" />
      )}
      <span className="font-mono tabular-nums">{formatHours(total)}</span>
    </span>
  );
}
