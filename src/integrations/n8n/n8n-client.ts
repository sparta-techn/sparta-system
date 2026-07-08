/**
 * N8nClient — the n8n implementation of {@link AutomationTransport}.
 *
 * The ONLY file that will call the n8n API or verify an n8n webhook signature
 * (Architecture doc §4/§9). Public transport methods map vendor shapes onto the
 * neutral automation DTOs; the private `*Raw` seams are where the HTTP lives —
 * all `notImplemented` today, so no n8n instance is contacted.
 */

import { notImplemented } from "../services/errors";
import type {
  OutgoingWebhookMessage,
  RawWebhookDelivery,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowTriggerRequest,
} from "../ports";
import type { AutomationTransport } from "../automation";
import type { N8nClientConfig, N8nExecution, N8nExecutionStatus } from "./types";

export class N8nClient implements AutomationTransport {
  constructor(private readonly config: N8nClientConfig = {}) {}

  async triggerWorkflow(accountId: string, request: WorkflowTriggerRequest): Promise<WorkflowRun> {
    const execution = await this.runWorkflowRaw(accountId, request);
    return toWorkflowRun(execution);
  }

  async getWorkflowStatus(accountId: string, runId: string): Promise<WorkflowRun> {
    const execution = await this.getExecutionRaw(accountId, runId);
    return toWorkflowRun(execution);
  }

  async postWebhook(accountId: string, message: OutgoingWebhookMessage): Promise<{ id: string }> {
    return notImplemented(
      `N8nClient.postWebhook (account ${accountId}, event ${message.eventType})`,
    );
  }

  async verifySignature(accountId: string, delivery: RawWebhookDelivery): Promise<boolean> {
    return notImplemented(`N8nClient.verifySignature (account ${accountId})`);
  }

  // ── Raw vendor seams (HTTP goes here once wired) ─────────────────────────────

  private async runWorkflowRaw(
    accountId: string,
    request: WorkflowTriggerRequest,
  ): Promise<N8nExecution> {
    return notImplemented(
      `N8nClient.runWorkflow (account ${accountId}, workflow ${request.workflowId})`,
    );
  }

  private async getExecutionRaw(accountId: string, runId: string): Promise<N8nExecution> {
    return notImplemented(`N8nClient.getExecution (account ${accountId}, run ${runId})`);
  }
}

const STATUS_MAP: Record<N8nExecutionStatus, WorkflowRunStatus> = {
  new: "queued",
  waiting: "queued",
  running: "running",
  success: "succeeded",
  error: "failed",
  canceled: "cancelled",
};

/** Pure map: n8n execution → neutral workflow run. */
function toWorkflowRun(execution: N8nExecution): WorkflowRun {
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    status: STATUS_MAP[execution.status] ?? "unknown",
    startedAt: execution.startedAt,
    finishedAt: execution.stoppedAt,
    error: execution.errorMessage,
  };
}
