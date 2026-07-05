/**
 * GoogleDriveRecentActivityService — Drive's {@link RecentActivityPort} impl.
 *
 * Wraps the one client seam and maps Drive's action taxonomy + MIME types onto
 * the neutral `ActivityItem` shape. Pure mapper, no network of its own.
 */

import type {
  ActivityAction,
  ActivityItem,
  ActivityPage,
  ActivityPageParams,
  RecentActivityPort,
} from "../ports";
import { GoogleDriveClient } from "./google-drive-client";
import type { DriveActionType, DriveActivityEvent } from "./types";

export class GoogleDriveRecentActivityService implements RecentActivityPort {
  constructor(private readonly client: GoogleDriveClient) {}

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

/** Drive action → neutral action. Unknown kinds fold to `edited`. */
function toAction(action: DriveActionType): ActivityAction {
  switch (action) {
    case "create":
      return "created";
    case "comment":
      return "commented";
    case "rename":
      return "renamed";
    case "move":
      return "moved";
    case "delete":
      return "deleted";
    case "restore":
      return "restored";
    case "permissionChange":
      return "shared";
    case "edit":
    default:
      return "edited";
  }
}

/** Map a Google MIME type onto a neutral resource type tag. */
function toResourceType(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "folder";
  if (mimeType === "application/vnd.google-apps.document") return "document";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "spreadsheet";
  if (mimeType === "application/vnd.google-apps.presentation") return "presentation";
  return "file";
}

/** Pure map: Drive activity event → neutral activity item. */
export function toActivityItem(event: DriveActivityEvent): ActivityItem {
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
      id: event.target.id,
      type: toResourceType(event.target.mimeType),
      name: event.target.name,
      url: event.target.webViewLink,
    },
    occurredAt: event.timestamp,
  };
}
