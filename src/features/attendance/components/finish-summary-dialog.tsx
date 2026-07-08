import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDurationLong } from "../hooks/use-timer";
import { AttendanceBadge } from "./attendance-status-badge";
import type { WorkSessionRow } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WorkSessionRow | null;
  expectedSeconds: number;
}

export function FinishSummaryDialog({ open, onOpenChange, session, expectedSeconds }: Props) {
  if (!session) return null;
  const worked = session.working_seconds;
  const target = expectedSeconds;
  const pct = Math.min(100, Math.round((worked / target) * 100));

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
            <span className="text-muted-foreground">({pct}%)</span>
          </Row>
          <Row label="Break">
            <strong className="tabular-nums">{formatDurationLong(session.break_seconds)}</strong>
          </Row>
          <Row label="Overtime">
            <strong className="tabular-nums">{formatDurationLong(session.overtime_seconds)}</strong>
          </Row>
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
