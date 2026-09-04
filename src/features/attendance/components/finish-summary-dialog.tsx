import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isFeatureInMvp } from "@/config/mvp-scope";
import { formatDurationLong } from "../hooks/use-timer";
import { AttendanceBadge } from "./attendance-status-badge";
import type { WorkSessionRow } from "../types";

/** Overtime is removed from the product; the row stays behind the scope gate. */
const SHOW_OVERTIME = isFeatureInMvp("overtime");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WorkSessionRow | null;
  /** Net working seconds that complete the day (7h full-time / 4h part-time). */
  targetSeconds: number;
  /** Seconds payroll credits on top once the day completes (0 for part-time). */
  paidBreakCreditSeconds: number;
}

export function FinishSummaryDialog({
  open,
  onOpenChange,
  session,
  targetSeconds,
  paidBreakCreditSeconds,
}: Props) {
  if (!session) return null;
  // The day is measured on net working time only — break time is excluded from
  // the target and credited separately by payroll.
  const worked = session.working_seconds;
  const pct = Math.min(100, Math.round((worked / targetSeconds) * 100));
  const autoFinished = session.check_out_type === "auto";
  const paidSeconds = worked + (autoFinished ? paidBreakCreditSeconds : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Day wrapped</DialogTitle>
          <DialogDescription>Here's how your work session ended.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Row label="Status">
            <AttendanceBadge status={session.attendance_status} />
          </Row>
          <Row label="Worked">
            <strong className="tabular-nums">{formatDurationLong(worked)}</strong>{" "}
            <span className="text-muted-foreground">({pct}% of target)</span>
          </Row>
          <Row label="Break">
            <strong className="tabular-nums">{formatDurationLong(session.break_seconds)}</strong>
          </Row>
          {autoFinished && paidBreakCreditSeconds > 0 ? (
            <Row label="Counted for pay">
              <strong className="tabular-nums">{formatDurationLong(paidSeconds)}</strong>{" "}
              <span className="text-muted-foreground">
                (includes the {formatDurationLong(paidBreakCreditSeconds)} paid break)
              </span>
            </Row>
          ) : null}
          {SHOW_OVERTIME ? (
            <Row label="Overtime">
              <strong className="tabular-nums">
                {formatDurationLong(session.overtime_seconds)}
              </strong>
            </Row>
          ) : null}
          <Row label="Late">
            <strong className="tabular-nums">{session.late_minutes} min</strong>
          </Row>
          <Row label="Started">
            <span className="tabular-nums">
              {session.started_at
                ? new Date(session.started_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </Row>
          <Row label="Finished">
            <span className="tabular-nums">
              {session.finished_at
                ? new Date(session.finished_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </Row>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
