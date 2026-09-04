import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Coffee, Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/features/auth/auth-context";
import {
  creditedBreakSeconds,
  expectedWorkMinutesFor,
  hasBreakAllowance,
} from "@/features/hr/employment-type";
import { cn } from "@/lib/utils";

import {
  autoFinishSessionIfDue,
  endBreak,
  finishCurrentSession,
  startBreak,
  startWork,
} from "../api";
import { useTodaySession } from "../hooks/use-today-session";
import {
  formatDurationHMS,
  formatDurationLong,
  useLiveElapsedSeconds,
  useNow,
} from "../hooks/use-timer";
import { useQuery } from "@tanstack/react-query";
import { companySettingsQuery, attendanceKeys } from "../queries";
import { SessionStatusBadge } from "./attendance-status-badge";
import { FinishSummaryDialog } from "./finish-summary-dialog";
import type { WorkSessionRow } from "../types";

interface Props {
  /** Compact variant tucks elements tighter for the dashboard. */
  compact?: boolean;
}

type ConfirmKind = "break" | "finish";

const confirmCopy: Record<
  ConfirmKind,
  { title: string; body: string; action: string; destructive: boolean }
> = {
  break: {
    title: "Start a break?",
    body: "Your worked time pauses until you resume. You can pick back up whenever you're ready.",
    action: "Start break",
    destructive: false,
  },
  finish: {
    title: "Finish work for today?",
    body: "This will end your session and cannot be undone.",
    action: "Finish work",
    destructive: true,
  },
};

