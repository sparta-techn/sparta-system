/**
 * AutomationService — the shared {@link AutomationPort} implementation.
 *
 * Written once and reused by every automation provider: it composes a
 * vendor-specific {@link AutomationTransport} with a {@link RetryQueue} and a
 * {@link DeadLetterQueue} and implements the reliability logic (queue-on-failure,
 * backoff pump, dead-letter on exhaustion). Providers differ only in their
 * transport (vendor mapping + signature scheme), so this class stays vendor-blind
 * — composition over duplication (CLAUDE.md).
 *
 * The retry/DLQ plumbing is real; the vendor transport is the placeholder. Today
 * an outgoing webhook can't reach the provider, so it is honestly reported as
 * `queued` (with the transport error preserved) rather than pretended delivered.
 */

import type {
  AutomationPort,
  DeadLetterQueue,
  IncomingWebhookEvent,
  OutgoingWebhookMessage,
  RawWebhookDelivery,
  RetryQueue,
  RetryRunSummary,
  WebhookDeliveryResult,
  WorkflowRun,
  WorkflowTriggerRequest,
} from "../ports";
import type { AutomationTransport } from "./automation-transport";

let eventCounter = 0;

export class AutomationService implements AutomationPort {
  constructor(
    private readonly transport: AutomationTransport,
    readonly retryQueue: RetryQueue,
    readonly deadLetterQueue: DeadLetterQueue,
  ) {}

  triggerWorkflow(accountId: string, request: WorkflowTriggerRequest): Promise<WorkflowRun> {
    return this.transport.triggerWorkflow(accountId, request);
  }

  getWorkflowStatus(accountId: string, runId: string): Promise<WorkflowRun> {
    return this.transport.getWorkflowStatus(accountId, runId);
  }

  async sendOutgoingWebhook(
    accountId: string,
    message: OutgoingWebhookMessage,
  ): Promise<WebhookDeliveryResult> {
    try {
      const { id } = await this.transport.postWebhook(accountId, message);
      return { id, state: "delivered", attempts: 1, externalId: id };
    } catch (error) {
      // Nothing is dropped: park the delivery in the retry queue and report it.
      const detail = errorMessage(error);
      const queued = this.retryQueue.enqueue({ accountId, message, error: detail });
      return { id: queued.id, state: "queued", attempts: queued.attempts, detail };
    }
  }

  async parseIncomingWebhook(
    accountId: string,
    delivery: RawWebhookDelivery,
  ): Promise<IncomingWebhookEvent> {
    const signatureValid = await this.transport.verifySignature(accountId, delivery);
    const payload = parseBody(delivery.body);
    eventCounter += 1;
    return {
      id: `evt_${Date.now().toString(36)}_${eventCounter}`,
      eventType: typeof payload.event === "string" ? payload.event : "unknown",
      signatureValid,
      receivedAt: delivery.receivedAt,
      payload,
    };
  }

  async processDueRetries(accountId: string): Promise<RetryRunSummary> {
    const due = this.retryQueue.due().filter((item) => item.accountId === accountId);
    let delivered = 0;
    let requeued = 0;
    let deadLettered = 0;

    for (const item of due) {
      try {
        await this.transport.postWebhook(accountId, item.message);
        this.retryQueue.recordSuccess(item.id);
        delivered += 1;
      } catch (error) {
        const dead = this.retryQueue.recordFailure(item.id, errorMessage(error));
        if (dead) {
          await this.deadLetterQueue.add(dead);
          deadLettered += 1;
        } else {
          requeued += 1;
        }
      }
    }

    return { attempted: due.length, delivered, requeued, deadLettered };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Parse a webhook body to an object; non-object/invalid bodies become `{}`. */
function parseBody(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
