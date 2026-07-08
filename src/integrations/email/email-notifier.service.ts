/**
 * EmailNotifierService — the email channel's implementation of {@link NotifierPort}.
 *
 * Wraps the one transport seam and renders a neutral {@link Notification} as an
 * HTML + text email (approval actions become links; meeting details become a
 * When: line). Pure mapper, no network of its own. Routes `email` targets;
 * `user`/`channel`/`calendar` targets are skipped (resolve users to an address
 * upstream before sending here).
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
import { EmailClient } from "./email-client";
import type { EmailSendRequest } from "./types";

export class EmailNotifierService implements NotifierPort {
  readonly supportedKinds = NOTIFICATION_KINDS;

  constructor(private readonly client: EmailClient) {}

  supports(kind: NotificationKind): boolean {
    return this.supportedKinds.includes(kind);
  }

  async notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult> {
    if (request.target.type !== "email") {
      return skipped(request, "Email routes only email targets (resolve users upstream).");
    }

    const message = toEmail(request.target.address, request.notification, request.dedupeKey);
    const response = await this.client.send(accountId, message);
    return {
      state: response.rejected.length === 0 ? "delivered" : "failed",
      kind: request.notification.kind,
      target: request.target,
      externalId: response.messageId,
    };
  }
}

/** Pure map: neutral notification → email send request. */
function toEmail(
  address: string,
  notification: Notification,
  dedupeKey?: string,
): EmailSendRequest {
  const lines: string[] = [notification.body];

  if (notification.meeting) {
    lines.push("", `When: ${notification.meeting.startAt}`);
    if (notification.meeting.joinUrl) lines.push(`Join: ${notification.meeting.joinUrl}`);
  }
  if (notification.link) lines.push("", notification.link);
  for (const action of notification.actions ?? []) {
    if (action.url) lines.push(`${action.label}: ${action.url}`);
  }

  const text = lines.join("\n");
  const html = lines.map((line) => (line === "" ? "<br/>" : `<p>${escapeHtml(line)}</p>`)).join("");

  return {
    to: [{ address }],
    subject: notification.title,
    html,
    text,
    idempotencyKey: dedupeKey,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
