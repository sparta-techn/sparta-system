/**
 * SupabasePlatformIntegration — the Supabase infrastructure provider adapter.
 *
 * Extends {@link BaseIntegration} (Health Check = inherited `healthCheck`) and
 * *additionally* implements {@link InfrastructurePort} by delegating to the shared
 * {@link InfrastructureService}. Supabase serves deployment, storage, SSL and
 * server reads — **not** DNS (it doesn't manage DNS), which returns
 * `not_supported`. STATUS: placeholder — no Management API is contacted;
 * `available` stays false until the client is wired.
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
  DeploymentStatus,
  DnsStatus,
  InfrastructureCheck,
  InfrastructurePort,
  ServerInfo,
  SslStatus,
  StorageStatus,
} from "../ports";
import { BaseIntegration, type AuthenticatedIdentity } from "../providers/base-integration";
import { notImplemented } from "../services/errors";
import { InfrastructureService } from "../infrastructure";
import { SupabasePlatformClient } from "./supabase-platform-client";
import type { SupabasePlatformClientConfig } from "./types";

export const SUPABASE_METADATA: IntegrationMetadata = {
  id: "supabase",
  displayName: "Supabase",
  description: "Monitor the Supabase project: deployment, storage, SSL and compute status.",
  category: "other",
  scope: "org",
  auth: "api_token",
  capabilities: ["infra.status"],
  supportsWebhooks: false,
  available: false,
};

const SUPPORTED_CHECKS: readonly InfrastructureCheck[] = ["deployment", "storage", "ssl", "server"];

export class SupabasePlatformIntegration extends BaseIntegration implements InfrastructurePort {
  readonly metadata = SUPABASE_METADATA;

  private readonly infra: InfrastructureService;

  constructor(store: AccountStore, config: SupabasePlatformClientConfig = {}) {
    super(store);
    this.infra = new InfrastructureService(new SupabasePlatformClient(config), SUPPORTED_CHECKS);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Supabase connect (Management API token validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Supabase sync");
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    return notImplemented("Supabase health check (GET /v1/projects/{ref})");
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "projectRef",
          label: "Project ref",
          type: "string",
          required: true,
          help: "The Supabase project ref to monitor.",
        },
        {
          key: "storageWarnPct",
          label: "Storage warning threshold (%)",
          type: "number",
          required: false,
          default: 80,
        },
      ],
    };
  }

  // ── InfrastructurePort — delegated to the shared service ─────────────────────

  get supportedChecks(): readonly InfrastructureCheck[] {
    return this.infra.supportedChecks;
  }

  supports(check: InfrastructureCheck): boolean {
    return this.infra.supports(check);
  }

  getDeploymentStatus(accountId: string): Promise<DeploymentStatus> {
    return this.infra.getDeploymentStatus(accountId);
  }

  getStorageStatus(accountId: string): Promise<StorageStatus> {
    return this.infra.getStorageStatus(accountId);
  }

  getDnsStatus(accountId: string): Promise<DnsStatus> {
    return this.infra.getDnsStatus(accountId);
  }

  getSslStatus(accountId: string): Promise<SslStatus> {
    return this.infra.getSslStatus(accountId);
  }

  getServerInfo(accountId: string): Promise<ServerInfo> {
    return this.infra.getServerInfo(accountId);
  }
}
