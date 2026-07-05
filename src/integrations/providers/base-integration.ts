/**
 * BaseIntegration — abstract base every provider adapter extends.
 *
 * Concrete adapters implement only the vendor-specific hooks (`authenticate`,
 * `performSync`, `probe`, `settingsSchema`); the shared lifecycle plumbing —
 * account persistence, settings merge/validate, health timing — lives here so no
 * adapter re-implements it. This is the same split `BaseAIProvider` uses in
 * `src/ai/providers/base-provider.ts`.
 *
 * IMPORTANT: no external API calls are made in this file. Persistence flows
 * through the injected {@link AccountStore}; network work belongs to the vendor
 * hooks, which today are offline placeholders.
 */

import { IntegrationAccount } from "../models";
import type {
  ConnectInput,
  HealthStatus,
  Integration,
  IntegrationAccountData,
  IntegrationMetadata,
  IntegrationSettings,
  SettingsSchema,
  SyncInput,
  SyncResult,
  ValidationResult,
} from "../types";
import type { AccountStore } from "../services/account-store";
import { IntegrationError } from "../services/errors";

/** Result an adapter returns from its credential exchange. */
export interface AuthenticatedIdentity {
  externalAccountId: string;
  /** Opaque handle to encrypted credentials (crypto lives outside this layer). */
  credentialRef: string;
}

export abstract class BaseIntegration implements Integration {
  abstract readonly metadata: IntegrationMetadata;

  constructor(protected readonly store: AccountStore) {}

  // ── Vendor-specific hooks (implemented by concrete adapters) ────────────────

  /** Exchange the connect credential for the external identity + a stored ref. */
  protected abstract authenticate(input: ConnectInput): Promise<AuthenticatedIdentity>;

  /** Perform the actual data pull/push for one account. */
  protected abstract performSync(
    account: IntegrationAccountData,
    input: SyncInput,
  ): Promise<SyncResult>;

  /** Cheap liveness probe. Throw to signal "down". */
  protected abstract probe(account: IntegrationAccountData): Promise<void>;

  /** The settings fields this provider accepts. */
  protected abstract settingsSchema(): SettingsSchema;

  /** Optional per-adapter extra validation of a settings patch. */
  protected async validateSettings(_settings: IntegrationSettings): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  }

  // ── Shared lifecycle (implemented once, for all providers) ──────────────────

  async connect(input: ConnectInput): Promise<IntegrationAccountData> {
    const check = await this.validate(input);
    if (!check.valid) {
      throw new IntegrationError("invalid_request", "Connection input is invalid.", {
        details: check.errors,
      });
    }

    const identity = await this.authenticate(input);
    const account = IntegrationAccount.create({
      integrationId: this.metadata.id,
      input,
      externalAccountId: identity.externalAccountId,
      credentialRef: identity.credentialRef,
    });
    return this.store.save(account);
  }

  async disconnect(accountId: string): Promise<void> {
    const account = await this.store.get(accountId);
    if (!account || account.status === "revoked") return; // idempotent no-op
    await this.store.setStatus(accountId, "revoked");
  }

  async sync(input: SyncInput): Promise<SyncResult> {
    const account = await this.requireActiveAccount(input.accountId);
    return this.performSync(account, input);
  }

  async healthCheck(accountId: string): Promise<HealthStatus> {
    const account = await this.store.get(accountId);
    if (!account) {
      return { state: "down", checkedAt: new Date().toISOString(), detail: "Account not found." };
    }
    const startedAt = Date.now();
    try {
      await this.probe(account);
      return {
        state: account.status === "active" ? "healthy" : "degraded",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        state: "down",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Overload signatures mirror the Integration contract.
  settings(accountId: string): Promise<SettingsSchema>;
  settings(accountId: string, patch: IntegrationSettings): Promise<IntegrationSettings>;
  async settings(
    accountId: string,
    patch?: IntegrationSettings,
  ): Promise<SettingsSchema | IntegrationSettings> {
    if (patch === undefined) return this.settingsSchema();

    const check = await this.validate(patch);
    if (!check.valid) {
      throw new IntegrationError("invalid_request", "Settings are invalid.", {
        details: check.errors,
      });
    }
    const account = await this.requireActiveAccount(accountId);
    const merged = { ...account.settings, ...patch };
    const saved = await this.store.updateSettings(account.id, merged);
    return saved.settings;
  }

  async validate(input: ConnectInput | IntegrationSettings): Promise<ValidationResult> {
    if (isConnectInput(input)) {
      return this.validateConnect(input);
    }
    // A settings patch — check declared required fields, then adapter extras.
    const schemaErrors = this.checkRequiredFields(input);
    if (schemaErrors.length > 0) return { valid: false, errors: schemaErrors };
    return this.validateSettings(input);
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────

  /** Baseline connect validation shared by all adapters; override to extend. */
  protected validateConnect(input: ConnectInput): ValidationResult {
    const errors: ValidationResult["errors"] = [];
    if (!input.ownerId) errors.push({ field: "ownerId", message: "An owner id is required." });
    if (input.scope !== this.metadata.scope) {
      errors.push({
        field: "scope",
        message: `${this.metadata.displayName} connects at "${this.metadata.scope}" scope.`,
      });
    }
    if (!credentialMatchesAuth(input, this.metadata)) {
      errors.push({
        field: "credential",
        message: `Expected a "${this.metadata.auth}" credential.`,
      });
    }
    return { valid: errors.length === 0, errors };
  }

  private checkRequiredFields(settings: IntegrationSettings): ValidationResult["errors"] {
    return this.settingsSchema()
      .fields.filter((f) => f.required && settings[f.key] === undefined)
      .map((f) => ({ field: f.key, message: `"${f.label}" is required.` }));
  }

  protected async requireActiveAccount(accountId: string): Promise<IntegrationAccountData> {
    const account = await this.store.get(accountId);
    if (!account) {
      throw new IntegrationError("not_connected", `Account "${accountId}" was not found.`);
    }
    if (account.status !== "active") {
      throw new IntegrationError("not_connected", `Account "${accountId}" is not active.`);
    }
    return account;
  }
}

/** Narrow a validate() argument to a {@link ConnectInput}. */
function isConnectInput(input: ConnectInput | IntegrationSettings): input is ConnectInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "credential" in input &&
    "scope" in input &&
    "ownerId" in input
  );
}

/** Confirm the supplied credential kind matches the provider's declared auth. */
function credentialMatchesAuth(input: ConnectInput, metadata: IntegrationMetadata): boolean {
  switch (metadata.auth) {
    case "oauth2":
      return input.credential.kind === "oauth_code";
    case "api_token":
      return input.credential.kind === "api_token";
    case "webhook_secret":
      return input.credential.kind === "webhook_secret";
    default:
      return false;
  }
}
