import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";
import type { MilestoneInsert, MilestoneRow, MilestoneStatus, MilestoneUpdate } from "./types";

/**
 * MilestonesService — project-scoped delivery checkpoints (`milestones`).
 */
export class MilestonesService extends BaseService<MilestoneRow, MilestoneInsert, MilestoneUpdate> {
  protected readonly table = "milestones";
  protected readonly entity = "Milestone";
  protected readonly defaultOrderBy = "due_date";

  /** Milestones of a project, earliest due first. */
  listByProject(projectId: string, params: ListParams<MilestoneRow> = {}): Promise<MilestoneRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, project_id: projectId },
      direction: params.direction ?? "asc",
    });
  }

  /** Transition a milestone's status. */
  setStatus(id: string, status: MilestoneStatus): Promise<MilestoneRow> {
    return this.update(id, { status });
  }

  /** Update progress (0–100). */
  setProgress(id: string, progress: number): Promise<MilestoneRow> {
    return this.update(id, { progress: Math.max(0, Math.min(100, progress)) });
  }
}

/** Shared singleton — import this, not the class. */
export const milestonesService = new MilestonesService();
