/**
 * CloudflareIntegration — the Cloudflare infrastructure provider adapter.
 *
 * Extends {@link BaseIntegration} (Health Check = inherited `healthCheck`) and
 * *additionally* implements {@link InfrastructurePort} by delegating to the shared
 * {@link InfrastructureService}. Cloudflare serves DNS, SSL, deployment and
 * storage reads — **not** server info (edge platform), which returns
 * `not_supported`. STATUS: placeholder — no API is contacted; `available` stays
 * false until the client is wired.
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
import { CloudflareClient } from "./cloudflare-client";
import type { CloudflareClientConfig } from "./types";

export const CLOUDFLARE_METADATA: IntegrationMetadata = {
  id: "cloudflare",
  displayName: "Cloudflare",
  description: "Monitor Cloudflare: DNS, edge SSL, Pages/Workers deployments and R2 storage.",
  category: "other",
  scope: "org",
  auth: "api_token",
  capabilities: ["infra.status"],
  supportsWebhooks: false,
  available: false,
};

const SUPPORTED_CHECKS: readonly InfrastructureCheck[] = ["dns", "ssl", "deployment", "storage"];

export class CloudflareIntegration extends BaseIntegration implements InfrastructurePort {
  readonly metadata = CLOUDFLARE_METADATA;

  private readonly infra: InfrastructureService;

  constructor(store: AccountStore, config: CloudflareClientConfig = {}) {
    super(store);
    this.infra = new InfrastructureService(new CloudflareClient(config), SUPPORTED_CHECKS);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Cloudflare connect (API token validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Cloudflare sync");
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    return notImplemented("Cloudflare health check (GET /user/tokens/verify)");
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "zoneId",
          label: "Zone id",
          type: "string",
          required: false,
          help: "Zone monitored for DNS and SSL status.",
        },
        {
          key: "accountIdentifier",
          label: "Account id",
          type: "string",
          required: false,
          help: "Account monitored for Pages/Workers deployments and R2 storage.",
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
