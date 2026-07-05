import {
  NotificationPreferencesService,
  notificationPreferencesService,
  type NotificationPreferencesRow,
  type NotificationPreferencesUpdate,
  type NotificationPreferencesUpsert,
} from "@/services/notifications";

/**
 * NotificationPreferenceRepository — read/write the per-user
 * `notification_preferences` singleton (category + channel matrix + quiet
 * hours). Delegates to {@link NotificationPreferencesService}; RLS scopes it to
 * the signed-in user.
 */
export class NotificationPreferenceRepository {
  constructor(
    private readonly service: NotificationPreferencesService = notificationPreferencesService,
  ) {}

  /** A user's preferences, or `null` if not yet saved. */
  get(userId: string): Promise<NotificationPreferencesRow | null> {
    return this.service.get(userId);
  }

  /** Insert-or-replace a user's preferences. */
  save(input: NotificationPreferencesUpsert): Promise<NotificationPreferencesRow> {
    return this.service.upsert(input);
  }

  /** Patch an existing user's preferences. */
  update(
    userId: string,
    patch: NotificationPreferencesUpdate,
  ): Promise<NotificationPreferencesRow> {
    return this.service.update(userId, patch);
  }
}

/** Shared singleton — import this, not the class. */
export const notificationPreferenceRepository = new NotificationPreferenceRepository();
