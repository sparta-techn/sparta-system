import type { TaskStatus } from "@/features/tasks/types";

export const DEFAULT_KANBAN_COLUMNS: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "qa",
  "done",
];

export interface KanbanSettings {
  /** Visible columns in display order. */
  columns: TaskStatus[];
  /** UI-only WIP limit per column. 0 = unlimited. */
  wipLimits: Partial<Record<TaskStatus, number>>;
}

export interface KanbanFilters {
  search?: string;
  projectIds?: string[];
  assigneeIds?: string[];
  priorities?: import("@/features/tasks/types").TaskPriority[];
  epicIds?: string[];
}
