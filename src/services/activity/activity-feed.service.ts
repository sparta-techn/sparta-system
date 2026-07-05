import { BaseService } from "../core/base-service";
import { ServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { ActivityFeedInsert, ActivityFeedRow, ActivitySource } from "./types";

/**
 * ActivityFeedService — the unified, **append-only** activity stream
 * (`activity_feed`, migration 20260701120000). Rows are immutable (the table
 * grants only SELECT / INSERT), so update / upsert / remove are blocked here.
 * RLS scopes reads to project members, the actor, or elevated roles.
 */
export class ActivityFeedService extends BaseService<ActivityFeedRow, ActivityFeedInsert> {
  protected readonly table = "activity_feed";
  protected readonly entity = "Activity";
  protected readonly defaultOrderBy = "created_at";

  /** Append an activity event. `actor_id` defaults to `auth.uid()` server-side. */
  log(event: ActivityFeedInsert): Promise<ActivityFeedRow> {
    return this.create(event);
  }

  /** A project's activity, newest first. */
  listForProject(
    projectId: string,
    params: ListParams<ActivityFeedRow> = {},
  ): Promise<ActivityFeedRow[]> {
    return this.list({ ...params, filters: { ...params.filters, project_id: projectId } });
  }

  /** Activity performed by a given actor. */
  listForActor(
    actorId: string,
    params: ListParams<ActivityFeedRow> = {},
  ): Promise<ActivityFeedRow[]> {
    return this.list({ ...params, filters: { ...params.filters, actor_id: actorId } });
  }

  /** Activity attached to a specific source row (task / dependency / …). */
  listForSource(
    sourceType: ActivitySource,
    sourceId: string,
    params: ListParams<ActivityFeedRow> = {},
  ): Promise<ActivityFeedRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, source_type: sourceType, source_id: sourceId },
    });
  }

  /** The most recent activity visible to the caller (RLS-scoped). */
  listRecent(limit = 50): Promise<ActivityFeedRow[]> {
    return this.list({ limit });
  }

  // ── Append-only guards ─────────────────────────────────────────────────────

  override update(): Promise<ActivityFeedRow> {
    return Promise.reject(new ServiceError("Activity feed is append-only", "append_only"));
  }
  override upsert(): Promise<ActivityFeedRow> {
    return Promise.reject(new ServiceError("Activity feed is append-only", "append_only"));
  }
  override remove(): Promise<void> {
    return Promise.reject(new ServiceError("Activity feed is append-only", "append_only"));
  }
}

/** Shared singleton — import this, not the class. */
export const activityFeedService = new ActivityFeedService();
