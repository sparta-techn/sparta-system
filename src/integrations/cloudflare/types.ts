/**
 * Cloudflare provider config.
 *
 * Monitoring adapter for Cloudflare: DNS zones/records, edge SSL certificates,
 * Pages/Workers deployments and R2 storage. Reads go through the Cloudflare API
 * with a scoped API token.
 */

export interface CloudflareClientConfig {
  /** Cloudflare API base, e.g. https://api.cloudflare.com/client/v4. */
  apiBaseUrl?: string;
  /** Zone id monitored for DNS/SSL. */
  zoneId?: string;
  /** Account id monitored for Pages/Workers/R2. */
  accountIdentifier?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}
