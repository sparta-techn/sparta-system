import { Link } from "@tanstack/react-router";
import { Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTasksState } from "@/features/tasks/store";
import { TIME_TRACKING_CURRENT_USER_ID, stopTimer, useTimeState } from "../store";
import { formatTimer, liveSeconds } from "../utils";
import { useNow } from "../hooks/use-now";

/**
 * Floating compact timer pill. Renders only when the current user has an
 * active timer running. Sits in the bottom-right on desktop; spans the
 * width on mobile.
 */
export function FloatingActiveTimer({ className }: { className?: string }) {
  const userId = TIME_TRACKING_CURRENT_USER_ID;
  const active = useTimeState(
    (s) => s.logs.find((l) => l.userId === userId && l.endTime === null) ?? null,
  );
  const task = useTasksState((s) =>
    active ? (s.tasks.find((t) => t.id === active.taskId) ?? null) : null,
  );
  const now = useNow(active ? 1000 : 30_000);

  if (!active) return null;

  return (
    <div
      className={cn(
        "fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full border bg-card/95 px-2 py-1 shadow-lg backdrop-blur",
        "max-w-[calc(100vw-1.5rem)]",
        className,
      )}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Clock className="size-3.5 animate-pulse" />
      </span>
      <div className="min-w-0">
        {task ? (
          <Link
            to="/app/tasks/$id"
            params={{ id: task.id }}
            className="block max-w-[12rem] truncate text-xs font-medium hover:underline sm:max-w-[18rem]"
          >
            {task.ref} · {task.title}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Active timer</span>
        )}
        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatTimer(liveSeconds(active, now))}
        </span>
      </div>
      <Button
        size="sm"
        variant="destructive"
        className="h-7 gap-1 rounded-full px-2"
        onClick={() => stopTimer(active.id)}
      >
        <Square className="size-3" />
        <span className="hidden sm:inline">Stop</span>
      </Button>
    </div>
  );
}
