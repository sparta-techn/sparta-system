/**
 * FigmaIntegration — the Figma provider adapter.
 *
 * Extends {@link BaseIntegration} (inheriting connect / disconnect / sync /
 * healthCheck / settings / validate) and *additionally* implements
 * {@link RecentActivityPort} for the design-activity feed. Only the four vendor
 * hooks are written here; three resolve to the `notImplemented` seam.
 *
 * STATUS: placeholder — no Figma API is called. Metadata + settings schema are
 * live so Figma renders in the Admin list; `available` stays false until the
 * client bodies are wired.
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
import { FigmaClient } from "./figma-client";
import { FigmaRecentActivityService } from "./figma-recent-activity.service";
import type { FigmaClientConfig } from "./types";

export const FIGMA_METADATA: IntegrationMetadata = {
  id: "figma",
  displayName: "Figma",
  description: "Recent design activity (file updates, versions, comments) as a signal.",
  category: "other",
  scope: "user",
  auth: "oauth2",
  capabilities: ["activity.recent", "webhook.inbound"],
  supportsWebhooks: true,
  available: false,
};

export class FigmaIntegration extends BaseIntegration implements RecentActivityPort {
  readonly metadata = FIGMA_METADATA;

  private readonly client: FigmaClient;
  private readonly activity: FigmaRecentActivityService;

  constructor(store: AccountStore, config: FigmaClientConfig = {}) {
    super(store);
    this.client = new FigmaClient(config);
    this.activity = new FigmaRecentActivityService(this.client);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Figma connect (OAuth code exchange)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Figma sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    await this.client.getAuthenticatedUser(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "teamId",
          label: "Team",
          type: "string",
          required: false,
          help: "Restrict activity to this Figma team.",
        },
        {
          key: "includeComments",
          label: "Include comments",
          type: "boolean",
          required: false,
          default: true,
          help: "Count file comments as activity.",
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
