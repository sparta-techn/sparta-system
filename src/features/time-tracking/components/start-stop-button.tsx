import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIME_TRACKING_CURRENT_USER_ID, startTimer, stopTimer, useTimeState } from "../store";
import { formatTimer, liveSeconds } from "../utils";
import { useNow } from "../hooks/use-now";

interface Props {
  taskId: string;
  variant?: "default" | "compact";
  className?: string;
}

/** Single Start/Stop button bound to the current user's active timer. */
export function StartStopButton({ taskId, variant = "default", className }: Props) {
  const userId = TIME_TRACKING_CURRENT_USER_ID;
  const active = useTimeState(
    (s) => s.logs.find((l) => l.userId === userId && l.endTime === null) ?? null,
  );
  const now = useNow(active ? 1000 : 30_000);
  const isThisTask = active?.taskId === taskId;

  if (variant === "compact") {
    return (
      <Button
        size="sm"
        variant={isThisTask ? "destructive" : "outline"}
        className={cn("h-8 gap-1.5", className)}
        onClick={() => (isThisTask ? stopTimer(active!.id) : startTimer(taskId, userId))}
      >
        {isThisTask ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
        {isThisTask ? formatTimer(liveSeconds(active!, now)) : "Start"}
      </Button>
    );
  }

  return (
    <Button
      variant={isThisTask ? "destructive" : "default"}
      className={cn("gap-2", className)}
      onClick={() => (isThisTask ? stopTimer(active!.id) : startTimer(taskId, userId))}
    >
      {isThisTask ? (
        <>
          <Square className="size-4" /> Stop · {formatTimer(liveSeconds(active!, now))}
        </>
      ) : (
        <>
          <Play className="size-4" /> Start timer
        </>
      )}
    </Button>
  );
}
