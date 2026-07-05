/**
 * SpartaFlow collaboration rules (pure, side-effect-free).
 *
 * Encodes *when* a notification is generated and *what it looks like*, for the
 * nine collaboration events the product spec calls out:
 *
 *   task assigned · task status changed · mention received · dependency assigned
 *   comment added · sprint started · sprint completed · attendance approved
 *   leave approved
 *
 * This module is the single source of truth for the event → {@link NotificationInsert}
 * mapping and the delivery gate (self-suppression + muted categories). It is
 * deliberately free of Supabase / React so it can be unit-tested like the other
 * `rules.ts` modules (attendance, reports, projects). The actual insert — which
 * for cross-user fan-out must run server-side under a SECURITY DEFINER function
 * or the service role — consumes {@link generateNotification} to build the row.
 *
 * User-side inbox actions (mark read/unread, archive, delete, mute a category)
 * live on {@link NotificationsService} / {@link NotificationPreferencesService};
 * the "mute" gate here reads the same `notification_preferences.categories` map.
 */
import type {
  NotificationCategory,
  NotificationInsert,
  NotificationPreferencesRow,
  NotificationPriority,
  NotificationType,
} from "./types";

// ── Event taxonomy ───────────────────────────────────────────────────────────

/** Stable `event_name` written to each notification (dotted, past-tense). */
export type CollaborationEventName =
  | "task.assigned"
  | "task.status_changed"
  | "mention.received"
  | "dependency.assigned"
  | "comment.added"
  | "sprint.started"
  | "sprint.completed"
  | "attendance.approved"
  | "leave.approved";

/** Fields shared by every collaboration event. */
interface BaseEvent {
  /** Who receives the notification (the `recipient_id`). */
  recipientId: string;
  /** Who caused it, if a user. Used for self-suppression and `actor_id`. */
  actorId?: string | null;
  /** Display name of the actor, woven into the copy (falls back to "Someone"). */
  actorName?: string;
}

export interface TaskAssignedEvent extends BaseEvent {
  kind: "task.assigned";
  taskId: string;
  taskTitle: string;
  href?: string;
}
export interface TaskStatusChangedEvent extends BaseEvent {
  kind: "task.status_changed";
  taskId: string;
  taskTitle: string;
  fromStatus: string;
  toStatus: string;
  href?: string;
}
export interface MentionReceivedEvent extends BaseEvent {
  kind: "mention.received";
  sourceType: string;
  sourceId: string;
  excerpt?: string;
  href?: string;
}
export interface DependencyAssignedEvent extends BaseEvent {
  kind: "dependency.assigned";
  dependencyId: string;
  dependencyTitle: string;
  href?: string;
}
export interface CommentAddedEvent extends BaseEvent {
  kind: "comment.added";
  commentId: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  excerpt?: string;
  href?: string;
}
export interface SprintStartedEvent extends BaseEvent {
  kind: "sprint.started";
  sprintId: string;
  sprintName: string;
  href?: string;
}
export interface SprintCompletedEvent extends BaseEvent {
  kind: "sprint.completed";
  sprintId: string;
  sprintName: string;
  href?: string;
}
export interface AttendanceApprovedEvent extends BaseEvent {
  kind: "attendance.approved";
  recordId: string;
  workDate: string;
  href?: string;
}
export interface LeaveApprovedEvent extends BaseEvent {
  kind: "leave.approved";
  leaveId: string;
  /** ISO date the leave starts (woven into the copy). */
  startDate: string;
  endDate?: string;
  href?: string;
}

/** Discriminated union of every event that can generate a notification. */
export type CollaborationEvent =
  | TaskAssignedEvent
  | TaskStatusChangedEvent
  | MentionReceivedEvent
  | DependencyAssignedEvent
  | CommentAddedEvent
  | SprintStartedEvent
  | SprintCompletedEvent
  | AttendanceApprovedEvent
  | LeaveApprovedEvent;

// ── Event → category / type / priority mapping ───────────────────────────────

