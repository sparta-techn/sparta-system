/**
 * EmailIntegration — the Email provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link NotifierPort} for outbound email notifications. Transport-neutral (SMTP
 * or an email API) behind the client seam. STATUS: placeholder — no mail is sent;
 * `available` stays false until the transport is wired.
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
import { EmailClient } from "./email-client";
import { EmailNotifierService } from "./email-notifier.service";
import type { EmailClientConfig } from "./types";

export const EMAIL_METADATA: IntegrationMetadata = {
  id: "email",
  displayName: "Email",
  description: "Transactional email notifications via SMTP or an email API.",
  category: "other",
  scope: "org",
  auth: "api_token",
  capabilities: ["notify.send"],
  supportsWebhooks: false,
  available: false,
};

export class EmailIntegration extends BaseIntegration implements NotifierPort {
  readonly metadata = EMAIL_METADATA;

  private readonly client: EmailClient;
  private readonly notifier: EmailNotifierService;

  constructor(store: AccountStore, config: EmailClientConfig = {}) {
    super(store);
    this.client = new EmailClient(config);
    this.notifier = new EmailNotifierService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Email connect (SMTP/API credential validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Email sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.verifySender(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "fromAddress",
          label: "From address",
          type: "string",
          required: true,
          help: "Verified sender address notifications are sent from.",
        },
        {
          key: "fromName",
          label: "From name",
          type: "string",
          required: false,
          default: "SpartaFlow",
        },
        {
          key: "replyTo",
          label: "Reply-to address",
          type: "string",
          required: false,
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
