/**
 * Live "planned tasks" for the daily-report wizards.
 *
 * Replaces the former `MOCK_PLANNED_TASKS` sample list: these hooks read the
 * real tasks store (Supabase-backed via `taskRepository`) and expose the
 * current user's open work, plus a resolver for a saved id selection, mapped
 * onto the wizard's `PlannedTask` shape.
 */
import { useMemo } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { getProject } from "@/features/projects/store";
import { useTasksState } from "@/features/tasks/store";
import { PRIORITY_WEIGHT, type Task } from "@/features/tasks/types";
import { formatDate } from "@/features/tasks/utils";

import type { PlannedTask, PriorityLevel } from "./types";

/** Task priority → check-in priority (tasks use `critical`; wizards use `urgent`). */
const PRIORITY_MAP: Record<Task["priority"], PriorityLevel> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "urgent",
};

/** Map a live task row onto the wizard's lighter `PlannedTask` shape. */
export function mapTaskToPlanned(task: Task): PlannedTask {
  const project = getProject(task.projectId);
  return {
    id: task.id,
    title: task.title,
    project: project?.name ?? task.ref,
    source: "manual",
    priority: PRIORITY_MAP[task.priority],
    deadline: task.dueDate ? formatDate(task.dueDate) : undefined,
  };
}

function isActive(task: Task, userId: string | null): boolean {
  return (
    task.assigneeId === userId &&
    !task.deletedAt &&
    !task.archivedAt &&
    task.status !== "done" &&
    task.status !== "cancelled"
  );
}

/** The current user's open, assigned tasks — the live planned-task list. */
export function usePlannedTasks(): PlannedTask[] {
  const userId = useAuth().user?.id ?? null;
  const tasks = useTasksState((s) => s.tasks);
  return useMemo(
    () =>
      tasks
        .filter((t) => isActive(t, userId))
        .sort((a, b) => {
          const p = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          if (p !== 0) return p;
          const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
          const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
          return ad - bd;
        })
        .map(mapTaskToPlanned),
    [tasks, userId],
  );
}

/**
 * Resolve a saved selection of task ids (e.g. the morning check-in) against the
 * live store, preserving order and dropping ids that no longer exist. Unlike
 * {@link usePlannedTasks} this keeps done/archived tasks so progress can still
 * be reported on work that finished during the day.
 */
export function usePlannedTasksByIds(ids: string[]): PlannedTask[] {
  const tasks = useTasksState((s) => s.tasks);
  const key = ids.join(",");
  return useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return ids
      .map((id) => byId.get(id))
      .filter((t): t is Task => !!t)
      .map(mapTaskToPlanned);
    // `key` captures the id-list contents for memoization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, key]);
}
