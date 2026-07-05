import type { ListParams } from "@/services/core";
import {
  NotificationsService,
  notificationsService,
  type NotificationInsert,
  type NotificationRow,
  type NotificationState,
  type NotificationUpdate,
} from "@/services/notifications";

/**
 * NotificationRepository — recipient inbox operations over `notifications`.
 * Delegates persistence to {@link NotificationsService} and frames it in inbox
 * terms (unread badge, mark read/seen/dismiss). Writes are RLS-scoped to the
 * recipient; cross-user fan-out happens server-side, not here.
 */
export class NotificationRepository {
  constructor(private readonly service: NotificationsService = notificationsService) {}

  /** A recipient's inbox, optionally filtered by lifecycle state. */
  inbox(
    recipientId: string,
    state?: NotificationState,
    params: ListParams<NotificationRow> = {},
  ): Promise<NotificationRow[]> {
    return state
      ? this.service.listByState(recipientId, state, params)
      : this.service.listForRecipient(recipientId, params);
  }

  badgeCount(recipientId: string): Promise<number> {
    return this.service.unreadCount(recipientId);
  }

  getById(id: string): Promise<NotificationRow | null> {
    return this.service.getById(id);
  }

  /** Notification CRUD (self-addressed; fan-out to others is server-side). */
  create(input: NotificationInsert): Promise<NotificationRow> {
    return this.service.create(input);
  }

  update(id: string, patch: NotificationUpdate): Promise<NotificationRow> {
    return this.service.update(id, patch);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }

  markSeen(id: string): Promise<NotificationRow> {
    return this.service.markSeen(id);
  }
  markRead(id: string): Promise<NotificationRow> {
    return this.service.markRead(id);
  }
  markUnread(id: string): Promise<NotificationRow> {
    return this.service.markUnread(id);
  }
  markAllRead(recipientId: string): Promise<number> {
    return this.service.markAllRead(recipientId);
  }
  archive(id: string): Promise<NotificationRow> {
    return this.service.archive(id);
  }
  dismiss(id: string): Promise<NotificationRow> {
    return this.service.dismiss(id);
  }
}

/** Shared singleton — import this, not the class. */
export const notificationRepository = new NotificationRepository();
