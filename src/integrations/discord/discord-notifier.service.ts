/**
 * DiscordNotifierService — Discord's implementation of {@link NotifierPort}.
 *
 * Wraps the one client seam and renders a neutral {@link Notification} as a
 * Discord embed (+ link buttons for approval actions). Pure mapper, no network of
 * its own. Discord routes `channel`/`user` targets; other target types are
 * skipped.
 */

import {
  NOTIFICATION_KINDS,
  skipped,
  type DeliveryResult,
  type Notification,
  type NotificationKind,
  type NotificationPriority,
  type NotificationRequest,
  type NotifierPort,
} from "../ports";
import { DiscordClient } from "./discord-client";
import type { DiscordCreateMessageRequest, DiscordEmbed } from "./types";

/** Embed accent colors by priority (Discord uses integer RGB). */
const PRIORITY_COLOR: Record<NotificationPriority, number> = {
  low: 0x95a5a6,
  normal: 0x3498db,
  high: 0xe67e22,
  urgent: 0xe74c3c,
};

export class DiscordNotifierService implements NotifierPort {
  readonly supportedKinds = NOTIFICATION_KINDS;

  constructor(private readonly client: DiscordClient) {}

  supports(kind: NotificationKind): boolean {
    return this.supportedKinds.includes(kind);
  }

  async notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult> {
    const channelId = resolveChannel(request);
    if (channelId === null) {
      return skipped(request, "Discord routes only user or channel targets.");
    }

    const message = toDiscordMessage(channelId, request.notification);
    const response = await this.client.createMessage(accountId, message);
    return {
      state: "delivered",
      kind: request.notification.kind,
      target: request.target,
      externalId: response.id,
    };
  }
}

function resolveChannel(request: NotificationRequest): string | null {
  const { target } = request;
  if (target.type === "channel" || target.type === "user") return target.ref;
  return null;
}

/** Pure map: neutral notification → Discord message with an embed. */
function toDiscordMessage(
  channelId: string,
  notification: Notification,
): DiscordCreateMessageRequest {
  const embed: DiscordEmbed = {
    title: notification.title,
    description: notification.body,
    url: notification.link,
    color: PRIORITY_COLOR[notification.priority ?? "normal"],
    timestamp: notification.meeting?.startAt,
    fields: notification.meeting
      ? [{ name: "When", value: notification.meeting.startAt, inline: true }]
      : undefined,
  };

  const buttons = (notification.actions ?? [])
    .filter((action) => Boolean(action.url))
    .map((action) => ({ label: action.label, url: action.url as string }));

  return { channelId, embeds: [embed], buttons: buttons.length > 0 ? buttons : undefined };
}
