/**
 * SupabasePlatformClient — the Supabase implementation of {@link InfrastructureTransport}.
 *
 * The ONLY file that will call the Supabase Management API (Architecture doc
 * §4/§9). Every method maps a Management API response onto the neutral
 * infrastructure DTOs — all `notImplemented` today, so no API is contacted. The
 * shared service only calls the methods Supabase advertises (deployment, storage,
 * ssl, server); `getDnsStatus` exists to satisfy the interface but is never
 * invoked (Supabase does not manage DNS).
 */

import { notImplemented } from "../services/errors";
import type { DeploymentStatus, DnsStatus, ServerInfo, SslStatus, StorageStatus } from "../ports";
import type { InfrastructureTransport } from "../infrastructure";
import type { SupabasePlatformClientConfig } from "./types";

export class SupabasePlatformClient implements InfrastructureTransport {
  constructor(private readonly config: SupabasePlatformClientConfig = {}) {}

  /** Project status + latest migration/deploy (`GET /v1/projects/{ref}`). */
  async getDeploymentStatus(accountId: string): Promise<DeploymentStatus> {
    return notImplemented(`SupabasePlatformClient.getDeploymentStatus (account ${accountId})`);
  }

  /** Storage bucket usage (`GET /v1/projects/{ref}/storage/buckets`). */
  async getStorageStatus(accountId: string): Promise<StorageStatus> {
    return notImplemented(`SupabasePlatformClient.getStorageStatus (account ${accountId})`);
  }

  /** Not supported — Supabase does not manage DNS (never called by the service). */
  async getDnsStatus(accountId: string): Promise<DnsStatus> {
    return notImplemented(`SupabasePlatformClient.getDnsStatus (account ${accountId})`);
  }

  /** Custom-domain certificate (`GET /v1/projects/{ref}/custom-hostname`). */
  async getSslStatus(accountId: string): Promise<SslStatus> {
    return notImplemented(`SupabasePlatformClient.getSslStatus (account ${accountId})`);
  }

  /** Compute instance size / region (`GET /v1/projects/{ref}`). */
  async getServerInfo(accountId: string): Promise<ServerInfo> {
    return notImplemented(`SupabasePlatformClient.getServerInfo (account ${accountId})`);
  }
}
