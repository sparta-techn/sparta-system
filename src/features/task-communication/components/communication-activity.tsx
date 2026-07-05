import { MessageSquare, Paperclip, Pencil, Smile, Trash2 } from "lucide-react";
import { employeeById } from "@/features/tasks/utils";
import { selectTaskCommActivity, useCommState } from "../store";
import type { CommActivityKind } from "../types";
import { relativeTime } from "../utils";

const ICON: Record<CommActivityKind, typeof MessageSquare> = {
  comment_added: MessageSquare,
  comment_edited: Pencil,
  comment_deleted: Trash2,
  comment_reaction: Smile,
  file_uploaded: Paperclip,
  file_deleted: Trash2,
};

/**
 * Communication activity stream (comments + files) for a task.
 * Rendered alongside the Tasks-module activity timeline.
 */
export function CommunicationActivity({ taskId }: { taskId: string }) {
  const events = useCommState(selectTaskCommActivity(taskId));
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments &amp; files
      </h3>
      <ol className="relative ml-2 space-y-3 border-l pl-5">
        {sorted.map((e) => {
          const Icon = ICON[e.kind];
          return (
            <li key={e.id} className="relative">
              <span
                className="absolute -left-[28px] top-0.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground"
                aria-hidden
              >
                <Icon className="size-3" />
              </span>
              <p className="text-sm">
                <span className="font-medium">
                  {employeeById(e.actorId)?.name ?? "Someone"}
                </span>{" "}
                {e.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                {relativeTime(e.at)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
