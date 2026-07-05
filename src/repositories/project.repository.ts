import type { Client, Milestone, Project, ProjectStatus } from "@/features/projects/types";
import type { ListParams } from "@/services/core";
import {
  ProjectsService,
  projectsService,
  type ProjectInsert,
  type ProjectUpdate,
} from "@/services/projects";

/** A project together with its milestones — a common detail-view aggregate. */
export interface ProjectWithMilestones {
  project: Project;
  milestones: Milestone[];
}

/**
 * ProjectRepository — domain operations for projects. Delegates persistence to
 * {@link ProjectsService} and adds aggregate reads (project + milestones).
 */
export class ProjectRepository {
  constructor(private readonly service: ProjectsService = projectsService) {}

  list(params: ListParams<Project> = {}): Promise<Project[]> {
    return this.service.list(params);
  }

  getById(id: string): Promise<Project | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Project> {
    return this.service.getByIdOrThrow(id);
  }

  listByStatus(status: ProjectStatus, params: ListParams<Project> = {}): Promise<Project[]> {
    return this.service.listByStatus(status, params);
  }

  listByManager(managerId: string, params: ListParams<Project> = {}): Promise<Project[]> {
    return this.service.listByManager(managerId, params);
  }

  create(input: ProjectInsert): Promise<Project> {
    return this.service.create(input);
  }

  update(id: string, patch: ProjectUpdate): Promise<Project> {
    return this.service.update(id, patch);
  }

  archive(id: string): Promise<Project> {
    return this.service.archive(id);
  }

  setFavorite(id: string, favorite: boolean): Promise<Project> {
    return this.service.setFavorite(id, favorite);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }

  listMilestones(projectId: string): Promise<Milestone[]> {
    return this.service.listMilestones(projectId);
  }

  listClients(): Promise<Client[]> {
    return this.service.listClients();
  }

  /** Fetch a project and its milestones together. */
  async getWithMilestones(id: string): Promise<ProjectWithMilestones | null> {
    const project = await this.service.getById(id);
    if (!project) return null;
    const milestones = await this.service.listMilestones(id);
    return { project, milestones };
  }
}

/** Shared singleton — import this, not the class. */
export const projectRepository = new ProjectRepository();
