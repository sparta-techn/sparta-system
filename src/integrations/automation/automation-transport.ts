/**
 * AutomationTransport — the neutral client seam every automation provider
 * implements.
 *
 * The shared {@link import("./automation-service").AutomationService} depends on
 * this interface, not on any vendor client, so the reliability logic (retry
 * queue, DLQ, webhook pump) is written once and reused by n8n / Zapier / Make.
 * Each provider's `*-client.ts` implements this seam and is the ONLY place that
 * will touch the vendor API (Architecture doc §4/§9) — today every method routes
 * through `notImplemented`.
 */

import type {
  OutgoingWebhookMessage,
  RawWebhookDelivery,
  WorkflowRun,
  WorkflowTriggerRequest,
} from "../ports";

export interface AutomationTransport {
  /** Trigger a workflow, returning the neutral run (vendor mapping lives here). */
  triggerWorkflow(accountId: string, request: WorkflowTriggerRequest): Promise<WorkflowRun>;

  /** Read a run's status, mapped to the neutral {@link WorkflowRun}. */
  getWorkflowStatus(accountId: string, runId: string): Promise<WorkflowRun>;

  /** POST an outgoing webhook to the provider; resolves to the provider msg id. */
  postWebhook(accountId: string, message: OutgoingWebhookMessage): Promise<{ id: string }>;

  /** Constant-time signature verification of a raw inbound delivery. */
  verifySignature(accountId: string, delivery: RawWebhookDelivery): Promise<boolean>;
}
