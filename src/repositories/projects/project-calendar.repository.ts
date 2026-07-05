import type { ListParams } from "@/services/core";
import {
  ProjectActivityService,
  projectActivityService,
  ProjectCalendarService,
  projectCalendarService,
  type ProjectCalendarEventInsert,
  type ProjectCalendarEventRow,
  type ProjectCalendarEventUpdate,
} from "@/services/projects";

/**
 * ProjectCalendarRepository — project calendar events over
 * `project_calendar_events`. Logs event creation in the activity feed.
 */
export class ProjectCalendarRepository {
  constructor(
    private readonly service: ProjectCalendarService = projectCalendarService,
    private readonly activity: ProjectActivityService = projectActivityService,
  ) {}

  listForProject(
    projectId: string,
    params: ListParams<ProjectCalendarEventRow> = {},
  ): Promise<ProjectCalendarEventRow[]> {
    return this.service.listByProject(projectId, params);
  }

  /** Events that start within `[from, to)` (ISO timestamps). */
  listInRange(projectId: string, from: string, to: string): Promise<ProjectCalendarEventRow[]> {
    return this.service.listInRange(projectId, from, to);
  }

  listForMilestone(milestoneId: string): Promise<ProjectCalendarEventRow[]> {
    return this.service.listByMilestone(milestoneId);
  }

  getById(id: string): Promise<ProjectCalendarEventRow | null> {
    return this.service.getById(id);
  }

  async create(input: ProjectCalendarEventInsert): Promise<ProjectCalendarEventRow> {
    const event = await this.service.create(input);
    await this.activity.log({
      project_id: event.project_id,
      type: "event_created",
      summary: `Calendar event “${event.title}” added`,
      meta: { event_id: event.id, starts_at: event.starts_at },
    });
    return event;
  }

  update(id: string, patch: ProjectCalendarEventUpdate): Promise<ProjectCalendarEventRow> {
    return this.service.update(id, patch);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const projectCalendarRepository = new ProjectCalendarRepository();
