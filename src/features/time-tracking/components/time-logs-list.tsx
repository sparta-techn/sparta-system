import { Trash2, Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeChip } from "@/features/tasks/components/employee-chip";
import { cn } from "@/lib/utils";
import { deleteLog } from "../store";
import type { TimeLog } from "../types";
import {
  formatDateTime,
  formatMinutes,
  formatTimer,
  liveDurationMinutes,
  liveSeconds,
} from "../utils";
import { useNow } from "../hooks/use-now";

interface Props {
  logs: TimeLog[];
  /** Show user column. Defaults to true. */
  showUser?: boolean;
  /** Hide delete button (e.g. on read-only project views). */
  readOnly?: boolean;
  emptyHint?: string;
}

export function TimeLogsList({
  logs,
  showUser = true,
  readOnly = false,
  emptyHint = "No time logged yet.",
}: Props) {
  const now = useNow(logs.some((l) => l.endTime === null) ? 1000 : 60_000);

  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {emptyHint}
      </div>
    );
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  return (
    <ul className="divide-y rounded-md border bg-card">
      {sorted.map((log) => {
        const active = log.endTime === null;
        return (
          <li
            key={log.id}
            className={cn("flex items-start gap-3 p-3 text-sm", active && "bg-primary/5")}
          >
            <div
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Clock className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">
                  {active
                    ? formatTimer(liveSeconds(log, now))
                    : formatMinutes(liveDurationMinutes(log, now))}
                </span>
                {active ? (
                  <Badge variant="default" className="h-5 gap-1 px-1.5 text-[10px]">
                    <span className="size-1.5 animate-pulse rounded-full bg-current" />
                    Running
                  </Badge>
                ) : null}
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                  {log.source === "timer" ? (
                    <>
                      <Clock className="size-2.5" /> Timer
                    </>
                  ) : (
                    <>
                      <Pencil className="size-2.5" /> Manual
                    </>
                  )}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(log.startTime)}
                </span>
              </div>
              {log.description ? (
                <p className="text-sm text-foreground/80">{log.description}</p>
              ) : null}
              {showUser ? (
                <div className="pt-0.5">
                  <EmployeeChip id={log.userId} />
                </div>
              ) : null}
            </div>
            {!readOnly ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteLog(log.id)}
                aria-label="Delete entry"
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
