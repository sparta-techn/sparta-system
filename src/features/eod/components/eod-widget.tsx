import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardCheck, Pencil, Target } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { canEditEod, eodCompletionPct, getEodDraft, useMinuteTick, useTodayEod } from "../store";

export function EodWidget() {
  useMinuteTick();
  const submission = useTodayEod();

  if (!submission) {
    const draft = getEodDraft();
    const pct = eodCompletionPct(draft);
    const hasDraft = pct > 0;
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-primary" aria-hidden /> End-of-day report
            </CardTitle>
            <CardDescription>
              {hasDraft ? "Draft in progress." : "5 minutes. Daily handover."}
            </CardDescription>
          </div>
          <StatusBadge tone={hasDraft ? "info" : "warning"} label={hasDraft ? "Draft" : "Pending"} />
        </CardHeader>
        <CardContent className="space-y-3">
          {hasDraft ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          ) : null}
          <Button asChild className="w-full">
            <Link to="/app/eod">
              {hasDraft ? "Resume report" : "Submit report"} <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const editable = canEditEod(submission);
  const submittedAt = new Date(submission.submittedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const pct = eodCompletionPct(submission);
  const topPriority = submission.tomorrow.priorities[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="size-4 text-primary" aria-hidden /> End-of-day report
          </CardTitle>
          <CardDescription>Submitted at {submittedAt} · ready for checkout</CardDescription>
        </div>
        <StatusBadge tone="success" label="Submitted" />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Sections filled</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <Row
          label="Tomorrow"
          value={
            topPriority ? (
              <span className="inline-flex items-start gap-1.5">
                <Target className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="line-clamp-2 text-foreground">{topPriority}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">No priorities set</span>
            )
          }
        />
        <Row
          label="Done"
          value={
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
              <span className="text-foreground tabular-nums">
                {submission.completed.filter((t) => t.state === "completed").length}
              </span>
              <span className="text-muted-foreground">completed today</span>
            </span>
          }
        />

        {editable ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/app/eod" search={{ edit: 1 }}>
              <Pencil className="size-3.5" /> Edit (window open)
            </Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/app/eod/history">View history</Link>
          </Button>
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
