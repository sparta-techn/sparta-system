/**
 * DiscordIntegration — the Discord provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link NotifierPort} for outbound notifications. STATUS: placeholder — no
 * Discord API is called; `available` stays false until the client is wired.
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
import { DiscordClient } from "./discord-client";
import { DiscordNotifierService } from "./discord-notifier.service";
import type { DiscordClientConfig } from "./types";

export const DISCORD_METADATA: IntegrationMetadata = {
  id: "discord",
  displayName: "Discord",
  description: "Send notifications to Discord channels as rich embeds.",
  category: "chat",
  scope: "org",
  auth: "api_token",
  capabilities: ["notify.send", "chat.notify"],
  supportsWebhooks: false,
  available: false,
};

export class DiscordIntegration extends BaseIntegration implements NotifierPort {
  readonly metadata = DISCORD_METADATA;

  private readonly client: DiscordClient;
  private readonly notifier: DiscordNotifierService;

  constructor(store: AccountStore, config: DiscordClientConfig = {}) {
    super(store);
    this.client = new DiscordClient(config);
    this.notifier = new DiscordNotifierService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Discord connect (bot token validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Discord sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.getBotIdentity(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "defaultChannelId",
          label: "Default channel id",
          type: "string",
          required: true,
          help: "Channel notifications post to when no target is set.",
        },
        {
          key: "mentionRoleId",
          label: "Mention role id",
          type: "string",
          required: false,
          help: "Role to @mention on high-priority notifications.",
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
