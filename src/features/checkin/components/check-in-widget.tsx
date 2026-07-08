import { Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

import { canEditSubmission, useMinuteTick, useTodaySubmission } from "../store";
import { MOOD_OPTIONS } from "../types";

export function CheckInWidget() {
  // Minute tick keeps the "X min ago" + edit-window expiry fresh.
  useMinuteTick();
  const submission = useTodaySubmission();

  if (!submission) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" aria-hidden /> Morning check-in
            </CardTitle>
            <CardDescription>Plan your day in under 2 minutes.</CardDescription>
          </div>
          <StatusBadge tone="warning" label="Not submitted" />
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/app/check-in">
              Start check-in <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const mood = MOOD_OPTIONS.find((m) => m.value === submission.mood);
  const editable = canEditSubmission(submission);
  const submittedAt = new Date(submission.submittedAt);
  const submittedAtStr = submittedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const primaryBlocker = submission.blockers[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden /> Morning check-in
          </CardTitle>
          <CardDescription>Submitted at {submittedAtStr}</CardDescription>
        </div>
        <StatusBadge tone="success" label="Completed" />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row
          label="Mood"
          value={
            mood ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-base leading-none">{mood.emoji}</span>
                <span>{mood.label}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <Row
          label="Goal"
          value={
            <span className="inline-flex items-start gap-1.5">
              <Target className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="line-clamp-2 text-foreground">{submission.mainGoal}</span>
            </span>
          }
        />
        <Row
          label="Blocker"
          value={
            primaryBlocker ? (
              <StatusBadge tone="warning" label={primaryBlocker.label} size="sm" />
            ) : (
              <span className="text-muted-foreground">None expected</span>
            )
          }
        />

        {editable ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/app/check-in" search={{ edit: 1 }}>
              <Pencil className="size-3.5" /> Edit (window open)
            </Link>
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground">Editing window closed.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[60px_minmax(0,1fr)] items-start gap-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{value}</div>
    </div>
  );
}
