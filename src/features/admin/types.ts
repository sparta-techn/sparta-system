/**
 * Admin-console domain types: platform-wide **System Settings**, **Feature
 * Flags**, and **Maintenance Mode**. Owner-only surface. Shaped to mirror a
 * future `system_settings` / `feature_flags` Supabase table so the store can be
 * swapped for server persistence without touching the panels.
 */

export interface SystemSettings {
  companyName: string;
  supportEmail: string;
  defaultTimezone: string;
  /** Idle minutes before a session is considered expired (UI hint only). */
  sessionTimeoutMinutes: number;
  /** Whether self-service signup is allowed (vs invite-only). */
  allowSignups: boolean;
  /** Whether two-factor authentication is enforced org-wide. */
  enforce2fa: boolean;
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  /** When maintenance was switched on (ISO), or null. */
  startedAt: string | null;
  /** Optional planned end (ISO datetime-local), or null. */
  plannedEndAt: string | null;
}

export interface SystemState {
  settings: SystemSettings;
  flags: FeatureFlag[];
  maintenance: MaintenanceState;
}
