/**
 * ZapierClient — the Zapier implementation of {@link AutomationTransport}.
 *
 * The ONLY file that will call Zapier or verify a Zapier signature (Architecture
 * doc §4/§9). Network seams are `notImplemented`. `getWorkflowStatus` needs no
 * network: Zapier exposes no run-status API, so it honestly returns `unknown`
 * (a genuine capability gap, surfaced rather than faked).
 */

import { notImplemented } from "../services/errors";
import type {
  OutgoingWebhookMessage,
  RawWebhookDelivery,
  WorkflowRun,
  WorkflowTriggerRequest,
} from "../ports";
import type { AutomationTransport } from "../automation";
import type { ZapierClientConfig, ZapierHookResponse } from "./types";

export class ZapierClient implements AutomationTransport {
  constructor(private readonly config: ZapierClientConfig = {}) {}

  async triggerWorkflow(
    accountId: string,
    request: WorkflowTriggerRequest,
  ): Promise<WorkflowRun> {
    const response = await this.postCatchHookRaw(accountId, request);
    return {
      id: response.requestId,
      workflowId: request.workflowId,
      status: "queued",
    };
  }

  async getWorkflowStatus(_accountId: string, runId: string): Promise<WorkflowRun> {
    // No network: Zapier has no run-status endpoint.
    return { id: runId, workflowId: "", status: "unknown" };
  }

  async postWebhook(
    accountId: string,
    message: OutgoingWebhookMessage,
  ): Promise<{ id: string }> {
    return notImplemented(`ZapierClient.postWebhook (account ${accountId}, event ${message.eventType})`);
  }

  async verifySignature(accountId: string, delivery: RawWebhookDelivery): Promise<boolean> {
    return notImplemented(`ZapierClient.verifySignature (account ${accountId})`);
  }

  // ── Raw vendor seam (HTTP goes here once wired) ──────────────────────────────

  private async postCatchHookRaw(
    accountId: string,
    request: WorkflowTriggerRequest,
  ): Promise<ZapierHookResponse> {
    return notImplemented(`ZapierClient.postCatchHook (account ${accountId}, zap ${request.workflowId})`);
  }
}
