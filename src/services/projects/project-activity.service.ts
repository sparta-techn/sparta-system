import { BaseService } from "../core/base-service";
import { ServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { ProjectActivityInsert, ProjectActivityRow } from "./types";

/**
 * ProjectActivityService — append-only project feed (`project_activity`).
 * Rows are immutable: the table grants only SELECT / INSERT, so update / remove
 * are blocked here too.
 */
export class ProjectActivityService extends BaseService<ProjectActivityRow, ProjectActivityInsert> {
  protected readonly table = "project_activity";
  protected readonly entity = "Project activity";
  protected readonly defaultOrderBy = "created_at";

  /** Append an activity event. `actor_id` defaults to `auth.uid()` server-side. */
  log(event: ProjectActivityInsert): Promise<ProjectActivityRow> {
    return this.create(event);
  }

  /** A project's activity feed (most recent first). */
  listByProject(
    projectId: string,
    params: ListParams<ProjectActivityRow> = {},
  ): Promise<ProjectActivityRow[]> {
    return this.list({ ...params, filters: { ...params.filters, project_id: projectId } });
  }

  // ── Append-only guards ─────────────────────────────────────────────────────

  override update(): Promise<ProjectActivityRow> {
    return Promise.reject(new ServiceError("Project activity is append-only", "append_only"));
  }
  override upsert(): Promise<ProjectActivityRow> {
    return Promise.reject(new ServiceError("Project activity is append-only", "append_only"));
  }
  override remove(): Promise<void> {
    return Promise.reject(new ServiceError("Project activity is append-only", "append_only"));
  }
}

/** Shared singleton — import this, not the class. */
export const projectActivityService = new ProjectActivityService();
