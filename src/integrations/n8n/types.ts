/**
 * n8n domain types — the shapes n8n *speaks*.
 *
 * A subset of the n8n REST API (executions) SpartaFlow reads, plus config. The
 * vendor-specific counterpart to the neutral automation DTOs in
 * `../ports/automation.ts`; the client maps these onto the neutral `WorkflowRun`.
 */

/** n8n execution status vocabulary. */
export type N8nExecutionStatus = "new" | "running" | "success" | "error" | "canceled" | "waiting";

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  status: N8nExecutionStatus;
  startedAt?: string;
  stoppedAt?: string;
  /** Present on `status: "error"`. */
  errorMessage?: string;
}

export interface N8nWebhookResponse {
  id: string;
}

export interface N8nClientConfig {
  /** n8n instance base URL (self-hosted or cloud). */
  baseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
  /** Header carrying the HMAC signature on inbound webhooks. */
  signatureHeader?: string;
}
