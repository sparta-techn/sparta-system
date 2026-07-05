/**
 * Collaboration rules — the pure, testable core of notification behaviour.
 *
 * Two halves:
 *   1. **Generation triggers** — the collaboration events that produce
 *      notifications (the concrete `NotificationSpec`s live in `rules.ts` and
 *      run through the automation engine).
 *   2. **Recipient capabilities** — the state transitions a user can apply to a
 *      notification (mark read / unread / archive / delete) plus the category
 *      mute gate. `store.ts` applies these for its optimistic updates, so the
 *      tests here cover exactly what the UI does.
 */

import type {
  AppNotification,
  EventName,
  NotificationPreferences,
  PreferenceCategory,
} from "./types";

/** Events that generate a notification (see `rules.ts` for the specs). */
export const NOTIFICATION_TRIGGERS = [
  "task.assigned",
  "task.status_changed",
  "mention.received",
  "dependency.assigned",
  "comment.added",
  "sprint.started",
  "sprint.completed",
  "attendance.approved",
  "leave.approved",
] as const satisfies readonly EventName[];

export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number];

export function isNotificationTrigger(name: EventName): name is NotificationTrigger {
  return (NOTIFICATION_TRIGGERS as readonly EventName[]).includes(name);
}

function nowIso() {
  return new Date().toISOString();
}

// ── Recipient capabilities (pure state transitions) ─────────────────────────

/** Mark read (idempotent — keeps the original read time if already read). */
export function markReadState(n: AppNotification, at: string = nowIso()): AppNotification {
  return { ...n, readAt: n.readAt ?? at };
}

/** Mark unread — clears the read timestamp. */
export function markUnreadState(n: AppNotification): AppNotification {
  return { ...n, readAt: null };
}

/** Archive — also marks read so it leaves the unread count. */
export function archiveState(n: AppNotification, at: string = nowIso()): AppNotification {
  return { ...n, archivedAt: at, readAt: n.readAt ?? at };
}

/** Delete — soft-delete via a tombstone timestamp. */
export function deleteState(n: AppNotification, at: string = nowIso()): AppNotification {
  return { ...n, deletedAt: at };
}

// ── Read/mute predicates ────────────────────────────────────────────────────

/** A notification counts as unread when not read, archived or deleted. */
export function isUnread(n: AppNotification): boolean {
  return !n.readAt && !n.archivedAt && !n.deletedAt;
}

/** Whether a category is muted in the user's preferences. */
export function isCategoryMuted(
  prefs: NotificationPreferences,
  category: PreferenceCategory,
): boolean {
  return prefs.categories[category] === false;
}
