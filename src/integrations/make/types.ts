/**
 * Make (Integromat) domain types — the shapes Make *speaks*.
 *
 * A subset of the Make API (scenario executions) SpartaFlow reads, plus config.
 * The client maps these onto the neutral automation DTOs in `../ports/automation.ts`.
 */

/** Make scenario execution status vocabulary. */
export type MakeExecutionStatus = "pending" | "running" | "success" | "warning" | "error";

export interface MakeExecution {
  id: string;
  scenarioId: string;
  status: MakeExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
  /** Present on `status: "error"`. */
  detail?: string;
}

export interface MakeWebhookResponse {
  id: string;
}

export interface MakeClientConfig {
  /** Make API base (region-specific, e.g. https://eu1.make.com/api/v2). */
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
  signatureHeader?: string;
}
