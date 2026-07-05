import type { ListParams } from "@/services/core";
import {
  ActivityFeedService,
  activityFeedService,
  type ActivityFeedInsert,
  type ActivityFeedRow,
  type ActivitySource,
} from "@/services/activity";

/**
 * ActivityFeedRepository — read + append the unified activity stream
 * (`activity_feed`, append-only). Delegates to {@link ActivityFeedService};
 * RLS scopes reads to project members, the actor, or elevated roles.
 */
export class ActivityFeedRepository {
  constructor(private readonly service: ActivityFeedService = activityFeedService) {}

  /** A project's activity, newest first. */
  forProject(
    projectId: string,
    params: ListParams<ActivityFeedRow> = {},
  ): Promise<ActivityFeedRow[]> {
    return this.service.listForProject(projectId, params);
  }

  /** Activity performed by a given actor. */
  forActor(actorId: string, params: ListParams<ActivityFeedRow> = {}): Promise<ActivityFeedRow[]> {
    return this.service.listForActor(actorId, params);
  }

  /** Activity attached to a specific source row (task / dependency / …). */
  forSource(sourceType: ActivitySource, sourceId: string): Promise<ActivityFeedRow[]> {
    return this.service.listForSource(sourceType, sourceId);
  }

  /** The most recent activity visible to the caller. */
  recent(limit = 50): Promise<ActivityFeedRow[]> {
    return this.service.listRecent(limit);
  }

  /** Append an activity event. */
  log(event: ActivityFeedInsert): Promise<ActivityFeedRow> {
    return this.service.log(event);
  }
}

/** Shared singleton — import this, not the class. */
export const activityFeedRepository = new ActivityFeedRepository();
