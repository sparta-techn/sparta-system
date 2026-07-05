/**
 * GoogleDriveIntegration — the Google Drive provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link RecentActivityPort} for the file-activity feed. STATUS: placeholder — no
 * Drive API is called; `available` stays false until the client is wired.
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
import { GoogleDriveClient } from "./google-drive-client";
import { GoogleDriveRecentActivityService } from "./google-drive-recent-activity.service";
import type { GoogleDriveClientConfig } from "./types";

export const GOOGLE_DRIVE_METADATA: IntegrationMetadata = {
  id: "google-drive",
  displayName: "Google Drive",
  description: "Recent file activity (creates, edits, comments, shares) as a signal.",
  category: "storage",
  scope: "user",
  auth: "oauth2",
  capabilities: ["activity.recent", "webhook.inbound"],
  supportsWebhooks: true,
  available: false,
};

export class GoogleDriveIntegration extends BaseIntegration implements RecentActivityPort {
  readonly metadata = GOOGLE_DRIVE_METADATA;

  private readonly client: GoogleDriveClient;
  private readonly activity: GoogleDriveRecentActivityService;

  constructor(store: AccountStore, config: GoogleDriveClientConfig = {}) {
    super(store);
    this.client = new GoogleDriveClient(config);
    this.activity = new GoogleDriveRecentActivityService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Google Drive connect (OAuth code exchange)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Google Drive sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.getAuthenticatedUser(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "folderId",
          label: "Folder",
          type: "string",
          required: false,
          help: "Restrict activity to this folder subtree (id). Blank = all files.",
        },
        {
          key: "includeSharedDrives",
          label: "Include shared drives",
          type: "boolean",
          required: false,
          default: true,
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