export function TodayStatusCard({ compact = false }: Props) {
  const { user, employmentType } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const settingsQ = useQuery(companySettingsQuery());
  const todayQ = useTodaySession(userId);

  const session = todayQ.data?.session ?? null;
  const breaks = todayQ.data?.breaks ?? [];

  // A day holds more than one session once someone re-checks in after being
  // auto-finished. The daily target is spent at that point, so this session just
  // accrues extra regular time — no second target, no auto-finish.
  const isTopUpSession = (todayQ.data?.sessionsToday ?? 0) > 1;
  const autoFinished = session?.session_status === "finished" && session.check_out_type === "auto";

  const now = useNow("second");
  const openBreak = breaks.find((b) => !b.ended_at);

  // Live working seconds: total since start, minus completed breaks, minus current open break.
  const completedBreakSeconds = breaks.reduce((acc, b) => acc + (b.duration_seconds ?? 0), 0);
  const openBreakElapsed = useLiveElapsedSeconds(openBreak?.started_at ?? null, !!openBreak);
  const totalSinceStart = session?.started_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000))
    : 0;
  const workedSeconds = Math.max(0, totalSinceStart - completedBreakSeconds - openBreakElapsed);
  const breakSecondsTotal = completedBreakSeconds + openBreakElapsed;

  // Target and break policy branch on employment type:
  //  - Full-time: the company day (8h) is measured on the clock — the break
  //    allowance counts toward it, so a full day is 7h worked + 1h break.
  //  - Part-time: 4h of actual work, with breaks neither counted nor capped.
  const companyDefaultMinutes = settingsQ.data?.expected_work_minutes ?? 480;
  const expectedSeconds = expectedWorkMinutesFor(employmentType, companyDefaultMinutes) * 60;
  const maxBreakSeconds = (settingsQ.data?.max_break_minutes ?? 60) * 60;
  const breakLimited = hasBreakAllowance(employmentType);
  const creditedBreak = creditedBreakSeconds(employmentType, breakSecondsTotal, maxBreakSeconds);
  const progressSeconds = workedSeconds + creditedBreak;
  const remainingSeconds = Math.max(0, expectedSeconds - progressSeconds);
  const breakOver = breakLimited && breakSecondsTotal > maxBreakSeconds;

  const [finishedDetails, setFinishedDetails] = useState<WorkSessionRow | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const invalidateAll = () => {
    if (!userId) return;
    void qc.invalidateQueries({ queryKey: attendanceKeys.today(userId) });
    void qc.invalidateQueries({ queryKey: attendanceKeys.history(userId, {} as never) });
  };

  const startMut = useMutation({
    mutationFn: startWork,
    onSuccess: () => {
      toast.success("Work started. Have a great day.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const breakMut = useMutation({
    mutationFn: startBreak,
    onSuccess: () => {
      toast("Break started.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resumeMut = useMutation({
    mutationFn: endBreak,
    onSuccess: () => {
      toast.success("Welcome back.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const finishMut = useMutation({
    mutationFn: finishCurrentSession,
    onSuccess: (res) => {
      toast.success("Work finished — see you tomorrow.");
      if (res.session) setFinishedDetails(res.session);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runConfirm = () => {
    if (confirm === "break") breakMut.mutate();
    else if (confirm === "finish") finishMut.mutate();
    setConfirm(null);
  };

  const busy =
    startMut.isPending ||
    breakMut.isPending ||
    resumeMut.isPending ||
    finishMut.isPending ||
    todayQ.isPending;

  const status = session?.session_status ?? "not_started";

  // Auto-finish: schedule a server poke for when live day progress is projected
  // to reach the target, purely so an open tab reflects the close promptly. This
  // is a nicety, NOT the mechanism — `job_auto_finish_sessions` (pg_cron, every
  // 10 min) closes sessions whether or not anyone has the app open, and
  // setTimeout is unreliable in a backgrounded tab anyway (the overnight case).
  // Skipped for a top-up session: the day's target is already spent.
  const openBreakStartedAt = openBreak?.started_at ?? null;
  useEffect(() => {
    if (!userId || !session?.started_at || isTopUpSession) return;
    const onBreak = session.session_status === "on_break";
    if (session.session_status !== "working" && !onBreak) return;

    const breakNow =
      completedBreakSeconds +
      (onBreak && openBreakStartedAt
        ? Math.max(0, (Date.now() - new Date(openBreakStartedAt).getTime()) / 1000)
        : 0);
    const workedNow = Math.max(
      0,
      (Date.now() - new Date(session.started_at).getTime()) / 1000 - breakNow,
    );
    const creditNow = breakLimited ? Math.min(breakNow, maxBreakSeconds) : 0;
    const remainingToTarget = Math.max(0, expectedSeconds - workedNow - creditNow);

    // On break, progress only keeps ticking while break allowance is left; once
    // it's spent the clock freezes, so there is nothing to schedule until they
    // resume (which re-runs this effect).
    if (onBreak) {
      const creditLeft = breakLimited ? Math.max(0, maxBreakSeconds - breakNow) : 0;
      if (remainingToTarget > creditLeft) return;
    }

    const remainingMs = remainingToTarget * 1000;
    const poke = () => {
      autoFinishSessionIfDue()
        .then(() => {
          void qc.invalidateQueries({ queryKey: attendanceKeys.today(userId) });
        })
        .catch(() => {
          /* the scheduled server sweep still closes the session */
        });
    };
    const id = window.setTimeout(poke, remainingMs + 750);
    return () => window.clearTimeout(id);
  }, [
    userId,
    session?.id,
    session?.started_at,
    session?.session_status,
    isTopUpSession,
    completedBreakSeconds,
    openBreakStartedAt,
    expectedSeconds,
    breakLimited,
    maxBreakSeconds,
    qc,
  ]);

  const headerTime = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const headerDate = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent
          className={cn(
            "grid gap-6 p-6",
            compact ? "" : "md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
          )}
        >
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SessionStatusBadge status={status} />
              {session?.late_minutes && session.late_minutes > 0 ? (
                <span
                  className={cn(
                    "text-xs",
                    session.attendance_status === "late" ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {session.late_minutes} min after{" "}
                  {settingsQ.data?.work_start_time?.slice(0, 5) ?? "09:00"}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Scheduled start {settingsQ.data?.work_start_time?.slice(0, 5) ?? "09:00"}
                  {session?.started_at
                    ? ` · Started ${new Date(session.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </span>
              )}
            </div>
            <div>
              <p className="font-display text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
                {headerTime}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{headerDate}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-3">
              <Stat label="Worked" value={formatDurationHMS(workedSeconds)} />
              <Stat
                label="On break"
                value={formatDurationHMS(breakSecondsTotal)}
                tone={breakOver ? "warning" : "muted"}
              />
              <Stat label="Remaining" value={formatDurationHMS(remainingSeconds)} />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Progress toward {formatDurationLong(expectedSeconds)}
                  {breakLimited
                    ? ` (includes up to ${settingsQ.data?.max_break_minutes ?? 60} min break)`
                    : " of work"}
                </span>
                <span className="tabular-nums">
                  {Math.min(100, Math.round((progressSeconds / expectedSeconds) * 100))}%
                </span>
              </div>
              <Progress
                value={Math.min(100, (progressSeconds / expectedSeconds) * 100)}
                className="h-1.5"
              />
            </div>

            {breakOver ? (
              <p className="text-xs text-warning" role="alert">
                You've exceeded the {settingsQ.data?.max_break_minutes ?? 60} min break allowance —
                time past it no longer counts toward your day.
              </p>
            ) : null}

            {autoFinished ? (
              <div
                className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2"
                role="status"
              >
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    You hit your target — we closed your day at{" "}
                    <span className="font-display tabular-nums">
                      {session?.finished_at
                        ? new Date(session.finished_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nothing to do. If you need to work more today, start a new session — it's logged
                    as ordinary hours.
                  </p>
                </div>
              </div>
            ) : null}

            {isTopUpSession ? (
              <p className="text-xs text-muted-foreground">
                Extra session — you already completed today's {formatDurationLong(expectedSeconds)}.
                This time is logged as ordinary hours and won't close on its own.
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "flex flex-wrap gap-2",
              compact ? "" : "md:flex-col md:items-stretch md:min-w-48",
            )}
          >
            {!session ? (
              <Button onClick={() => startMut.mutate()} disabled={busy} aria-label="Start work">
                {startMut.isPending ? <Loader2 className="animate-spin" /> : <Play />} Start work
              </Button>
            ) : null}

            {status === "working" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirm("break")}
                  disabled={busy}
                  aria-label="Start break"
                >
                  {breakMut.isPending ? <Loader2 className="animate-spin" /> : <Coffee />}
                  Start break
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirm("finish")}
                  disabled={busy}
                  aria-label="Finish work"
                >
                  {finishMut.isPending ? <Loader2 className="animate-spin" /> : <Square />}
                  Finish work
                </Button>
              </>
            ) : null}

            {status === "on_break" ? (
              <>
                <Button onClick={() => resumeMut.mutate()} disabled={busy} aria-label="Resume work">
                  {resumeMut.isPending ? <Loader2 className="animate-spin" /> : <Pause />}
                  Resume work
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirm("finish")}
                  disabled={busy}
                  aria-label="Finish work"
                >
                  {finishMut.isPending ? <Loader2 className="animate-spin" /> : <Square />}
                  Finish work
                </Button>
              </>
            ) : null}

            {/* A finished day is no longer a dead end: an employee who is asked to
                work more (or was auto-finished mid-task) opens a fresh session,
                which logs ordinary hours at the ordinary rate. */}
            {status === "finished" ? (
              <div className="space-y-2">
                <Button onClick={() => startMut.mutate()} disabled={busy} aria-label="Start work">
                  {startMut.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                  Start another session
                </Button>
                <p className="text-xs text-muted-foreground">
                  Today's session is closed. Only start again if you're actually working.
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <FinishSummaryDialog
        open={!!finishedDetails}
        session={finishedDetails}
        expectedSeconds={expectedSeconds}
        breakCreditSeconds={breakLimited ? maxBreakSeconds : 0}
        onOpenChange={(open) => {
          if (!open) setFinishedDetails(null);
        }}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          {confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmCopy[confirm].title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmCopy[confirm].body}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={runConfirm}
                  className={
                    confirmCopy[confirm].destructive
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                >
                  {confirmCopy[confirm].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "warning";
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-display text-xl font-semibold tabular-nums",
          tone === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
