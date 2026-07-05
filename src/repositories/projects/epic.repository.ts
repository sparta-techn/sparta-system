import type { ListParams } from "@/services/core";
import {
  EpicsService,
  epicsService,
  ProjectActivityService,
  projectActivityService,
  type EpicInsert,
  type EpicRow,
  type EpicUpdate,
} from "@/services/projects";

/**
 * EpicRepository — project epics over `epics`. Tasks reference `epic_id` once
 * the tasks table lands; an epic is a grouping only.
 */
export class EpicRepository {
  constructor(
    private readonly service: EpicsService = epicsService,
    private readonly activity: ProjectActivityService = projectActivityService,
  ) {}

  listForProject(projectId: string, params: ListParams<EpicRow> = {}): Promise<EpicRow[]> {
    return this.service.listByProject(projectId, params);
  }

  getById(id: string): Promise<EpicRow | null> {
    return this.service.getById(id);
  }

  async create(input: EpicInsert): Promise<EpicRow> {
    const epic = await this.service.create(input);
    await this.activity.log({
      project_id: epic.project_id,
      type: "epic_created",
      summary: `Epic “${epic.name}” created`,
      meta: { epic_id: epic.id },
    });
    return epic;
  }

  update(id: string, patch: EpicUpdate): Promise<EpicRow> {
    return this.service.update(id, patch);
  }

  archive(id: string): Promise<EpicRow> {
    return this.service.archive(id);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const epicRepository = new EpicRepository();
