import { FileClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AttendanceException } from "../exceptions-api";
import { AddExceptionDialog } from "./add-exception-dialog";

/** "2h 30m" / "45m" from signed minutes; "" when zero. */
function formatMinutes(min: number): string {
  const abs = Math.abs(min);
  if (abs === 0) return "";
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = min < 0 ? "−" : "";
  return `${sign}${h ? `${h}h ` : ""}${m ? `${m}m` : ""}`.trim();
}

function ExceptionRow({ exception }: { exception: AttendanceException }) {
  const amount = formatMinutes(exception.adjustment_minutes);
  return (
    <span className="flex flex-col items-start gap-0.5" title={exception.reason}>
      <Badge
        variant="outline"
        className={cn("gap-1", exception.paid ? "text-success" : "text-muted-foreground")}
      >
        <FileClock className="size-3" aria-hidden />
        Adjusted · {exception.paid ? "Paid" : "Unpaid"}
        {amount ? ` · ${amount}` : ""}
      </Badge>
      {/* Reason stays visible (truncated) — an adjusted day is never silently altered. */}
      <span className="max-w-[16rem] truncate text-[11px] font-normal text-muted-foreground">
        {exception.reason}
      </span>
    </span>
  );
}

/**
 * Shows any attendance exceptions logged against a day so an adjusted day is
 * always visible for audit — the reason is rendered inline, not hidden. When
 * `editable`, clicking opens the edit dialog (reviewers only; RLS is the real
 * gate).
 */
export function AttendanceExceptionNote({
  exceptions,
  editable = false,
}: {
  exceptions: AttendanceException[] | undefined;
  editable?: boolean;
}) {
  if (!exceptions || exceptions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      {exceptions.map((ex) =>
        editable ? (
          <AddExceptionDialog
            key={ex.id}
            existing={ex}
            trigger={
              <button
                type="button"
                className="text-left transition-opacity hover:opacity-80"
                aria-label={`Edit exception: ${ex.reason}`}
              >
                <ExceptionRow exception={ex} />
              </button>
            }
          />
        ) : (
          <ExceptionRow key={ex.id} exception={ex} />
        ),
      )}
    </div>
  );
}
