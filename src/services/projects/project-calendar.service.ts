import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type {
  ProjectCalendarEventInsert,
  ProjectCalendarEventRow,
  ProjectCalendarEventUpdate,
} from "./types";

/**
 * ProjectCalendarService — project-scoped calendar events
 * (`project_calendar_events`); events may link to a milestone.
 */
export class ProjectCalendarService extends BaseService<
  ProjectCalendarEventRow,
  ProjectCalendarEventInsert,
  ProjectCalendarEventUpdate
> {
  protected readonly table = "project_calendar_events";
  protected readonly entity = "Calendar event";
  protected readonly defaultOrderBy = "starts_at";

  /** Events for a project, chronological. */
  listByProject(
    projectId: string,
    params: ListParams<ProjectCalendarEventRow> = {},
  ): Promise<ProjectCalendarEventRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, project_id: projectId },
      direction: params.direction ?? "asc",
    });
  }

  /** Events for a project that start within `[from, to)` (ISO timestamps). */
  async listInRange(
    projectId: string,
    from: string,
    to: string,
  ): Promise<ProjectCalendarEventRow[]> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("project_id", projectId)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectCalendarEventRow[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** Events attached to a milestone. */
  listByMilestone(milestoneId: string): Promise<ProjectCalendarEventRow[]> {
    return this.list({ filters: { milestone_id: milestoneId }, direction: "asc" });
  }
}

/** Shared singleton — import this, not the class. */
export const projectCalendarService = new ProjectCalendarService();