/**
 * The muteable category each event routes to. The DB `notification_category`
 * enum has no dedicated "tasks" or "sprints" bucket, so:
 *   • task + comment events        → `system`        (project work stream)
 *   • sprint events                → `announcements` (team-wide broadcasts)
 *   • attendance + leave approvals → `attendance`    (time/HR outcomes)
 * Muting a category (see {@link isCategoryMuted}) suppresses every event mapped
 * to it — e.g. muting `attendance` silences both attendance and leave approvals.
 */
export const CATEGORY_BY_EVENT: Record<CollaborationEventName, NotificationCategory> = {
  "task.assigned": "system",
  "task.status_changed": "system",
  "mention.received": "mentions",
  "dependency.assigned": "dependencies",
  "comment.added": "system",
  "sprint.started": "announcements",
  "sprint.completed": "announcements",
  "attendance.approved": "attendance",
  "leave.approved": "attendance",
};

const TYPE_BY_EVENT: Record<CollaborationEventName, NotificationType> = {
  "task.assigned": "info",
  "task.status_changed": "info",
  "mention.received": "info",
  "dependency.assigned": "warning",
  "comment.added": "info",
  "sprint.started": "info",
  "sprint.completed": "success",
  "attendance.approved": "success",
  "leave.approved": "success",
};

const PRIORITY_BY_EVENT: Record<CollaborationEventName, NotificationPriority> = {
  "task.assigned": "normal",
  "task.status_changed": "normal",
  "mention.received": "high",
  "dependency.assigned": "high",
  "comment.added": "normal",
  "sprint.started": "normal",
  "sprint.completed": "normal",
  "attendance.approved": "normal",
  "leave.approved": "normal",
};

export function categoryForEvent(kind: CollaborationEventName): NotificationCategory {
  return CATEGORY_BY_EVENT[kind];
}

// ── Delivery gate ────────────────────────────────────────────────────────────

/**
 * A user is never notified about their own action (assigning yourself a task,
 * @-mentioning yourself, commenting on your own thread…). Requires a known
 * `actorId`; system-originated events (no actor) are never self-actions.
 */
export function isSelfAction(event: CollaborationEvent): boolean {
  return event.actorId != null && event.actorId === event.recipientId;
}

/**
 * Whether the recipient has muted a category. `categories` is a
 * `{ category: enabled }` map: an explicit `false` means muted; a missing key
 * defaults to enabled (not muted).
 */
export function isCategoryMuted(
  prefs: Pick<NotificationPreferencesRow, "categories"> | null | undefined,
  category: NotificationCategory,
): boolean {
  return prefs?.categories?.[category] === false;
}

/**
 * Whether `now` falls inside the recipient's configured quiet hours. Governs the
 * *push* channel only — in-app notifications are still generated — so it is not
 * part of {@link shouldGenerate}. Times are "HH:MM" (24h); a window whose end is
 * at/before its start wraps past midnight (e.g. 22:00 → 07:00).
 */
