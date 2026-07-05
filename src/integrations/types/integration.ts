/**
 * The generic Integration contract — the heart of the platform.
 *
 * Every provider adapter implements this single interface. Callers (registry,
 * manager, features) depend only on it, never on a concrete class or a vendor
 * SDK — exactly the role `AIProvider` plays in `src/ai/types/provider.ts`.
 *
 * The six lifecycle methods are universal. Anything domain-specific (send a
 * Slack message, list ClickUp tasks) belongs on a capability *port*, not here,
 * so this contract stays stable as providers proliferate.
 */

import type {
  HealthState,
  IntegrationAuthKind,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationId,
  IntegrationScope,
} from "./common";

/** Static, code-level description of a provider. No secrets, no runtime state. */
export interface IntegrationMetadata {
  readonly id: IntegrationId;
  readonly displayName: string;
  readonly description: string;
  readonly category: IntegrationCategory;
  readonly scope: IntegrationScope;
  readonly auth: IntegrationAuthKind;
  readonly capabilities: readonly IntegrationCapability[];
  /** Whether this provider emits inbound webhooks. */
  readonly supportsWebhooks: boolean;
  /**
   * When false, the adapter is a placeholder (no external calls implemented).
   * Lets the UI show "Coming soon" without a separate flag list.
   */
  readonly available: boolean;
}

/** JSON-serializable per-account configuration (channel ids, filters, toggles). */
export type IntegrationSettings = Record<string, unknown>;

/**
 * A persisted connection between SpartaFlow and an external account.
 *
 * `credentialRef` is an opaque handle to encrypted credentials — the plaintext
 * token never lives on this object and is never returned to the client.
 */
export interface IntegrationAccountData {
  id: string;
  integrationId: IntegrationId;
  scope: IntegrationScope;
  /** User id (scope="user") or org id (scope="org"). */
  ownerId: string;
  /** Identifier on the provider side (e.g. Slack team id). */
  externalAccountId: string;
  status: "active" | "revoked" | "error";
  /** Opaque handle to encrypted credentials (see SettingsManager / crypto). */
  credentialRef: string;
  settings: IntegrationSettings;
  createdAt: string;
  updatedAt: string;
}

// ── Method payloads (neutral DTOs, no vendor-specific fields) ─────────────────

/** The credential material handed to `connect()`, tagged by kind. */
export type ConnectCredential =
  | { kind: "oauth_code"; code: string; redirectUri: string }
  | { kind: "api_token"; token: string }
  | { kind: "webhook_secret"; secret: string };

export interface ConnectInput {
  scope: IntegrationScope;
  ownerId: string;
  credential: ConnectCredential;
  /** Optional initial settings applied on connect. */
  settings?: IntegrationSettings;
}

export interface SyncInput {
  accountId: string;
  /** Incremental cursor from the previous run; absent = full sync. */
  since?: string;
  signal?: AbortSignal;
}

export interface SyncResult {
  ok: boolean;
  itemsProcessed: number;
  /** Cursor to persist and pass as `since` on the next run. */
  nextCursor?: string;
  /** Non-fatal issues encountered during the run. */
  errors: string[];
  /** ISO timestamp the run finished. */
  finishedAt: string;
}

export interface HealthStatus {
  state: HealthState;
  checkedAt: string;
  /** Round-trip latency of the probe, ms. */
  latencyMs?: number;
  detail?: string;
}

/** One field a provider accepts in its settings — drives the Admin form. */
export interface SettingsField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "secret";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
  help?: string;
}

/** Declarative description of the settings a provider accepts. */
export interface SettingsSchema {
  fields: readonly SettingsField[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field?: string; message: string }>;
}

/**
 * The contract every provider adapter implements. Six methods, no more.
 *
 * Concrete adapters extend `BaseIntegration` (shared behaviour) and stay thin.
 */
export interface Integration {
  /** Static description; no runtime state, no secrets. */
  readonly metadata: IntegrationMetadata;

  /**
   * (1) Establish a connection: exchange the credential, resolve the external
   * account identity, persist an encrypted account, return it. Idempotent per
   * (integrationId, ownerId, externalAccountId).
   */
  connect(input: ConnectInput): Promise<IntegrationAccountData>;

  /**
   * (2) Tear down a connection: revoke where possible, drop webhooks, mark the
   * account revoked and purge credentials. Safe to call when already
   * disconnected (no-op).
   */
  disconnect(accountId: string): Promise<void>;

  /**
   * (3) Pull/push data for one account. Incremental when `since` is supplied.
   * Must be resumable and idempotent — a re-run with the same cursor is safe.
   */
  sync(input: SyncInput): Promise<SyncResult>;

  /**
   * (4) Cheap, read-only liveness/credential probe. Feeds the status model and
   * the Admin health page.
   */
  healthCheck(accountId: string): Promise<HealthStatus>;

  /**
   * (5) The settings surface. With no patch, returns the declarative schema (to
   * render the form). With a patch, validates + persists it and returns the
   * merged settings.
   */
  settings(accountId: string): Promise<SettingsSchema>;
  settings(accountId: string, patch: IntegrationSettings): Promise<IntegrationSettings>;

  /**
   * (6) Validate a prospective connection or settings patch WITHOUT persisting.
   * Called by connect()/settings() and by the Admin "Test connection" button.
   */
  validate(input: ConnectInput | IntegrationSettings): Promise<ValidationResult>;
}
