import { useState } from "react";
import { AtSign, MessageSquare, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { personById } from "../mock-data";
import { dependencyStore } from "../store";
import type { Dependency, DependencyComment } from "../types";
import { timeAgo } from "../utils";
import { PersonChip } from "./dep-badges";

export function DepComments({ dep }: { dep: Dependency }) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const roots = dep.comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => dep.comments.filter((c) => c.parentId === id);

  function send() {
    if (!draft.trim()) return;
    dependencyStore.addComment(dep.id, draft.trim(), replyTo);
    setDraft("");
    setReplyTo(null);
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Comments <span className="text-muted-foreground">({dep.comments.length})</span>
        </h2>
      </header>

      {roots.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-3">
          {roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesOf(c.id)}
              onReply={() => setReplyTo(c.id)}
            />
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Replying to thread</span>
            <button type="button" className="hover:text-foreground" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </div>
        )}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment. Use @ to mention…"
          rows={3}
          aria-label="New comment"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <button type="button" className="inline-flex items-center gap-1 text-xs hover:text-foreground" aria-label="Mention">
              <AtSign className="size-3.5" /> Mention
            </button>
            <button type="button" className="inline-flex items-center gap-1 text-xs hover:text-foreground" aria-label="Attach">
              <Paperclip className="size-3.5" /> Attach
            </button>
          </div>
          <Button size="sm" disabled={!draft.trim()} onClick={send}>
            Comment
          </Button>
        </div>
      </div>
    </section>
  );
}

function CommentItem({
  comment,
  replies,
  onReply,
}: {
  comment: DependencyComment;
  replies: DependencyComment[];
  onReply: () => void;
}) {
  const author = personById(comment.authorId);
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <header className="flex items-center justify-between">
        {author ? (
          <PersonChip name={author.name} color={author.avatarColor} sub={author.role} />
        ) : (
          <span className="text-xs text-muted-foreground">Unknown</span>
        )}
        <span className="text-[11px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
      </header>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
      {comment.isStatusUpdate && (
        <span className="mt-2 inline-flex items-center rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info ring-1 ring-inset ring-info/20">
          Status update
        </span>
      )}
      <button
        type="button"
        onClick={onReply}
        className="mt-2 text-[11px] font-medium text-primary hover:underline"
      >
        Reply
      </button>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-border pl-3">
          {replies.map((r) => {
            const ra = personById(r.authorId);
            return (
              <li key={r.id} className="rounded-md bg-surface/40 p-2">
                <header className="flex items-center justify-between">
                  {ra ? <PersonChip name={ra.name} color={ra.avatarColor} /> : null}
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </header>
                <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{r.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
