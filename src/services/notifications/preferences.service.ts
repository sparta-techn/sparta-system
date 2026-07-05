import { db } from "../core/client";
import { toServiceError } from "../core/errors";
import type {
  NotificationPreferencesRow,
  NotificationPreferencesUpdate,
  NotificationPreferencesUpsert,
} from "./types";

/**
 * NotificationPreferencesService — the per-user `notification_preferences`
 * singleton (keyed by `user_id`, not `id`, so it does not extend BaseService).
 * RLS scopes it to `user_id = auth.uid()`.
 */
export class NotificationPreferencesService {
  private readonly table = "notification_preferences";

  private get client() {
    return db;
  }

  /** A user's preferences row, or `null` if none saved yet. */
  async get(userId: string): Promise<NotificationPreferencesRow | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as NotificationPreferencesRow | null) ?? null;
    } catch (error) {
      throw toServiceError(error, "Failed to load notification preferences");
    }
  }

  /** Insert-or-replace a user's preferences. */
  async upsert(input: NotificationPreferencesUpsert): Promise<NotificationPreferencesRow> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .upsert(input as never, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as NotificationPreferencesRow;
    } catch (error) {
      throw toServiceError(error, "Failed to save notification preferences");
    }
  }

  /** Patch an existing user's preferences. */
  async update(
    userId: string,
    patch: NotificationPreferencesUpdate,
  ): Promise<NotificationPreferencesRow> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .update(patch as never)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as NotificationPreferencesRow;
    } catch (error) {
      throw toServiceError(error, "Failed to update notification preferences");
    }
  }
}

/** Shared singleton — import this, not the class. */
export const notificationPreferencesService = new NotificationPreferencesService();
