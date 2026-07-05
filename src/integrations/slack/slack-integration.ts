/**
 * SlackIntegration — the Slack provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link NotifierPort} for outbound notifications. Graduated from the shared
 * `placeholder-integrations.ts` into its own folder (adapter + client + notifier
 * service), the per-provider shape the architecture targets. STATUS: placeholder
 * — no Slack API is called; `available` stays false until the client is wired.
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
import type {
  DeliveryResult,
  NotificationKind,
  NotificationRequest,
  NotifierPort,
} from "../ports";
import { BaseIntegration, type AuthenticatedIdentity } from "../providers/base-integration";
import { notImplemented } from "../services/errors";
import { SlackClient } from "./slack-client";
import { SlackNotifierService } from "./slack-notifier.service";
import type { SlackClientConfig } from "./types";

export const SLACK_METADATA: IntegrationMetadata = {
  id: "slack",
  displayName: "Slack",
  description: "Send notifications to Slack channels and DMs; interactive approval actions.",
  category: "chat",
  scope: "org",
  auth: "oauth2",
  capabilities: ["notify.send", "chat.notify", "webhook.inbound"],
  supportsWebhooks: true,
  available: false,
};

export class SlackIntegration extends BaseIntegration implements NotifierPort {
  readonly metadata = SLACK_METADATA;

  private readonly client: SlackClient;
  private readonly notifier: SlackNotifierService;

  constructor(store: AccountStore, config: SlackClientConfig = {}) {
    super(store);
    this.client = new SlackClient(config);
    this.notifier = new SlackNotifierService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Slack connect (OAuth code exchange)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Slack sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.authTest(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "defaultChannel",
          label: "Default channel",
          type: "string",
          required: true,
          help: "Channel id notifications post to when no target is set.",
        },
        {
          key: "mentionOnEscalation",
          label: "@mention on escalation",
          type: "boolean",
          required: false,
          default: true,
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
