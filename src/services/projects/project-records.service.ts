import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";
import type {
  ProjectHealth,
  ProjectInsert,
  ProjectRow,
  ProjectStatus,
  ProjectUpdate,
} from "./types";

/**
 * ProjectRecordsService — CRUD for the `projects` root entity
 * (migration 20260630150000, snake-case schema).
 *
 * Distinct from the legacy mock-typed {@link ProjectsService}
 * (`projects.service.ts`); this one matches the live table.
 */
export class ProjectRecordsService extends BaseService<ProjectRow, ProjectInsert, ProjectUpdate> {
  protected readonly table = "projects";
  protected readonly entity = "Project";
  protected readonly defaultOrderBy = "created_at";

  /** Projects filtered by lifecycle status. */
  listByStatus(status: ProjectStatus, params: ListParams<ProjectRow> = {}): Promise<ProjectRow[]> {
    return this.list({ ...params, filters: { ...params.filters, status } });
  }

  /** Projects a given manager owns. */
  listByManager(managerId: string, params: ListParams<ProjectRow> = {}): Promise<ProjectRow[]> {
    return this.list({ ...params, filters: { ...params.filters, manager_id: managerId } });
  }

  /** Move a project to a new lifecycle status. */
  setStatus(id: string, status: ProjectStatus): Promise<ProjectRow> {
    return this.update(id, { status });
  }

  /** Update the derived/at-a-glance health signal. */
  setHealth(id: string, health: ProjectHealth): Promise<ProjectRow> {
    return this.update(id, { health });
  }

  /** Archive a project (soft state transition). */
  archive(id: string): Promise<ProjectRow> {
    return this.update(id, { status: "archived", archived_at: new Date().toISOString() });
  }
}

/** Shared singleton — import this, not the class. */
export const projectRecordsService = new ProjectRecordsService();
