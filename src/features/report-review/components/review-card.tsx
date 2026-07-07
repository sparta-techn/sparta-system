import { useState } from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ReportReviewDecision } from "@/services/reports";

import { REPORT_KIND_LABEL, type ReviewQueueItem } from "../types";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReviewCard({
  item,
  onReview,
}: {
  item: ReviewQueueItem;
  onReview: (decision: ReportReviewDecision, comment: string) => Promise<boolean>;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<ReportReviewDecision | null>(null);
  const review = item.latestReview;

  async function act(decision: ReportReviewDecision) {
    setSubmitting(decision);
    const ok = await onReview(decision, comment);
    setSubmitting(null);
    if (ok) setComment("");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{item.ownerName}</span>
            <Badge variant="secondary">{REPORT_KIND_LABEL[item.kind]}</Badge>
            <span className="text-xs text-muted-foreground">{formatDate(item.workDate)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
        </div>
        {review ? (
          <Badge variant={review.decision === "approved" ? "default" : "destructive"}>
            {review.decision === "approved" ? "Approved" : "Rejected"}
          </Badge>
        ) : (
          <Badge variant="outline">Pending</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {review?.comment ? (
          <p className="rounded-md bg-muted/50 p-2 text-sm">
            <span className="font-medium">Review note: </span>
            {review.comment}
          </p>
        ) : null}
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={review ? "Add a note to revise this review…" : "Optional review comment…"}
          rows={2}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => act("approved")}
            disabled={submitting !== null}
            className="gap-1"
          >
            <Check className="size-4" />
            {submitting === "approved" ? "Approving…" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => act("rejected")}
            disabled={submitting !== null}
            className="gap-1"
          >
            <X className="size-4" />
            {submitting === "rejected" ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
