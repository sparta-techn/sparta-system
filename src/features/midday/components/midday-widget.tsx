import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, GaugeCircle, Pencil, Target } from "lucide-react";

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

import { canEditMidday, useMinuteTick, useTodayMidday } from "../store";
import { OUTLOOK_META } from "../types";

export function MiddayWidget() {
  useMinuteTick();
  const submission = useTodayMidday();

  if (!submission) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <GaugeCircle className="size-4 text-info" aria-hidden /> Midday status
            </CardTitle>
            <CardDescription>2 minutes. Keep your team in sync.</CardDescription>
          </div>
          <StatusBadge tone="warning" label="Pending" />
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/app/midday">
              Submit update <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const editable = canEditMidday(submission);
  const submittedAt = new Date(submission.submittedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const outlook = submission.outlook ? OUTLOOK_META[submission.outlook] : null;
  const topBlocker = submission.blockerLinks.find((b) => !b.resolved);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <GaugeCircle className="size-4 text-info" aria-hidden /> Midday status
          </CardTitle>
          <CardDescription>Submitted at {submittedAt}</CardDescription>
        </div>
        <StatusBadge tone="success" label="Submitted" />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums">{submission.progress}%</span>
          </div>
          <Progress value={submission.progress} className="h-2" />
        </div>

        <Row
          label="Focus"
          value={
            <span className="inline-flex items-start gap-1.5">
              <Target className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="line-clamp-2 text-foreground">
                {submission.currentFocus || "—"}
              </span>
            </span>
          }
        />
        <Row
          label="Blocker"
          value={
            topBlocker ? (
              <span className="inline-flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span className="line-clamp-2 text-foreground">{topBlocker.titleSnapshot}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">None active</span>
            )
          }
        />
        <Row
          label="Outlook"
          value={
            outlook ? (
              <StatusBadge tone={outlook.tone} label={outlook.label} size="sm" />
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />

        {editable ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/app/midday" search={{ edit: 1 }}>
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
