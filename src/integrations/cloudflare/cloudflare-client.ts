/**
 * CloudflareClient — the Cloudflare implementation of {@link InfrastructureTransport}.
 *
 * The ONLY file that will call the Cloudflare API (Architecture doc §4/§9). Every
 * method maps a Cloudflare API response onto the neutral infrastructure DTOs —
 * all `notImplemented` today. The shared service only calls the checks Cloudflare
 * advertises (dns, ssl, deployment, storage); `getServerInfo` satisfies the
 * interface but is never invoked (Cloudflare is edge — there is no server).
 */

import { notImplemented } from "../services/errors";
import type {
  DeploymentStatus,
  DnsStatus,
  ServerInfo,
  SslStatus,
  StorageStatus,
} from "../ports";
import type { InfrastructureTransport } from "../infrastructure";
import type { CloudflareClientConfig } from "./types";

export class CloudflareClient implements InfrastructureTransport {
  constructor(private readonly config: CloudflareClientConfig = {}) {}

  /** Latest Pages/Workers deployment (`GET /accounts/{id}/pages/projects/.../deployments`). */
  async getDeploymentStatus(accountId: string): Promise<DeploymentStatus> {
    return notImplemented(`CloudflareClient.getDeploymentStatus (account ${accountId})`);
  }

  /** R2 bucket usage (`GET /accounts/{id}/r2/buckets`). */
  async getStorageStatus(accountId: string): Promise<StorageStatus> {
    return notImplemented(`CloudflareClient.getStorageStatus (account ${accountId})`);
  }

  /** Zone DNS records (`GET /zones/{id}/dns_records`). */
  async getDnsStatus(accountId: string): Promise<DnsStatus> {
    return notImplemented(`CloudflareClient.getDnsStatus (account ${accountId})`);
  }

  /** Edge certificate status (`GET /zones/{id}/ssl/certificate_packs`). */
  async getSslStatus(accountId: string): Promise<SslStatus> {
    return notImplemented(`CloudflareClient.getSslStatus (account ${accountId})`);
  }

  /** Not supported — Cloudflare is edge, no server (never called by the service). */
  async getServerInfo(accountId: string): Promise<ServerInfo> {
    return notImplemented(`CloudflareClient.getServerInfo (account ${accountId})`);
  }
}
