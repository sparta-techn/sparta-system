/**
 * GoogleDocsRecentActivityService — Docs's {@link RecentActivityPort} impl.
 *
 * Wraps the one client seam and maps Docs's action taxonomy onto the neutral
 * `ActivityItem` shape. Pure mapper, no network of its own.
 */

import type {
  ActivityAction,
  ActivityItem,
  ActivityPage,
  ActivityPageParams,
  RecentActivityPort,
} from "../ports";
import { GoogleDocsClient } from "./google-docs-client";
import type { DocsActionType, DocsActivityEvent } from "./types";

export class GoogleDocsRecentActivityService implements RecentActivityPort {
  constructor(private readonly client: GoogleDocsClient) {}

  async listRecentActivity(
    accountId: string,
    params?: ActivityPageParams,
  ): Promise<ActivityPage<ActivityItem>> {
    const page = await this.client.listActivity(accountId, {
      pageToken: params?.cursor,
      pageSize: params?.perPage,
      since: params?.since,
    });
    return { items: page.items.map(toActivityItem), nextCursor: page.pageToken };
  }
}

/** Docs action → neutral action. `suggest` is normalised to `edited`. */
function toAction(action: DocsActionType): ActivityAction {
  switch (action) {
    case "create":
      return "created";
    case "comment":
      return "commented";
    case "rename":
      return "renamed";
    case "suggest":
    case "edit":
    default:
      return "edited";
  }
}

/** Pure map: Docs activity event → neutral activity item. */
export function toActivityItem(event: DocsActivityEvent): ActivityItem {
  return {
    id: event.id,
    action: toAction(event.action),
    actor: {
      id: event.actor.id,
      displayName: event.actor.displayName,
      email: event.actor.emailAddress,
      avatarUrl: event.actor.photoLink,
    },
    resource: {
      id: event.documentId,
      type: "document",
      name: event.documentTitle,
      url: `https://docs.google.com/document/d/${event.documentId}/edit`,
    },
    occurredAt: event.timestamp,
    summary: event.action === "suggest" ? "Suggested an edit" : undefined,
  };
}
