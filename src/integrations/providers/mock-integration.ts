/**
 * MockIntegration — an offline, deterministic provider. Makes no network calls
 * and needs no credentials, so the whole platform (connect → settings → sync →
 * health) runs end-to-end locally. This is the reference adapter and the one the
 * UI defaults to until real providers are wired.
 *
 * Mirrors the role of `MockProvider` in `src/ai/providers/mock-provider.ts`.
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
import { BaseIntegration, type AuthenticatedIdentity } from "./base-integration";

export const MOCK_METADATA: IntegrationMetadata = {
  id: "mock",
  displayName: "Mock Integration",
  description: "Offline, deterministic provider for local development and tests. No API calls.",
  category: "other",
  scope: "user",
  auth: "api_token",
  capabilities: ["chat.notify", "task.read"],
  supportsWebhooks: false,
  available: true,
};

export class MockIntegration extends BaseIntegration {
  readonly metadata = MOCK_METADATA;

  constructor(store: AccountStore) {
    super(store);
  }

  protected async authenticate(input: ConnectInput): Promise<AuthenticatedIdentity> {
    // Deterministic, offline "identity" — no vendor call.
    return {
      externalAccountId: `mock-${input.ownerId}`,
      credentialRef: `mock-cred-${input.ownerId}`,
    };
  }

  protected async performSync(
    account: IntegrationAccountData,
    input: SyncInput,
  ): Promise<SyncResult> {
    // Deterministic no-op sync: reports two processed items and advances a cursor.
    const previous = Number.parseInt(input.since ?? "0", 10) || 0;
    const itemsProcessed = 2;
    return {
      ok: true,
      itemsProcessed,
      nextCursor: String(previous + itemsProcessed),
      errors: [],
      finishedAt: new Date().toISOString(),
    };
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    // Always healthy — nothing to reach.
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "label",
          label: "Display label",
          type: "string",
          required: false,
          default: "Mock",
          help: "Shown in the Admin list. Purely cosmetic.",
        },
        {
          key: "notifications",
          label: "Enable notifications",
          type: "boolean",
          required: false,
          default: true,
        },
      ],
    };
  }
}
