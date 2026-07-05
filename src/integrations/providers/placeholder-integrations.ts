/**
 * Placeholder adapters — ClickUp.
 *
 * These declare real metadata + settings schemas (so the Admin UI can render
 * them today), but their vendor hooks throw `notImplemented`: NO external API is
 * connected yet. When a provider is wired, replace its hook bodies with a real
 * `*-client.ts` call and flip `available: true` — nothing else in the platform
 * changes. That is the Open/Closed guarantee in practice.
 *
 * GitHub, Slack, and the Figma / Google-Drive / Google-Docs / Discord / Email /
 * Google-Calendar providers have each graduated into their own `../<provider>/`
 * folder (adapter + client seam + services + a capability port) — the
 * per-provider shape the architecture targets. They remain placeholders (no API
 * calls yet). ClickUp is the last provider still declared inline here.
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
import { notImplemented } from "../services/errors";
import { BaseIntegration, type AuthenticatedIdentity } from "./base-integration";

/**
 * Shared base for not-yet-wired adapters. Metadata + schema are live; every
 * action is an explicit, greppable `notImplemented`.
 */
abstract class PlaceholderIntegration extends BaseIntegration {
  constructor(store: AccountStore) {
    super(store);
  }

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    notImplemented(`${this.metadata.displayName} connect`);
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    notImplemented(`${this.metadata.displayName} sync`);
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    notImplemented(`${this.metadata.displayName} health check`);
  }
}

// ── ClickUp ─────────────────────────────────────────────────────────────────

export const CLICKUP_METADATA: IntegrationMetadata = {
  id: "clickup",
  displayName: "ClickUp",
  description: "Link SpartaFlow projects/tasks to ClickUp; sync task status.",
  category: "tasks",
  scope: "org",
  auth: "oauth2",
  capabilities: ["task.read", "task.write", "webhook.inbound"],
  supportsWebhooks: true,
  available: false,
};

export class ClickUpIntegration extends PlaceholderIntegration {
  readonly metadata = CLICKUP_METADATA;

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "workspaceId",
          label: "Workspace",
          type: "string",
          required: true,
          help: "ClickUp workspace to link against.",
        },
        {
          key: "importClosed",
          label: "Import closed tasks",
          type: "boolean",
          required: false,
          default: false,
        },
      ],
    };
  }
}
