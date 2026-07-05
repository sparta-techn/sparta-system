import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type {
  NotificationInsert,
  NotificationRow,
  NotificationState,
  NotificationUpdate,
} from "./types";

/** States that count as not-yet-read (drive the badge + `markAllRead`). */
const UNREAD_STATES: NotificationState[] = ["unseen", "seen"];

/**
 * NotificationsService — CRUD + lifecycle over the `notifications` table
 * (migration 20260701120000, snake-case schema). RLS scopes every read/write to
 * the recipient; cross-user fan-out is done server-side (SECURITY DEFINER /
 * service role), not here.
 */
export class NotificationsService extends BaseService<
  NotificationRow,
  NotificationInsert,
  NotificationUpdate
> {
  protected readonly table = "notifications";
  protected readonly entity = "Notification";
  protected readonly defaultOrderBy = "created_at";

  /** A recipient's notifications, newest first. */
  listForRecipient(
    recipientId: string,
    params: ListParams<NotificationRow> = {},
  ): Promise<NotificationRow[]> {
    return this.list({ ...params, filters: { ...params.filters, recipient_id: recipientId } });
  }

  /** A recipient's notifications in a given lifecycle state. */
  listByState(
    recipientId: string,
    state: NotificationState,
    params: ListParams<NotificationRow> = {},
  ): Promise<NotificationRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, recipient_id: recipientId, state },
    });
  }

  /** Count of not-yet-read notifications (the badge count). */
  async unreadCount(recipientId: string): Promise<number> {
    try {
      const { count, error } = await this.client
        .from(this.table)
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", recipientId)
        .in("state", UNREAD_STATES);
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      throw toServiceError(error, `Failed to count ${this.entity}`);
    }
  }

  // ── Lifecycle transitions (stamp the matching timestamp) ───────────────────

  markSeen(id: string): Promise<NotificationRow> {
    return this.update(id, { state: "seen", seen_at: new Date().toISOString() });
  }

  markRead(id: string): Promise<NotificationRow> {
    return this.update(id, { state: "read", read_at: new Date().toISOString() });
  }

  /** Reset a notification to unread (clears read/archived stamps). */
  markUnread(id: string): Promise<NotificationRow> {
    return this.update(id, { state: "unseen", read_at: null, archived_at: null });
  }

  archive(id: string): Promise<NotificationRow> {
    return this.update(id, { state: "archived", archived_at: new Date().toISOString() });
  }

  dismiss(id: string): Promise<NotificationRow> {
    return this.update(id, { state: "dismissed", dismissed_at: new Date().toISOString() });
  }

  /** Mark every unread notification for a recipient as read; returns the count. */
  async markAllRead(recipientId: string): Promise<number> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .update({ state: "read", read_at: new Date().toISOString() } as never)
        .eq("recipient_id", recipientId)
        .in("state", UNREAD_STATES)
        .select("id");
      if (error) throw error;
      return (data ?? []).length;
    } catch (error) {
      throw toServiceError(error, `Failed to update ${this.entity}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const notificationsService = new NotificationsService();
