import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";
import type { EpicInsert, EpicRow, EpicUpdate } from "./types";

/**
 * EpicsService — project-scoped grouping (`epics`). Tasks will reference
 * `epic_id` once the tasks table lands; an epic never owns tasks.
 */
export class EpicsService extends BaseService<EpicRow, EpicInsert, EpicUpdate> {
  protected readonly table = "epics";
  protected readonly entity = "Epic";
  protected readonly defaultOrderBy = "created_at";

  /** Epics of a project. */
  listByProject(projectId: string, params: ListParams<EpicRow> = {}): Promise<EpicRow[]> {
    return this.list({ ...params, filters: { ...params.filters, project_id: projectId } });
  }

  /** Archive an epic (soft state transition). */
  archive(id: string): Promise<EpicRow> {
    return this.update(id, { archived_at: new Date().toISOString() });
  }
}

/** Shared singleton — import this, not the class. */
export const epicsService = new EpicsService();
