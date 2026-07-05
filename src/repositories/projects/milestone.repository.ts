import type { ListParams } from "@/services/core";
import {
  MilestonesService,
  milestonesService,
  ProjectActivityService,
  projectActivityService,
  type MilestoneInsert,
  type MilestoneRow,
  type MilestoneStatus,
  type MilestoneUpdate,
} from "@/services/projects";

/**
 * MilestoneRepository — project milestones over `milestones`. Records milestone
 * creation and completion in the project activity feed.
 */
export class MilestoneRepository {
  constructor(
    private readonly service: MilestonesService = milestonesService,
    private readonly activity: ProjectActivityService = projectActivityService,
  ) {}

  listForProject(
    projectId: string,
    params: ListParams<MilestoneRow> = {},
  ): Promise<MilestoneRow[]> {
    return this.service.listByProject(projectId, params);
  }

  getById(id: string): Promise<MilestoneRow | null> {
    return this.service.getById(id);
  }

  async create(input: MilestoneInsert): Promise<MilestoneRow> {
    const milestone = await this.service.create(input);
    await this.activity.log({
      project_id: milestone.project_id,
      type: "milestone_created",
      summary: `Milestone “${milestone.name}” created`,
      meta: { milestone_id: milestone.id },
    });
    return milestone;
  }

  update(id: string, patch: MilestoneUpdate): Promise<MilestoneRow> {
    return this.service.update(id, patch);
  }

  async setStatus(id: string, status: MilestoneStatus): Promise<MilestoneRow> {
    const milestone = await this.service.setStatus(id, status);
    if (status === "done") {
      await this.activity.log({
        project_id: milestone.project_id,
        type: "milestone_reached",
        summary: `Milestone “${milestone.name}” reached`,
        meta: { milestone_id: id },
      });
    }
    return milestone;
  }

  setProgress(id: string, progress: number): Promise<MilestoneRow> {
    return this.service.setProgress(id, progress);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const milestoneRepository = new MilestoneRepository();
