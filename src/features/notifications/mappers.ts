/**
 * Maps the Supabase `notifications` row (snake-case, `state` lifecycle enum)
 * onto the feature's `AppNotification` domain shape (camel-case, timestamp
 * lifecycle) so the existing UI renders live data unchanged.
 */

import type { NotificationRow } from "@/services/notifications";

import type {
  AppNotification,
  EventName,
  NotificationPriority,
  NotificationType,
  PreferenceCategory,
} from "./types";

/** Backend `NotificationCategory` → UI `PreferenceCategory`; unknown → `system`. */
const CATEGORY_MAP: Record<string, PreferenceCategory> = {
  attendance: "attendance",
  dependencies: "dependencies",
  announcements: "announcements",
  reports: "reports",
  mentions: "mentions",
  system: "system",
  approvals: "approvals",
};

export function notificationRowToApp(row: NotificationRow): AppNotification {
  // Derive the UI's timestamp lifecycle from the row's `state` + stamps.
  const readAt = row.read_at ?? (row.state === "read" ? row.updated_at : null);
  const archivedAt = row.archived_at ?? (row.state === "archived" ? row.updated_at : null);
  const deletedAt = row.dismissed_at ?? (row.state === "dismissed" ? row.updated_at : null);

  return {
    id: row.id,
    eventId: row.id,
    // `iconFor` calls `eventName.startsWith(...)`, so it must be a string.
    eventName: (row.event_name ?? "") as EventName,
    category: CATEGORY_MAP[row.category] ?? "system",
    type: row.type as NotificationType,
    priority: row.priority as NotificationPriority,
    title: row.title,
    body: row.body ?? "",
    recipientId: row.recipient_id,
    channels: ["in_app"],
    actions: row.actions.length ? row.actions : undefined,
    href: row.href ?? undefined,
    createdAt: row.created_at,
    readAt,
    archivedAt,
    deletedAt,
    expiresAt: row.expires_at ?? null,
    meta: row.payload,
  };
}
