/**
 * GoogleDocsIntegration — the Google Docs provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link RecentActivityPort} for the document-activity feed. STATUS: placeholder
 * — no Docs API is called; `available` stays false until the client is wired.
 *
 * Docs itself emits no webhooks (change signals come via Drive), so this provider
 * declares `supportsWebhooks: false`.
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
import type { ActivityItem, ActivityPage, ActivityPageParams, RecentActivityPort } from "../ports";
import { BaseIntegration, type AuthenticatedIdentity } from "../providers/base-integration";
import { notImplemented } from "../services/errors";
import { GoogleDocsClient } from "./google-docs-client";
import { GoogleDocsRecentActivityService } from "./google-docs-recent-activity.service";
import type { GoogleDocsClientConfig } from "./types";

export const GOOGLE_DOCS_METADATA: IntegrationMetadata = {
  id: "google-docs",
  displayName: "Google Docs",
  description: "Recent document activity (edits, suggestions, comments) as a signal.",
  category: "storage",
  scope: "user",
  auth: "oauth2",
  capabilities: ["activity.recent"],
  supportsWebhooks: false,
  available: false,
};

export class GoogleDocsIntegration extends BaseIntegration implements RecentActivityPort {
  readonly metadata = GOOGLE_DOCS_METADATA;

  private readonly client: GoogleDocsClient;
  private readonly activity: GoogleDocsRecentActivityService;

  constructor(store: AccountStore, config: GoogleDocsClientConfig = {}) {
    super(store);
    this.client = new GoogleDocsClient(config);
    this.activity = new GoogleDocsRecentActivityService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Google Docs connect (OAuth code exchange)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Google Docs sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.getAuthenticatedUser(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "documentId",
          label: "Document",
          type: "string",
          required: false,
          help: "Limit activity to a single document (id). Blank = all documents.",
        },
        {
          key: "includeSuggestions",
          label: "Include suggestions",
          type: "boolean",
          required: false,
          default: true,
          help: "Count suggestion edits as activity.",
        },
      ],
    };
  }

  // ── RecentActivityPort — delegated to the service ────────────────────────────

  listRecentActivity(
    accountId: string,
    params?: ActivityPageParams,
  ): Promise<ActivityPage<ActivityItem>> {
    return this.activity.listRecentActivity(accountId, params);
  }
}
