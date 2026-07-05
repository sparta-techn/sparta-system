/**
 * Hostinger VPS provider config.
 *
 * Monitoring adapter for a Hostinger VPS: server specs/uptime, hosted SSL certs,
 * disk storage, app deployment and managed DNS. Reads go through the Hostinger
 * API with an API token; a VPS exposes the full set of five checks.
 */

export interface HostingerClientConfig {
  /** Hostinger API base, e.g. https://developers.hostinger.com/api. */
  apiBaseUrl?: string;
  /** The VPS/virtual-machine id being monitored. */
  virtualMachineId?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}
