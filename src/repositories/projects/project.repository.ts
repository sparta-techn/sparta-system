import type { Task } from "@/features/tasks/types";
import type { ListParams } from "@/services/core";
import {
  ProjectActivityService,
  projectActivityService,
  ProjectRecordsService,
  projectRecordsService,
  type ProjectHealth,
  type ProjectRecordInsert,
  type ProjectRecordUpdate,
  type ProjectRow,
  type ProjectStatus,
} from "@/services/projects";
import { TasksService, tasksService } from "@/services/tasks";

/**
 * ProjectRepository — domain operations for the `projects` root entity.
 * Composes {@link ProjectRecordsService} with the append-only
 * {@link ProjectActivityService} (lifecycle events feed the project activity
 * stream) and **reuses the existing {@link TasksService}** for project tasks.
 *
 * NOTE: distinct from the legacy `ProjectRepository`
 * (`src/repositories/project.repository.ts`, mock-typed). Import this one from
 * `@/repositories/projects`.
 */
export class ProjectRepository {
  constructor(
    private readonly projects: ProjectRecordsService = projectRecordsService,
    private readonly activity: ProjectActivityService = projectActivityService,
    private readonly tasks: TasksService = tasksService,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────
  list(params: ListParams<ProjectRow> = {}): Promise<ProjectRow[]> {
    return this.projects.list(params);
  }
  getById(id: string): Promise<ProjectRow | null> {
    return this.projects.getById(id);
  }
  getByIdOrThrow(id: string): Promise<ProjectRow> {
    return this.projects.getByIdOrThrow(id);
  }
  listByStatus(status: ProjectStatus, params: ListParams<ProjectRow> = {}): Promise<ProjectRow[]> {
    return this.projects.listByStatus(status, params);
  }
  listByManager(managerId: string, params: ListParams<ProjectRow> = {}): Promise<ProjectRow[]> {
    return this.projects.listByManager(managerId, params);
  }

  /** Tasks within a project — delegated to the existing tasks service. */
  listTasks(projectId: string, params: ListParams<Task> = {}): Promise<Task[]> {
    return this.tasks.listByProject(projectId, params);
  }

  // ── Writes ───────────────────────────────────────────────────────────────
  async create(input: ProjectRecordInsert): Promise<ProjectRow> {
    const project = await this.projects.create(input);
    await this.activity.log({
      project_id: project.id,
      type: "project_created",
      summary: `Created project ${project.name}`,
    });
    return project;
  }

  update(id: string, patch: ProjectRecordUpdate): Promise<ProjectRow> {
    return this.projects.update(id, patch);
  }

  async setStatus(id: string, status: ProjectStatus): Promise<ProjectRow> {
    const project = await this.projects.setStatus(id, status);
    await this.activity.log({
      project_id: id,
      type: "status_changed",
      summary: `Status changed to ${status}`,
      meta: { status },
    });
    return project;
  }

  async setHealth(id: string, health: ProjectHealth): Promise<ProjectRow> {
    const project = await this.projects.setHealth(id, health);
    await this.activity.log({
      project_id: id,
      type: "health_changed",
      summary: `Health changed to ${health}`,
      meta: { health },
    });
    return project;
  }

  archive(id: string): Promise<ProjectRow> {
    return this.projects.archive(id);
  }

  remove(id: string): Promise<void> {
    return this.projects.remove(id);
  }

  /** A project together with its activity feed — a common detail-view aggregate. */
  async getWithActivity(id: string) {
    const project = await this.projects.getById(id);
    if (!project) return null;
    const activity = await this.activity.listByProject(id);
    return { project, activity };
  }
}

/** Shared singleton — import this, not the class. */
export const projectRepository = new ProjectRepository();
