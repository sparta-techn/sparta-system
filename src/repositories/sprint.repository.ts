import type { Sprint, SprintStatus } from "@/features/sprints/types";
import type { ListParams } from "@/services/core";
import {
  SprintsService,
  sprintsService,
  type SprintInsert,
  type SprintUpdate,
} from "@/services/sprints";

/**
 * SprintRepository — domain operations for time-boxed iterations. Delegates
 * persistence to {@link SprintsService} and exposes the planning lifecycle
 * (activate / complete) in domain terms.
 */
export class SprintRepository {
  constructor(private readonly service: SprintsService = sprintsService) {}

  list(params: ListParams<Sprint> = {}): Promise<Sprint[]> {
    return this.service.list(params);
  }

  getById(id: string): Promise<Sprint | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Sprint> {
    return this.service.getByIdOrThrow(id);
  }

  listByProject(projectId: string, params: ListParams<Sprint> = {}): Promise<Sprint[]> {
    return this.service.listByProject(projectId, params);
  }

  listByStatus(status: SprintStatus, params: ListParams<Sprint> = {}): Promise<Sprint[]> {
    return this.service.listByStatus(status, params);
  }

  /** The active sprint for a project, if any. */
  async getActiveForProject(projectId: string): Promise<Sprint | null> {
    const [active] = await this.service.list({
      filters: { projectId, status: "active" },
      limit: 1,
    });
    return active ?? null;
  }

  create(input: SprintInsert): Promise<Sprint> {
    return this.service.create(input);
  }

  update(id: string, patch: SprintUpdate): Promise<Sprint> {
    return this.service.update(id, patch);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }

  /** Move a sprint to `active`. */
  activate(id: string): Promise<Sprint> {
    return this.service.setStatus(id, "active");
  }

  /** Move a sprint to `completed`. */
  complete(id: string): Promise<Sprint> {
    return this.service.setStatus(id, "completed");
  }
}

/** Shared singleton — import this, not the class. */
export const sprintRepository = new SprintRepository();
