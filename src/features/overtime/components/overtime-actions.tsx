import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Play, Square, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { formatDurationHMS, useLiveElapsedSeconds } from "@/features/attendance/hooks/use-timer";
import { cn } from "@/lib/utils";

import { finishOvertime, startOvertime } from "../api";
import { myTodayOvertimeQuery, overtimeKeys } from "../queries";
import type { OvertimeSession } from "../types";

/**
 * Employee overtime controls, shown once the regular work session is finished.
 * Handles the full self-serve lifecycle: start (or clock into a manager
 * request) → finish → awaiting approval → approved / rejected.
 */
export function OvertimeActions({ className }: { className?: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const todayQ = useQuery({ ...myTodayOvertimeQuery(userId ?? ""), enabled: !!userId });
  const session = todayQ.data ?? null;

  const invalidate = () => {
    if (userId) void qc.invalidateQueries({ queryKey: overtimeKeys.today(userId) });
    void qc.invalidateQueries({ queryKey: overtimeKeys.queue() });
  };

  const startMut = useMutation({
    mutationFn: () => startOvertime(),
    onSuccess: () => {
      toast.success("Overtime started.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const finishMut = useMutation({
    mutationFn: finishOvertime,
    onSuccess: () => {
      toast.success("Overtime logged — awaiting manager approval.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = startMut.isPending || finishMut.isPending || todayQ.isPending;

  // A session is "open" (running) when it has a start but no end and isn't rejected.
  const isRunning =
    !!session && !!session.start_time && !session.end_time && session.status !== "rejected";
  // A manager request the employee hasn't clocked into yet.
  const isRequestedNotStarted =
    !!session && session.status === "pending" && !session.start_time && !session.end_time;
  // No live session to act on → offer to start a (new) one.
  const canStart = !session || isRequestedNotStarted || session.status === "rejected";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {isRequestedNotStarted ? (
        <p className="text-xs text-muted-foreground">
          Your manager requested overtime for today. Start it when you begin.
        </p>
      ) : null}

      {isRunning ? <RunningOvertime session={session} /> : null}
      {session && !isRunning ? <OvertimeStatusLine session={session} /> : null}

      <div className="flex flex-wrap gap-2">
        {canStart ? (
          <Button
            variant="secondary"
            onClick={() => startMut.mutate()}
            disabled={busy}
            aria-label="Start overtime"
          >
            {startMut.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            Start overtime
          </Button>
        ) : null}

        {isRunning ? (
          <Button
            variant="secondary"
            onClick={() => finishMut.mutate()}
            disabled={busy}
            aria-label="Finish overtime"
          >
            {finishMut.isPending ? <Loader2 className="animate-spin" /> : <Square />}
            Finish overtime
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RunningOvertime({ session }: { session: OvertimeSession }) {
  const elapsed = useLiveElapsedSeconds(session.start_time, true);
  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="size-4 text-warning" aria-hidden />
      <span className="text-muted-foreground">Overtime running</span>
      <span className="font-display font-semibold tabular-nums text-foreground">
        {formatDurationHMS(elapsed)}
      </span>
    </div>
  );
}

function OvertimeStatusLine({ session }: { session: OvertimeSession }) {
  if (session.status === "approved") {
    return (
      <Badge variant="outline" className="w-fit gap-1 text-success">
        <CheckCircle2 className="size-3.5" aria-hidden /> Overtime approved
      </Badge>
    );
  }
  if (session.status === "rejected") {
    return (
      <div className="space-y-0.5">
        <Badge variant="outline" className="w-fit gap-1 text-destructive">
          <XCircle className="size-3.5" aria-hidden /> Overtime rejected
        </Badge>
        {session.rejection_reason ? (
          <p className="text-xs text-muted-foreground">{session.rejection_reason}</p>
        ) : null}
      </div>
    );
  }
  // pending + logged (has end_time)
  if (session.end_time) {
    return (
      <Badge variant="outline" className="w-fit gap-1 text-muted-foreground">
        <Clock className="size-3.5" aria-hidden /> Logged · awaiting approval
      </Badge>
    );
  }
  return null;
}
