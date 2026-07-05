import type { Sprint, SprintStatus } from "@/features/sprints/types";
import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";

export type SprintInsert = Omit<Sprint, "id" | "createdAt">;
export type SprintUpdate = Partial<SprintInsert>;

/**
 * SprintsService — CRUD for time-boxed iterations.
 *
 * A sprint does not own tasks; tasks reference it via `Task.sprintId`. Maps onto
 * the future `sprints` table. Generic CRUD is inherited; the methods below
 * express the sprint-specific access patterns.
 */
export class SprintsService extends BaseService<Sprint, SprintInsert, SprintUpdate> {
  protected readonly table = "sprints";
  protected readonly entity = "Sprint";

  /** Sprints within a project. */
  listByProject(projectId: string, params: ListParams<Sprint> = {}): Promise<Sprint[]> {
    return this.list({ ...params, filters: { ...params.filters, projectId } });
  }

  /** Sprints filtered by lifecycle status. */
  listByStatus(status: SprintStatus, params: ListParams<Sprint> = {}): Promise<Sprint[]> {
    return this.list({ ...params, filters: { ...params.filters, status } });
  }

  /** Transition a sprint to a new status. */
  setStatus(id: string, status: SprintStatus): Promise<Sprint> {
    return this.update(id, { status } as SprintUpdate);
  }
}

/** Shared singleton — import this, not the class. */
export const sprintsService = new SprintsService();
