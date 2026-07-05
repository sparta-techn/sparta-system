/**
 * Sprints — time-boxed iteration grouping over existing Tasks.
 *
 * Sprint does NOT own tasks. Tasks reference a sprint via `Task.sprintId`.
 * This module only manages the Sprint entity and provides UI for grouping,
 * planning, and progress visualisation.
 */

export const SPRINT_STATUSES = ["planned", "active", "completed"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: SprintStatus;
  goal: string;
  /** UI-only capacity (story points). */
  capacity: number;
  createdAt: string;
}

export interface SprintFilters {
  search?: string;
  projectIds?: string[];
  statuses?: SprintStatus[];
  from?: string;
  to?: string;
}
