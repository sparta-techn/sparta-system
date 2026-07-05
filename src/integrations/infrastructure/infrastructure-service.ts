/**
 * InfrastructureService — the shared {@link InfrastructurePort} implementation.
 *
 * Written once and reused by every infrastructure provider: it composes a
 * vendor-specific {@link InfrastructureTransport} with the provider's
 * `supportedChecks` and applies one uniform rule — a check the provider doesn't
 * advertise returns a `not_supported` status **without any client call**; a
 * supported check delegates to the transport. Providers differ only in their
 * transport + which checks they support, so this stays vendor-blind (composition
 * over duplication, CLAUDE.md).
 *
 * The support/not-supported logic is real; the vendor transport is the placeholder.
 */

import type {
  DeploymentStatus,
  DnsStatus,
  InfraStatusBase,
  InfrastructureCheck,
  InfrastructurePort,
  ServerInfo,
  SslStatus,
  StorageStatus,
} from "../ports";
import type { InfrastructureTransport } from "./infrastructure-transport";

export class InfrastructureService implements InfrastructurePort {
  constructor(
    private readonly transport: InfrastructureTransport,
    readonly supportedChecks: readonly InfrastructureCheck[],
  ) {}

  supports(check: InfrastructureCheck): boolean {
    return this.supportedChecks.includes(check);
  }

  async getDeploymentStatus(accountId: string): Promise<DeploymentStatus> {
    if (!this.supports("deployment")) return this.unsupported("deployment");
    return this.transport.getDeploymentStatus(accountId);
  }

  async getStorageStatus(accountId: string): Promise<StorageStatus> {
    if (!this.supports("storage")) return { ...this.unsupported("storage"), bytesUsed: 0 };
    return this.transport.getStorageStatus(accountId);
  }

  async getDnsStatus(accountId: string): Promise<DnsStatus> {
    if (!this.supports("dns")) return { ...this.unsupported("dns"), records: [] };
    return this.transport.getDnsStatus(accountId);
  }

  async getSslStatus(accountId: string): Promise<SslStatus> {
    if (!this.supports("ssl")) return this.unsupported("ssl");
    return this.transport.getSslStatus(accountId);
  }

  async getServerInfo(accountId: string): Promise<ServerInfo> {
    if (!this.supports("server")) return this.unsupported("server");
    return this.transport.getServerInfo(accountId);
  }

  /**
   * A base `not_supported` status. Assignable to every status DTO because their
   * extra fields are all optional — so callers get the correct return type
   * (StorageStatus/DnsStatus add their one required field at the call site).
   */
  private unsupported(check: InfrastructureCheck): InfraStatusBase {
    return {
      state: "not_supported",
      checkedAt: new Date().toISOString(),
      detail: `"${check}" is not available for this provider.`,
    };
  }
}
