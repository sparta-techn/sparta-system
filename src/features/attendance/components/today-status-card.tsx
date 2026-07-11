import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coffee, Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/features/auth/auth-context";
import { expectedWorkMinutesFor } from "@/features/hr/employment-type";
import { cn } from "@/lib/utils";

import { endBreak, finishWork, startBreak, startWork } from "../api";
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

export function TodayStatusCard({ compact = false }: Props) {
  const { user, employmentType } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const settingsQ = useQuery(companySettingsQuery());
  const todayQ = useTodaySession(userId);

  const session = todayQ.data?.session ?? null;
  const breaks = todayQ.data?.breaks ?? [];

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

  // Target working hours branch on employment type: part-time targets a 4h day;
  // everyone else keeps the company-wide default (not a hardcoded 8h).
  const companyDefaultMinutes = settingsQ.data?.expected_work_minutes ?? 480;
  const expectedSeconds = expectedWorkMinutesFor(employmentType, companyDefaultMinutes) * 60;
  const remainingSeconds = Math.max(0, expectedSeconds - workedSeconds);
  const maxBreakSeconds = (settingsQ.data?.max_break_minutes ?? 60) * 60;
  const breakOver = breakSecondsTotal > maxBreakSeconds;

  const [finishedDetails, setFinishedDetails] = useState<WorkSessionRow | null>(null);

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
    mutationFn: finishWork,
    onSuccess: (row) => {
      toast.success("Work finished — see you tomorrow.");
      setFinishedDetails(row);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy =
    startMut.isPending ||
    breakMut.isPending ||
    resumeMut.isPending ||
    finishMut.isPending ||
    todayQ.isPending;

  const status = session?.session_status ?? "not_started";

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
                <span>Progress toward {formatDurationLong(expectedSeconds)}</span>
                <span className="tabular-nums">
                  {Math.min(100, Math.round((workedSeconds / expectedSeconds) * 100))}%
                </span>
              </div>
              <Progress
                value={Math.min(100, (workedSeconds / expectedSeconds) * 100)}
                className="h-1.5"
              />
            </div>

            {breakOver ? (
              <p className="text-xs text-warning" role="alert">
                You've exceeded the {settingsQ.data?.max_break_minutes ?? 60} min break allowance.
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
                  onClick={() => breakMut.mutate()}
                  disabled={busy}
                  aria-label="Start break"
                >
                  {breakMut.isPending ? <Loader2 className="animate-spin" /> : <Coffee />}
                  Start break
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => finishMut.mutate()}
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
                  onClick={() => finishMut.mutate()}
                  disabled={busy}
                  aria-label="Finish work"
                >
                  {finishMut.isPending ? <Loader2 className="animate-spin" /> : <Square />}
                  Finish work
                </Button>
              </>
            ) : null}

            {status === "finished" ? (
              <Button variant="outline" disabled aria-label="Day finished">
                Day finished
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <FinishSummaryDialog
        open={!!finishedDetails}
        session={finishedDetails}
        expectedSeconds={expectedSeconds}
        onOpenChange={(open) => {
          if (!open) setFinishedDetails(null);
        }}
      />
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
