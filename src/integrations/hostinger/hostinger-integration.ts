/**
 * HostingerIntegration — the Hostinger VPS infrastructure provider adapter.
 *
 * Extends {@link BaseIntegration} (Health Check = inherited `healthCheck`) and
 * *additionally* implements {@link InfrastructurePort} by delegating to the shared
 * {@link InfrastructureService}. A VPS serves **all five** checks (deployment,
 * storage, DNS, SSL, server). STATUS: placeholder — no API is contacted;
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
import { HostingerClient } from "./hostinger-client";
import type { HostingerClientConfig } from "./types";

export const HOSTINGER_METADATA: IntegrationMetadata = {
  id: "hostinger",
  displayName: "Hostinger VPS",
  description: "Monitor a Hostinger VPS: server info, SSL, storage, deployment and DNS.",
  category: "other",
  scope: "org",
  auth: "api_token",
  capabilities: ["infra.status"],
  supportsWebhooks: false,
  available: false,
};

const SUPPORTED_CHECKS: readonly InfrastructureCheck[] = [
  "server",
  "ssl",
  "storage",
  "deployment",
  "dns",
];

export class HostingerIntegration extends BaseIntegration implements InfrastructurePort {
  readonly metadata = HOSTINGER_METADATA;

  private readonly infra: InfrastructureService;

  constructor(store: AccountStore, config: HostingerClientConfig = {}) {
    super(store);
    this.infra = new InfrastructureService(new HostingerClient(config), SUPPORTED_CHECKS);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Hostinger connect (API token validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Hostinger sync");
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    return notImplemented("Hostinger health check (GET /vps/virtual-machines/{id})");
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "virtualMachineId",
          label: "VPS id",
          type: "string",
          required: true,
          help: "The Hostinger virtual machine id to monitor.",
        },
        {
          key: "diskWarnPct",
          label: "Disk warning threshold (%)",
          type: "number",
          required: false,
          default: 85,
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
