import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { useReviewQueue } from "../hooks";
import { ReviewCard } from "./review-card";

type Filter = "pending" | "reviewed" | "all";

export function ReviewQueue() {
  const { items, loading, error, review } = useReviewQueue();
  const [filter, setFilter] = useState<Filter>("pending");

  const pendingCount = useMemo(() => items.filter((i) => !i.latestReview).length, [items]);

  const visible = useMemo(() => {
    if (filter === "pending") return items.filter((i) => !i.latestReview);
    if (filter === "reviewed") return items.filter((i) => i.latestReview);
    return items;
  }, [items, filter]);

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending
            {pendingCount > 0 ? (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading review queue…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Inbox className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {filter === "pending" ? "Nothing awaiting review. All caught up." : "No reports here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => (
            <ReviewCard
              key={`${item.subjectType}:${item.subjectId}`}
              item={item}
              onReview={(decision, comment) => review(item, decision, comment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
