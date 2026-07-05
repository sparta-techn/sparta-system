import type { ListParams } from "@/services/core";
import {
  ProjectActivityService,
  projectActivityService,
  type ProjectActivityInsert,
  type ProjectActivityRow,
} from "@/services/projects";

/**
 * ProjectActivityRepository — read + append the project activity feed
 * (`project_activity`, append-only). Other repositories log through the same
 * service; this one is the direct read/append surface.
 */
export class ProjectActivityRepository {
  constructor(private readonly service: ProjectActivityService = projectActivityService) {}

  listForProject(
    projectId: string,
    params: ListParams<ProjectActivityRow> = {},
  ): Promise<ProjectActivityRow[]> {
    return this.service.listByProject(projectId, params);
  }

  /** Append a custom activity event. */
  log(event: ProjectActivityInsert): Promise<ProjectActivityRow> {
    return this.service.log(event);
  }
}

/** Shared singleton — import this, not the class. */
export const projectActivityRepository = new ProjectActivityRepository();
