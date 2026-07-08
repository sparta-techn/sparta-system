/**
 * HostingerClient — the Hostinger implementation of {@link InfrastructureTransport}.
 *
 * The ONLY file that will call the Hostinger API (Architecture doc §4/§9). Every
 * method maps a Hostinger API response onto the neutral infrastructure DTOs — all
 * `notImplemented` today. A VPS serves all five checks, so every method here is
 * reachable once wired.
 */

import { notImplemented } from "../services/errors";
import type { DeploymentStatus, DnsStatus, ServerInfo, SslStatus, StorageStatus } from "../ports";
import type { InfrastructureTransport } from "../infrastructure";
import type { HostingerClientConfig } from "./types";

export class HostingerClient implements InfrastructureTransport {
  constructor(private readonly config: HostingerClientConfig = {}) {}

  /** Latest app deployment on the VPS. */
  async getDeploymentStatus(accountId: string): Promise<DeploymentStatus> {
    return notImplemented(`HostingerClient.getDeploymentStatus (account ${accountId})`);
  }

  /** Disk usage on the VPS. */
  async getStorageStatus(accountId: string): Promise<StorageStatus> {
    return notImplemented(`HostingerClient.getStorageStatus (account ${accountId})`);
  }

  /** Managed DNS zone records. */
  async getDnsStatus(accountId: string): Promise<DnsStatus> {
    return notImplemented(`HostingerClient.getDnsStatus (account ${accountId})`);
  }

  /** Hosted certificate status. */
  async getSslStatus(accountId: string): Promise<SslStatus> {
    return notImplemented(`HostingerClient.getSslStatus (account ${accountId})`);
  }

  /** VPS specs / region / uptime (`GET /vps/virtual-machines/{id}`). */
  async getServerInfo(accountId: string): Promise<ServerInfo> {
    return notImplemented(`HostingerClient.getServerInfo (account ${accountId})`);
  }
}
