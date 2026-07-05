/**
 * InfrastructureTransport — the neutral client seam every infrastructure provider
 * implements.
 *
 * The shared {@link import("./infrastructure-service").InfrastructureService}
 * depends on this interface, not on any vendor client, so the
 * supports/not-supported guard logic is written once and reused by Supabase /
 * Cloudflare / Hostinger. Each provider's `*-client.ts` implements this seam and
 * is the ONLY place that will touch the vendor API (Architecture doc §4/§9);
 * today every method routes through `notImplemented`, and it is only ever called
 * for checks the provider advertises.
 */

import type {
  DeploymentStatus,
  DnsStatus,
  ServerInfo,
  SslStatus,
  StorageStatus,
} from "../ports";

export interface InfrastructureTransport {
  getDeploymentStatus(accountId: string): Promise<DeploymentStatus>;
  getStorageStatus(accountId: string): Promise<StorageStatus>;
  getDnsStatus(accountId: string): Promise<DnsStatus>;
  getSslStatus(accountId: string): Promise<SslStatus>;
  getServerInfo(accountId: string): Promise<ServerInfo>;
}
