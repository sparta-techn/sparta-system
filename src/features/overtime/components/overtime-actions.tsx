import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

import { myTodayOvertimeQuery } from "../queries";
import type { OvertimeSession } from "../types";

/**
 * Employee overtime status, shown once the regular work session is finished.
 *
 * Overtime is no longer started with a click: when worked time reaches the
 * employee's target the regular session auto-transitions into a pending
 * overtime session (see `transition_overtime_if_due` + the every-minute server
 * sweep), and the running state + Finish control live on the attendance card.
 * This component is the post-transition status tail: awaiting approval,
 * approved, rejected, or a manager's scheduled-overtime hint.
 */
export function OvertimeActions({ className }: { className?: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const todayQ = useQuery({ ...myTodayOvertimeQuery(userId ?? ""), enabled: !!userId });
  const session = todayQ.data ?? null;

  if (!session) return null;

  // A manager scheduled overtime the employee hasn't reached yet: it will start
  // automatically when they pass their target hours (no button needed).
  const isScheduledNotStarted =
    session.status === "pending" && !session.start_time && !session.end_time;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {isScheduledNotStarted ? (
        <p className="text-xs text-muted-foreground">
          Your manager scheduled overtime for today. It starts automatically once you pass your
          target hours.
        </p>
      ) : (
        <OvertimeStatusLine session={session} />
      )}
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
  // pending + logged (has end_time) → awaiting manager approval
  if (session.end_time) {
    return (
      <Badge variant="outline" className="w-fit gap-1 text-muted-foreground">
        <Clock className="size-3.5" aria-hidden /> Logged · awaiting approval
      </Badge>
    );
  }
  return null;
}
