import { useMemo } from "react";

import { useTasksState } from "@/features/tasks/store";
import type { Project } from "./types";

/** Live task counts for a project, derived from the Supabase-backed tasks store. */
export interface ProjectTaskRollup {
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  /** Completion % = done / total (0 when the project has no tasks). */
  progress: number;
}

const EMPTY: ProjectTaskRollup = {
  totalTasks: 0,
  openTasks: 0,
  completedTasks: 0,
  overdueTasks: 0,
  progress: 0,
};

/**
 * Per-project task rollups computed from the live tasks store. Replaces the
 * hardcoded `0` counts in `projectRowToDomain` (the projects table has no task
 * columns), so the projects dashboard/cards/overview show real open/overdue/
 * completed counts and completion %.
 */
export function useProjectTaskRollups(): Map<string, ProjectTaskRollup> {
  const tasks = useTasksState((s) => s.tasks);
  return useMemo(() => {
    const now = Date.now();
    const map = new Map<string, ProjectTaskRollup>();
    for (const t of tasks) {
      if (t.deletedAt || t.archivedAt) continue;
      const r = map.get(t.projectId) ?? { ...EMPTY };
      r.totalTasks += 1;
      const closed = t.status === "done" || t.status === "cancelled";
      if (t.status === "done") r.completedTasks += 1;
      if (!closed) {
        r.openTasks += 1;
        if (t.dueDate && new Date(t.dueDate).getTime() < now) r.overdueTasks += 1;
      }
      map.set(t.projectId, r);
    }
    for (const r of map.values()) {
      r.progress = r.totalTasks ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0;
    }
    return map;
  }, [tasks]);
}

/** Overlay a project's live task rollup onto its (zeroed) stored counts. */
export function mergeRollup(project: Project, rollups: Map<string, ProjectTaskRollup>): Project {
  const r = rollups.get(project.id) ?? EMPTY;
  return {
    ...project,
    totalTasks: r.totalTasks,
    openTasks: r.openTasks,
    completedTasks: r.completedTasks,
    overdueTasks: r.overdueTasks,
    progress: r.progress,
  };
}
