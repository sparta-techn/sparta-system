/**
 * SlackNotifierService — Slack's implementation of {@link NotifierPort}.
 *
 * Wraps the one client seam and renders a neutral {@link Notification} as a Slack
 * Block Kit message (approval actions → buttons). No network of its own; the
 * mapper is pure. Slack routes `user`/`channel` targets; other target types are
 * skipped, not errored.
 */

import {
  NOTIFICATION_KINDS,
  skipped,
  type DeliveryResult,
  type Notification,
  type NotificationKind,
  type NotificationRequest,
  type NotifierPort,
} from "../ports";
import { SlackClient } from "./slack-client";
import type { SlackBlock, SlackPostMessageRequest } from "./types";

export class SlackNotifierService implements NotifierPort {
  /** Slack renders every notification kind. */
  readonly supportedKinds = NOTIFICATION_KINDS;

  constructor(private readonly client: SlackClient) {}

  supports(kind: NotificationKind): boolean {
    return this.supportedKinds.includes(kind);
  }

  async notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult> {
    const channel = resolveChannel(request);
    if (channel === null) {
      return skipped(request, "Slack routes only user or channel targets.");
    }

    const message = toSlackMessage(channel, request.notification);
    const response = await this.client.postMessage(accountId, message);
    return {
      state: response.ok ? "delivered" : "failed",
      kind: request.notification.kind,
      target: request.target,
      externalId: response.ts,
    };
  }
}

/** Map a neutral target to a Slack channel/user id, or null if unroutable. */
function resolveChannel(request: NotificationRequest): string | null {
  const { target } = request;
  if (target.type === "channel" || target.type === "user") return target.ref;
  return null;
}

/** Pure map: neutral notification → Slack Block Kit message. */
function toSlackMessage(channel: string, notification: Notification): SlackPostMessageRequest {
  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: notification.title } },
    { type: "section", text: { type: "mrkdwn", text: notification.body } },
  ];

  if (notification.meeting) {
    blocks.push({
      type: "context",
      elements: [],
      text: { type: "mrkdwn", text: `:calendar: ${notification.meeting.startAt}` },
    });
  }

  if (notification.actions && notification.actions.length > 0) {
    blocks.push({
      type: "actions",
      elements: notification.actions.map((action) => ({
        type: "button",
        text: { type: "plain_text", text: action.label },
        actionId: action.id,
        url: action.url,
        style: action.style === "primary" || action.style === "danger" ? action.style : undefined,
      })),
    });
  }

  return { channel, text: notification.title, blocks };
}
