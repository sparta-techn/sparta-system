/**
 * GoogleCalendarIntegration — the Google Calendar provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link NotifierPort}, but as a narrow channel: only `meeting_reminder`
 * notifications are delivered (as calendar events); other kinds are skipped.
 * STATUS: placeholder — no Calendar API is called; `available` stays false until
 * the client is wired.
 */

import type {
  ConnectInput,
  IntegrationAccountData,
  IntegrationMetadata,
  SettingsSchema,
  SyncInput,
  SyncResult,
} from "../types";
import type { AccountStore } from "../services/account-store";
import type { DeliveryResult, NotificationKind, NotificationRequest, NotifierPort } from "../ports";
import { BaseIntegration, type AuthenticatedIdentity } from "../providers/base-integration";
import { notImplemented } from "../services/errors";
import { GoogleCalendarClient } from "./google-calendar-client";
import { GoogleCalendarNotifierService } from "./google-calendar-notifier.service";
import type { GoogleCalendarClientConfig } from "./types";

export const GOOGLE_CALENDAR_METADATA: IntegrationMetadata = {
  id: "google-calendar",
  displayName: "Google Calendar",
  description: "Deliver meeting reminders as calendar events with reminder overrides.",
  category: "calendar",
  scope: "user",
  auth: "oauth2",
  capabilities: ["notify.send", "calendar.sync", "webhook.inbound"],
  supportsWebhooks: true,
  available: false,
};

export class GoogleCalendarIntegration extends BaseIntegration implements NotifierPort {
  readonly metadata = GOOGLE_CALENDAR_METADATA;

  private readonly client: GoogleCalendarClient;
  private readonly notifier: GoogleCalendarNotifierService;

  constructor(store: AccountStore, config: GoogleCalendarClientConfig = {}) {
    super(store);
    this.client = new GoogleCalendarClient(config);
    this.notifier = new GoogleCalendarNotifierService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Google Calendar connect (OAuth code exchange)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Google Calendar sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.getPrimaryCalendar(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "calendarId",
          label: "Calendar",
          type: "string",
          required: false,
          default: "primary",
          help: "Calendar id reminders are created on. Defaults to the primary calendar.",
        },
        {
          key: "reminderMinutes",
          label: "Default reminder (minutes before)",
          type: "number",
          required: false,
          default: 10,
        },
      ],
    };
  }

  // ── NotifierPort — delegated to the service ──────────────────────────────────

  get supportedKinds(): readonly NotificationKind[] {
    return this.notifier.supportedKinds;
  }

  supports(kind: NotificationKind): boolean {
    return this.notifier.supports(kind);
  }

  notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult> {
    return this.notifier.notify(accountId, request);
  }
}
