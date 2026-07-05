import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { ProjectMemberInsert, ProjectMemberRow, ProjectMemberUpdate } from "./types";

/**
 * ProjectMembersService — project ↔ profile membership (`project_members`).
 * One row per `(project_id, user_id)`.
 */
export class ProjectMembersService extends BaseService<
  ProjectMemberRow,
  ProjectMemberInsert,
  ProjectMemberUpdate
> {
  protected readonly table = "project_members";
  protected readonly entity = "Project member";

  /** Members of a project. */
  listByProject(
    projectId: string,
    params: ListParams<ProjectMemberRow> = {},
  ): Promise<ProjectMemberRow[]> {
    return this.list({ ...params, filters: { ...params.filters, project_id: projectId } });
  }

  /** Projects a user is a member of. */
  listByUser(
    userId: string,
    params: ListParams<ProjectMemberRow> = {},
  ): Promise<ProjectMemberRow[]> {
    return this.list({ ...params, filters: { ...params.filters, user_id: userId } });
  }

  /** A single membership row for `(project, user)`, or `null`. */
  async getMembership(projectId: string, userId: string): Promise<ProjectMemberRow | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ProjectMemberRow | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Change a member's project role. */
  setRole(id: string, projectRoleId: string | null): Promise<ProjectMemberRow> {
    return this.update(id, { project_role_id: projectRoleId });
  }
}

/** Shared singleton — import this, not the class. */
export const projectMembersService = new ProjectMembersService();
