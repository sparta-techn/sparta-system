import type { Client, Milestone, Project, ProjectStatus } from "@/features/projects/types";
import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";

export type ProjectInsert = Omit<
  Project,
  | "id"
  | "createdAt"
  | "progress"
  | "openTasks"
  | "completedTasks"
  | "overdueTasks"
  | "totalTasks"
  | "openDependencies"
>;
export type ProjectUpdate = Partial<ProjectInsert> & { archivedAt?: string };

/**
 * ProjectsService — CRUD for projects plus closely-related reads (members,
 * milestones, clients). Maps onto the future `projects`, `project_members`,
 * `milestones` and `clients` tables; the generic CRUD surface is inherited.
 */
export class ProjectsService extends BaseService<Project, ProjectInsert, ProjectUpdate> {
  protected readonly table = "projects";
  protected readonly entity = "Project";

  /** Projects filtered by lifecycle status. */
  listByStatus(status: ProjectStatus, params: ListParams<Project> = {}): Promise<Project[]> {
    return this.list({ ...params, filters: { ...params.filters, status } });
  }

  /** Projects a given manager owns. */
  listByManager(managerId: string, params: ListParams<Project> = {}): Promise<Project[]> {
    return this.list({ ...params, filters: { ...params.filters, managerId } });
  }

  /** Toggle the per-user favorite flag. */
  setFavorite(id: string, favorite: boolean): Promise<Project> {
    return this.update(id, { favorite } as ProjectUpdate);
  }

  /** Archive a project (soft state transition). */
  archive(id: string): Promise<Project> {
    return this.update(id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    } as ProjectUpdate);
  }

  /** Milestones belonging to a project. */
  listMilestones(projectId: string): Promise<Milestone[]> {
    return this.listRelated<Milestone>("milestones", { project_id: projectId });
  }

  /** Clients (read side of the `clients` table). */
  listClients(): Promise<Client[]> {
    return this.listRelated<Client>("clients");
  }

  /** Small helper for reading a sibling table without a dedicated service. */
  private async listRelated<T>(table: string, filters: Record<string, unknown> = {}): Promise<T[]> {
    let query = this.client.from(table).select("*");
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value as never);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as T[];
  }
}

/** Shared singleton — import this, not the class. */
export const projectsService = new ProjectsService();
