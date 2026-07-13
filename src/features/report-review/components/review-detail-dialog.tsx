import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { REPORT_KIND_LABEL, type ReviewQueueItem } from "../types";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Read-only full view of a submitted report and its manager review trail. */
export function ReviewDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ReviewQueueItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{item.ownerName}</span>
            <Badge variant="secondary">{REPORT_KIND_LABEL[item.kind]}</Badge>
          </DialogTitle>
          <DialogDescription>
            {formatDate(item.workDate)} · Submitted {formatDateTime(item.submittedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {item.detail.length > 0 ? (
            item.detail.map((section) => (
              <div key={section.label}>
                <h4 className="text-sm font-medium text-foreground">{section.label}</h4>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {section.body}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">This report has no additional detail.</p>
          )}
        </div>

        {item.reviews.length > 0 ? (
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium text-foreground">Review history</h4>
            <ul className="space-y-2">
              {item.reviews.map((review) => (
                <li key={review.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={review.decision === "approved" ? "default" : "destructive"}>
                        {review.decision === "approved" ? "Approved" : "Rejected"}
                      </Badge>
                      <span className="text-muted-foreground">by {review.reviewerName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(review.createdAt)}
                    </span>
                  </div>
                  {review.comment ? <p className="mt-2">{review.comment}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
