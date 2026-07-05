/**
 * SettingsManager — the configuration surface for connected accounts.
 *
 * A thin, vendor-blind facade over each adapter's `settings()` / `validate()`.
 * Features and the Admin UI go through this instead of reaching into adapters,
 * so schema-fetch, validation and persistence stay uniform across providers.
 */

import type { IntegrationRegistry } from "../providers/integration-registry";
import type { AccountStore } from "./account-store";
import { IntegrationError } from "./errors";
import type {
  IntegrationId,
  IntegrationSettings,
  SettingsSchema,
  ValidationResult,
} from "../types";

export class SettingsManager {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly store: AccountStore,
  ) {}

  /**
   * The declarative settings schema for a provider (drives the Admin form).
   * Schema is account-independent, so no account id is required.
   */
  async schema(integrationId: IntegrationId): Promise<SettingsSchema> {
    return this.registry.get(integrationId).settings("");
  }

  /** The current settings for a connected account. */
  async get(accountId: string): Promise<IntegrationSettings> {
    const account = await this.requireAccount(accountId);
    return account.settings;
  }

  /** Validate a settings patch without persisting (Admin "Test" button). */
  async validate(
    integrationId: IntegrationId,
    patch: IntegrationSettings,
  ): Promise<ValidationResult> {
    return this.registry.get(integrationId).validate(patch);
  }

  /** Validate + persist a settings patch, returning the merged result. */
  async update(accountId: string, patch: IntegrationSettings): Promise<IntegrationSettings> {
    const account = await this.requireAccount(accountId);
    return this.registry.get(account.integrationId).settings(accountId, patch);
  }

  private async requireAccount(accountId: string) {
    const account = await this.store.get(accountId);
    if (!account) {
      throw new IntegrationError("not_connected", `Account "${accountId}" was not found.`);
    }
    return account;
  }
}