export function isWithinQuietHours(
  prefs: Pick<NotificationPreferencesRow, "quiet_hours"> | null | undefined,
  now: Date = new Date(),
): boolean {
  const q = prefs?.quiet_hours;
  if (!q?.enabled || !q.start || !q.end) return false;

  const toMinutes = (hhmm: string): number | null => {
    const [h, m] = hhmm.split(":").map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    return h * 60 + m;
  };
  const start = toMinutes(q.start);
  const end = toMinutes(q.end);
  if (start == null || end == null) return false;

  const cur = now.getHours() * 60 + now.getMinutes();
  // Same-day window (start < end): inside when start ≤ cur < end.
  // Overnight window (start ≥ end): inside when cur ≥ start OR cur < end.
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/**
 * Whether an in-app notification should be generated for this event: not the
 * recipient's own action, and its category is not muted.
 */
export function shouldGenerate(
  event: CollaborationEvent,
  prefs?: Pick<NotificationPreferencesRow, "categories"> | null,
): boolean {
  if (isSelfAction(event)) return false;
  if (isCategoryMuted(prefs, categoryForEvent(event.kind))) return false;
  return true;
}

// ── Copy + row builders ──────────────────────────────────────────────────────

function actorLabel(event: BaseEvent): string {
  return event.actorName?.trim() || "Someone";
}

interface Copy {
  title: string;
  body: string | null;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
}

function copyFor(event: CollaborationEvent): Copy {
  const who = actorLabel(event);
  switch (event.kind) {
    case "task.assigned":
      return {
        title: `${who} assigned you a task`,
        body: event.taskTitle,
        href: event.href ?? null,
        entityType: "task",
        entityId: event.taskId,
        payload: { task_title: event.taskTitle },
      };
    case "task.status_changed":
      return {
        title: `${event.taskTitle} moved to ${event.toStatus}`,
        body: `${who} moved it from ${event.fromStatus} to ${event.toStatus}`,
        href: event.href ?? null,
        entityType: "task",
        entityId: event.taskId,
        payload: { from_status: event.fromStatus, to_status: event.toStatus },
      };
    case "mention.received":
      return {
        title: `${who} mentioned you`,
        body: event.excerpt ?? null,
        href: event.href ?? null,
        entityType: event.sourceType,
        entityId: event.sourceId,
        payload: { source_type: event.sourceType, source_id: event.sourceId },
      };
    case "dependency.assigned":
      return {
        title: `${who} assigned you a dependency`,
        body: event.dependencyTitle,
        href: event.href ?? null,
        entityType: "dependency",
        entityId: event.dependencyId,
        payload: { dependency_title: event.dependencyTitle },
      };
    case "comment.added":
      return {
        title: `${who} commented on ${event.entityTitle ?? event.entityType}`,
        body: event.excerpt ?? null,
        href: event.href ?? null,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: { comment_id: event.commentId },
      };
    case "sprint.started":
      return {
        title: `Sprint ${event.sprintName} started`,
        body: null,
        href: event.href ?? null,
        entityType: "sprint",
        entityId: event.sprintId,
        payload: { sprint_name: event.sprintName },
      };
    case "sprint.completed":
      return {
        title: `Sprint ${event.sprintName} completed`,
        body: null,
        href: event.href ?? null,
        entityType: "sprint",
        entityId: event.sprintId,
        payload: { sprint_name: event.sprintName },
      };
    case "attendance.approved":
      return {
        title: "Your attendance was approved",
        body: `Work day ${event.workDate} approved`,
        href: event.href ?? null,
        entityType: "attendance_record",
        entityId: event.recordId,
        payload: { work_date: event.workDate },
      };
    case "leave.approved":
      return {
        title: "Your leave was approved",
        body: event.endDate
          ? `${event.startDate} → ${event.endDate}`
          : `Starting ${event.startDate}`,
        href: event.href ?? null,
        entityType: "leave_request",
        entityId: event.leaveId,
        payload: { start_date: event.startDate, end_date: event.endDate ?? null },
      };
  }
}

/**
 * Build the notification row for an event, *without* applying the delivery gate.
 * Use {@link generateNotification} when preferences/self-suppression should be
 * honoured; use this directly only when the caller has already gated.
 */
export function buildNotification(event: CollaborationEvent): NotificationInsert {
  const copy = copyFor(event);
  return {
    recipient_id: event.recipientId,
    actor_id: event.actorId ?? null,
    type: TYPE_BY_EVENT[event.kind],
    priority: PRIORITY_BY_EVENT[event.kind],
    category: categoryForEvent(event.kind),
    event_name: event.kind,
    title: copy.title,
    body: copy.body,
    href: copy.href,
    entity_type: copy.entityType,
    entity_id: copy.entityId,
    payload: copy.payload,
  };
}

/**
 * The collaboration rule end-to-end: returns the notification to insert, or
 * `null` when it must not be generated (recipient's own action, or the category
 * is muted). This is what a fan-out function should call per candidate recipient.
 */
export function generateNotification(
  event: CollaborationEvent,
  prefs?: Pick<NotificationPreferencesRow, "categories"> | null,
): NotificationInsert | null {
  return shouldGenerate(event, prefs) ? buildNotification(event) : null;
}
