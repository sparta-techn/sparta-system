/**
 * Notifications source — the user's recent notifications and unread count. Reads
 * through the notifications service.
 */

import { notificationsService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, snippet } from "./source-utils";

export const notificationsSource: ContextSource = {
  key: "notifications",
  label: "Notifications",

  async gather({ userId }) {
    const [recent, unread] = await Promise.all([
      notificationsService.listForRecipient(userId, {
        limit: 5,
        orderBy: "created_at",
        direction: "desc",
      }),
      notificationsService.unreadCount(userId),
    ]);

    if (recent.length === 0) {
      return emptyFragment("notifications", this.label, "No notifications.");
    }

    const { items, truncated } = clampList(recent);
    const entities: ContextEntity[] = items.map((n) => ({
      type: "notification",
      id: n.id,
      summary: snippet(`[${n.type}/${n.state}] ${n.title}${n.body ? ` — ${n.body}` : ""}`, 140),
    }));

    return fragment("notifications", this.label, entities, {
      truncated,
      note: `${unread} unread`,
    });
  },
};
