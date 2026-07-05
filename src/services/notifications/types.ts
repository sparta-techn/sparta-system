/**
 * Collaboration domain types for the migration-`20260701120000` tables
 * (`notifications`, `notification_preferences`, `mentions`).
 *
 * Snake-case row shapes matching the SQL schema. These tables are not yet in the
 * generated `Database` types, so the services talk to the relaxed `db` client.
 */

export type NotificationType = "info" | "success" | "warning" | "critical" | "reminder";
export type NotificationPriority = "low" | "normal" | "high" | "critical";
export type NotificationState = "unseen" | "seen" | "read" | "archived" | "dismissed";
export type NotificationCategory =
  "attendance" | "dependencies" | "announcements" | "reports" | "mentions" | "system" | "approvals";
export type MentionSource = "comment" | "task" | "dependency" | "project" | "report";

export interface NotificationAction {
  label: string;
  href?: string;
  kind?: "primary" | "secondary";
}

// ── notifications ────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  state: NotificationState;
  category: NotificationCategory;
  title: string;
  body: string | null;
  event_name: string | null;
  payload: Record<string, unknown>;
  actions: NotificationAction[];
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  seen_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  dismissed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
export type NotificationInsert = Pick<NotificationRow, "recipient_id" | "title"> &
  Partial<Omit<NotificationRow, "recipient_id" | "title" | "id" | "created_at" | "updated_at">>;
export type NotificationUpdate = Partial<
  Pick<
    NotificationRow,
    "state" | "seen_at" | "read_at" | "archived_at" | "dismissed_at" | "priority"
  >
>;

// ── notification_preferences (keyed by user_id) ──────────────────────────────

export interface NotificationPreferencesRow {
  user_id: string;
  categories: Record<string, boolean>;
  channels: Record<string, boolean>;
  quiet_hours: { start?: string; end?: string; enabled: boolean };
  created_at: string;
  updated_at: string;
}
export type NotificationPreferencesUpsert = Pick<NotificationPreferencesRow, "user_id"> &
  Partial<Pick<NotificationPreferencesRow, "categories" | "channels" | "quiet_hours">>;
export type NotificationPreferencesUpdate = Partial<
  Pick<NotificationPreferencesRow, "categories" | "channels" | "quiet_hours">
>;

// ── mentions ─────────────────────────────────────────────────────────────────

export interface MentionRow {
  id: string;
  mentioned_user_id: string;
  actor_id: string | null;
  source_type: MentionSource;
  source_id: string;
  project_id: string | null;
  excerpt: string | null;
  href: string | null;
  seen_at: string | null;
  created_at: string;
  updated_at: string;
}
export type MentionInsert = Pick<MentionRow, "mentioned_user_id" | "source_type" | "source_id"> &
  Partial<
    Omit<
      MentionRow,
      "mentioned_user_id" | "source_type" | "source_id" | "id" | "created_at" | "updated_at"
    >
  >;
export type MentionUpdate = Partial<Pick<MentionRow, "seen_at">>;
