/**
 * Projects source — a specific project (via `projectId` hint) or the projects the
 * user manages. Reads through the projects service.
 */

import { projectsService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, hintString } from "./source-utils";
import type { Project } from "@/features/projects/types";

function summarize(p: Project): ContextEntity {
  const bits = [
    `status: ${p.status}`,
    `health: ${p.health}`,
    `progress: ${p.progress}%`,
    `open tasks: ${p.openTasks}`,
    p.overdueTasks > 0 ? `overdue: ${p.overdueTasks}` : null,
    p.openDependencies > 0 ? `open deps: ${p.openDependencies}` : null,
  ]
    .filter(Boolean)
    .join("; ");
  return { type: "project", id: p.id, ref: p.key, summary: `${p.name} — ${bits}` };
}

export const projectsSource: ContextSource = {
  key: "projects",
  label: "Projects",

  async gather({ userId, hints }) {
    const projectId = hintString(hints, "projectId");

    if (projectId) {
      const project = await projectsService.getById(projectId);
      if (!project) {
        return emptyFragment(
          "projects",
          this.label,
          `Project ${projectId} not found or not visible.`,
        );
      }
      return fragment("projects", this.label, [summarize(project)]);
    }

    const managed = await projectsService.listByManager(userId, {
      limit: 5,
      orderBy: "createdAt",
      direction: "desc",
    });
    if (managed.length === 0) {
      return emptyFragment("projects", this.label, "No projects managed by this user.");
    }
    const { items, truncated } = clampList(managed);
    return fragment("projects", this.label, items.map(summarize), { truncated });
  },
};
