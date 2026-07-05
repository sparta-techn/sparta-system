/**
 * FigmaRecentActivityService — Figma's implementation of {@link RecentActivityPort}.
 *
 * The service wraps the one client seam (no network code of its own, per
 * CLAUDE.md) and translates Figma's event taxonomy into the neutral `ActivityItem`
 * shape the SpartaFlow activity feed consumes. The mapper is a pure, testable
 * function that runs the moment the client returns real data.
 */

import type {
  ActivityAction,
  ActivityItem,
  ActivityPage,
  ActivityPageParams,
  RecentActivityPort,
} from "../ports";
import { FigmaClient } from "./figma-client";
import type { FigmaActivityEvent, FigmaEventType } from "./types";

export class FigmaRecentActivityService implements RecentActivityPort {
  constructor(private readonly client: FigmaClient) {}

  async listRecentActivity(
    accountId: string,
    params?: ActivityPageParams,
  ): Promise<ActivityPage<ActivityItem>> {
    const page = await this.client.listActivity(accountId, {
      cursor: params?.cursor,
      pageSize: params?.perPage,
      since: params?.since,
    });
    return { items: page.items.map(toActivityItem), nextCursor: page.cursor };
  }
}

/** Figma event verb → neutral action. Unknown kinds fold to `edited`. */
function toAction(eventType: FigmaEventType): ActivityAction {
  switch (eventType) {
    case "FILE_COMMENT":
      return "commented";
    case "FILE_DELETE":
      return "deleted";
    case "LIBRARY_PUBLISH":
      return "shared";
    case "FILE_UPDATE":
    case "FILE_VERSION_UPDATE":
    default:
      return "edited";
  }
}

/** Pure map: Figma activity event → neutral activity item. */
export function toActivityItem(event: FigmaActivityEvent): ActivityItem {
  return {
    id: event.id,
    action: toAction(event.eventType),
    actor: {
      id: event.triggeredBy.id,
      displayName: event.triggeredBy.handle,
      email: event.triggeredBy.email,
      avatarUrl: event.triggeredBy.imgUrl,
    },
    resource: {
      id: event.file.key,
      type: "design",
      name: event.file.name,
      url: `https://www.figma.com/file/${event.file.key}`,
    },
    occurredAt: event.timestamp,
    summary: event.commentText,
  };
}
