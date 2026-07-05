/**
 * Zapier domain types — the shapes Zapier *speaks*.
 *
 * Zapier is webhook-first: SpartaFlow triggers a Zap by POSTing to its Catch Hook
 * URL, which returns a request id but **no queryable run status**. These types
 * cover that surface; the client maps them onto the neutral automation DTOs.
 */

/** Response from a Zapier Catch Hook POST. */
export interface ZapierHookResponse {
  status: "success";
  /** Zapier request id — the closest thing to a run id. */
  requestId: string;
  attempt?: number;
}

export interface ZapierClientConfig {
  /** Catch Hook base, e.g. https://hooks.zapier.com/hooks/catch/. */
  hookBaseUrl?: string;
  resolveSecret?: (accountId: string) => Promise<string>;
  signatureHeader?: string;
}
