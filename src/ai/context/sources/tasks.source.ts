/**
 * Tasks source — a single task (`taskId` hint), a project's tasks (`projectId`
 * hint), or the tasks assigned to the user. Reads through the tasks service.
 */

import { tasksService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, hintString } from "./source-utils";
import type { Task } from "@/features/tasks/types";

function summarize(t: Task): ContextEntity {
  const due = t.dueDate ? `; due ${t.dueDate}` : "";
  return {
    type: "task",
    id: t.id,
    ref: t.ref,
    summary: `${t.title} — ${t.status}/${t.priority}${due}`,
  };
}

/** Hide soft-deleted rows defensively (RLS may still return them to owners). */
function visible(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.deletedAt);
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
    const rows = projectId
      ? await tasksService.listByProject(projectId, {
          limit: 8,
          orderBy: "updatedAt",
          direction: "desc",
        })
      : await tasksService.listByAssignee(userId, {
          limit: 8,
          orderBy: "updatedAt",
          direction: "desc",
        });

    const list = visible(rows);
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
