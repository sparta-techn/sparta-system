import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { PreviewBadge } from "@/components/preview-banner";
import { EmptyState } from "@/features/hr/components/empty-state";
import { commStore, selectTaskComments, useCommState } from "../store";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

const CURRENT_USER_ID = "emp_001";

/**
 * Top-level threaded comments view for the Task Detail "Comments" tab.
 * Renders root comments with nested replies and a primary composer.
 */
export function ThreadedComments({ taskId }: { taskId: string }) {
  const comments = useCommState(selectTaskComments(taskId));

  const { roots, repliesByParent } = useMemo(() => {
    const sorted = [...comments].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const roots = sorted.filter((c) => !c.parentCommentId);
    const repliesByParent = new Map<string, typeof sorted>();
    for (const c of sorted) {
      if (!c.parentCommentId) continue;
      const arr = repliesByParent.get(c.parentCommentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentCommentId, arr);
    }
    return { roots, repliesByParent };
  }, [comments]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Discussion</h3>
          <p className="text-xs text-muted-foreground">
            {comments.length} {comments.length === 1 ? "comment" : "comments"} · threaded
          </p>
        </div>
        <PreviewBadge />
      </header>

      <CommentComposer
        onSubmit={(message) => commStore.addComment({ taskId, userId: CURRENT_USER_ID, message })}
      />

      {roots.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Start the conversation — use @ to mention a teammate."
        />
      ) : (
        <ul className="space-y-3">
          {roots.map((c) => (
            <CommentItem key={c.id} comment={c} replies={repliesByParent.get(c.id) ?? []} />
          ))}
        </ul>
      )}
    </div>
  );
}
