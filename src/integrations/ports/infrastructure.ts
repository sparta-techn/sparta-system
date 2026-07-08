/**
 * InfrastructurePort — the capability port for infrastructure-status providers
 * (Supabase, Cloudflare, Hostinger VPS).
 *
 * Exposes the operational status reads SpartaFlow's Owner Dashboard surfaces:
 * deployment, storage, DNS, SSL and server information. Like the other capability
 * ports (Architecture doc §5) it is vendor-neutral — a feature renders a status
 * tile without naming Supabase/Cloudflare/Hostinger.
 *
 * Liveness ("Health Check") is the inherited {@link import("../types").Integration}
 * `healthCheck` lifecycle method, so it is not repeated here. Providers differ in
 * which of the five reads they can serve, declared via {@link InfrastructurePort.supportedChecks};
 * an unsupported read returns a `not_supported` status rather than throwing.
 *
 * Types only — no adapter here calls a network.
 */

/** The five infrastructure reads (Health Check is the inherited lifecycle probe). */
export type InfrastructureCheck = "deployment" | "storage" | "dns" | "ssl" | "server";

/** Every check, in display order. */
export const INFRASTRUCTURE_CHECKS: readonly InfrastructureCheck[] = [
  "deployment",
  "storage",
  "dns",
  "ssl",
  "server",
];

/** Normalized status of a single infrastructure aspect. */
export type InfraState = "operational" | "degraded" | "down" | "unknown" | "not_supported";

/** Shared fields on every status DTO. */
export interface InfraStatusBase {
  state: InfraState;
  /** ISO instant the status was read. */
  checkedAt: string;
  detail?: string;
}

// ── Deployment ───────────────────────────────────────────────────────────────

export type DeploymentPhase = "queued" | "building" | "live" | "failed" | "rolled_back";

export interface DeploymentStatus extends InfraStatusBase {
  environment?: string;
  /** Commit sha or release tag currently deployed. */
  version?: string;
  deploymentId?: string;
  deployedAt?: string;
  url?: string;
  phase?: DeploymentPhase;
}

// ── Storage ──────────────────────────────────────────────────────────────────

export interface StorageBucketUsage {
  name: string;
  objectCount?: number;
  bytesUsed: number;
}

export interface StorageStatus extends InfraStatusBase {
  bytesUsed: number;
  bytesLimit?: number;
  buckets?: readonly StorageBucketUsage[];
}

// ── DNS ──────────────────────────────────────────────────────────────────────

export interface DnsRecordStatus {
  type: string;
  name: string;
  value: string;
  /** e.g. Cloudflare proxied (orange-cloud) records. */
  proxied?: boolean;
  healthy: boolean;
}

export interface DnsStatus extends InfraStatusBase {
  zone?: string;
  records: readonly DnsRecordStatus[];
  /** Whether recent changes have propagated. */
  propagated?: boolean;
}

// ── SSL ──────────────────────────────────────────────────────────────────────

export interface SslStatus extends InfraStatusBase {
  host?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  autoRenew?: boolean;
}

// ── Server information ─────────────────────────────────────────────────────────

export interface ServerInfo extends InfraStatusBase {
  hostname?: string;
  region?: string;
  os?: string;
  cpuCores?: number;
  memoryMb?: number;
  diskGb?: number;
  diskUsedGb?: number;
  uptimeSeconds?: number;
  ipAddress?: string;
}

// ── The port ─────────────────────────────────────────────────────────────────

/**
 * Read-only infrastructure status for one connected account. Scoped by
 * `accountId` so a single adapter instance serves many connected accounts.
 */
export interface InfrastructurePort {
  /** Which of the five reads this provider can serve. */
  readonly supportedChecks: readonly InfrastructureCheck[];

  /** True when `check` is in {@link supportedChecks}. */
  supports(check: InfrastructureCheck): boolean;

  getDeploymentStatus(accountId: string): Promise<DeploymentStatus>;
  getStorageStatus(accountId: string): Promise<StorageStatus>;
  getDnsStatus(accountId: string): Promise<DnsStatus>;
  getSslStatus(accountId: string): Promise<SslStatus>;
  getServerInfo(accountId: string): Promise<ServerInfo>;
}

/** Structural guard: does an adapter implement the infrastructure port? */
export function isInfrastructurePort(value: unknown): value is InfrastructurePort {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.getDeploymentStatus === "function" &&
    typeof candidate.getServerInfo === "function" &&
    typeof candidate.supports === "function" &&
    Array.isArray(candidate.supportedChecks)
  );
}
