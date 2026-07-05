import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";
import type { ProjectRoleInsert, ProjectRoleRow, ProjectRoleUpdate } from "./types";

/**
 * ProjectRolesService — the seeded `project_roles` reference catalog
 * (Lead / Contributor / Reviewer / Stakeholder). Member rows reference these.
 */
export class ProjectRolesService extends BaseService<
  ProjectRoleRow,
  ProjectRoleInsert,
  ProjectRoleUpdate
> {
  protected readonly table = "project_roles";
  protected readonly entity = "Project role";
  protected readonly defaultOrderBy = "rank";

  /** Active roles, ordered by rank. */
  listActive(params: ListParams<ProjectRoleRow> = {}): Promise<ProjectRoleRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, is_active: true },
      direction: "asc",
    });
  }

  /** Resolve a role by its stable slug (e.g. `lead`). */
  async getBySlug(slug: string): Promise<ProjectRoleRow | null> {
    const [row] = await this.list({ filters: { slug }, limit: 1 });
    return row ?? null;
  }
}

/** Shared singleton — import this, not the class. */
export const projectRolesService = new ProjectRolesService();
