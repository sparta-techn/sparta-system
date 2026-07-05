/**
 * Comments source — the discussion on a task in scope.
 *
 * Comments are entity-scoped, so this source requires a `taskId` hint. Without a
 * target it returns a note rather than dumping unrelated threads. Reads through
 * the tasks service (`listComments`) — never a comment UI component.
 */

import { tasksService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, hintString, snippet } from "./source-utils";

export const commentsSource: ContextSource = {
  key: "comments",
  label: "Comments",

  async gather({ hints }) {
    const taskId = hintString(hints, "taskId");
    if (!taskId) {
      return emptyFragment(
        "comments",
        this.label,
        "No entity in scope — provide a taskId to include its comments.",
      );
    }

    const comments = await tasksService.listComments(taskId);
    if (comments.length === 0) {
      return emptyFragment("comments", this.label, "No comments on this task.");
    }

    // Most recent first, capped.
    const ordered = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { items, truncated } = clampList(ordered, 5);

    const entities: ContextEntity[] = items.map((c) => ({
      type: "comment",
      id: c.id,
      summary: `${c.authorId} @ ${c.createdAt}: ${snippet(c.body, 140)}`,
    }));

    return fragment("comments", this.label, entities, { truncated });
  },
};
