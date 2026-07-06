/**
 * Tasks source — a single task (`taskId` hint), a project's tasks (`projectId`
 * hint), or the tasks assigned to the user. Reads through the tasks service.
 */

import { tasksService } from "@/services";
import type { TaskRow } from "@/services/tasks";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, hintString } from "./source-utils";

// Reads the durable task row. Rich fields (ref, due date, soft-delete stamp) are
// overlay-only in features/tasks/store.ts and not reachable from the service.
function summarize(t: TaskRow): ContextEntity {
  return {
    type: "task",
    id: t.id,
    summary: `${t.title} — ${t.status}/${t.priority}`,
  };
}

export const tasksSource: ContextSource = {
  key: "tasks",
  label: "Tasks",

  async gather({ userId, hints }) {
    const taskId = hintString(hints, "taskId");
    if (taskId) {
      const task = await tasksService.getById(taskId);
      if (!task) {
        return emptyFragment("tasks", this.label, `Task ${taskId} not found or not visible.`);
      }
      return fragment("tasks", this.label, [summarize(task)]);
    }

    const projectId = hintString(hints, "projectId");
    const list = projectId
      ? await tasksService.listByProject(projectId, {
          limit: 8,
          orderBy: "updated_at",
          direction: "desc",
        })
      : await tasksService.listByAssignee(userId, {
          limit: 8,
          orderBy: "updated_at",
          direction: "desc",
        });

    if (list.length === 0) {
      return emptyFragment(
        "tasks",
        this.label,
        projectId ? "No tasks in this project." : "No tasks assigned to this user.",
      );
    }
    const { items, truncated } = clampList(list, 8);
    return fragment("tasks", this.label, items.map(summarize), { truncated });
  },
};
