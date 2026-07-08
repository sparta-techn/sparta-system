import { useState } from "react";
import { MoreHorizontal, Reply, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EmployeeChip } from "@/features/tasks/components/employee-chip";
import { employeeById } from "@/features/tasks/utils";
import type { TaskThreadComment } from "../types";
import { QUICK_EMOJIS, MENTIONABLE_USERS } from "../types";
import { commStore } from "../store";
import { relativeTime } from "../utils";
import { CommentComposer } from "./comment-composer";

const CURRENT_USER_ID = "emp_001";

/** Render @handle tokens as styled chips inline with the message text. */
function renderMessage(message: string) {
  const parts = message.split(/(@[a-z0-9_]+)/gi);
  return parts.map((p, i) => {
    if (!p.startsWith("@")) return <span key={i}>{p}</span>;
    const handle = p.slice(1).toLowerCase();
    const user = MENTIONABLE_USERS.find((u) => u.handle === handle);
    return (
      <span
        key={i}
        className={cn(
          "rounded px-1 text-xs font-medium",
          user ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        @{user?.name.split(" ")[0] ?? handle}
      </span>
    );
  });
}

export function CommentItem({
  comment,
  replies,
  depth = 0,
}: {
  comment: TaskThreadComment;
  replies: TaskThreadComment[];
  depth?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);

  const isAuthor = comment.userId === CURRENT_USER_ID;
  const isDeleted = !!comment.deletedAt;

  return (
    <li className={cn("space-y-2", depth > 0 && "border-l pl-3 sm:pl-4")}>
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <EmployeeChip id={comment.userId} />
            <span className="text-muted-foreground">
              {relativeTime(comment.createdAt)}
              {comment.updatedAt !== comment.createdAt && !isDeleted ? " · edited" : null}
            </span>
          </div>
          {!isDeleted ? (
            <div className="flex items-center gap-0.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    aria-label="Add reaction"
                  >
                    <SmilePlus className="size-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1">
                  <div className="flex gap-1">
                    {QUICK_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => commStore.toggleReaction(comment.id, e, CURRENT_USER_ID)}
                        className="rounded p-1 text-lg hover:bg-accent"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                aria-label="Reply"
                onClick={() => setReplying((r) => !r)}
              >
                <Reply className="size-3.5" />
              </Button>
              {isAuthor ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground"
                      aria-label="More"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => commStore.deleteComment(comment.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ) : null}
        </div>

        {isDeleted ? (
          <p className="mt-2 text-sm italic text-muted-foreground">This comment was deleted.</p>
        ) : editing ? (
          <div className="mt-2">
            <CommentComposer
              initialValue={comment.message}
              submitLabel="Save"
              compact
              autoFocus
              onSubmit={(msg) => {
                commStore.editComment(comment.id, msg);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {renderMessage(comment.message)}
          </p>
        )}

        {!isDeleted && comment.reactions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {comment.reactions.map((r) => {
              const mine = r.userIds.includes(CURRENT_USER_ID);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => commStore.toggleReaction(comment.id, r.emoji, CURRENT_USER_ID)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                    mine
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                  title={r.userIds.map((id) => employeeById(id)?.name ?? id).join(", ")}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {replying ? (
        <div className="pl-3 sm:pl-4">
          <CommentComposer
            placeholder="Write a reply…"
            submitLabel="Reply"
            compact
            autoFocus
            onSubmit={(msg) => {
              commStore.addComment({
                taskId: comment.taskId,
                userId: CURRENT_USER_ID,
                message: msg,
                parentCommentId: comment.id,
              });
              setReplying(false);
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      ) : null}

      {replies.length > 0 ? (
        <ul className="space-y-2">
          {replies.map((r) => (
            <CommentItem key={r.id} comment={r} replies={[]} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
