import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDependencies } from "@/features/dependencies/store";
import { CURRENT_USER_ID } from "@/features/dependencies/mock-data";
import { cn } from "@/lib/utils";

import { MIDDAY_REMINDER_HOUR, shouldRemind, useMinuteTick, useTodayMidday } from "../store";

const DISMISS_KEY = "sf:midday:reminder-dismissed";

function dismissedToday(): boolean {
  if (typeof window === "undefined") return true;
  const today = new Date().toISOString().slice(0, 10);
  return window.localStorage.getItem(DISMISS_KEY) === today;
}

/**
 * Floating reminder banner. Appears after 14:00 (default) when no submission
 * exists, and stays dismissed for the rest of the day once closed.
 */
export function MiddayReminder() {
  useMinuteTick();
  const submission = useTodayMidday();
  const deps = useDependencies();
  const [dismissed, setDismissed] = useState<boolean>(() => dismissedToday());

  useEffect(() => {
    // If user submits, hide silently.
    if (submission) setDismissed(true);
  }, [submission]);

  const open = !submission && !dismissed && shouldRemind();
  if (!open) return null;

  const openBlockers = deps.filter(
    (d) =>
      d.requesterId === CURRENT_USER_ID &&
      !["resolved", "closed", "cancelled", "rejected"].includes(d.state),
  );

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-lg border bg-card p-4 shadow-lg",
        "border-warning/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-warning-soft text-warning">
          <Bell className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Midday status reminder</p>
          <p className="text-xs text-muted-foreground">
            It's past {MIDDAY_REMINDER_HOUR}:00 — share your progress in under 2 minutes.
          </p>
          {openBlockers.length > 0 ? (
            <p className="mt-1 text-[11px] text-warning">
              {openBlockers.length} open dependency
              {openBlockers.length === 1 ? "" : "ies"} will pre-fill for you.
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <Button asChild size="sm">
              <Link to="/app/midday">
                Submit now <ArrowRight className="size-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Snooze
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label="Dismiss reminder"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
