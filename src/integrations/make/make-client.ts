/**
 * MakeClient — the Make implementation of {@link AutomationTransport}.
 *
 * The ONLY file that will call the Make API or verify a Make webhook signature
 * (Architecture doc §4/§9). Public transport methods map vendor shapes onto the
 * neutral automation DTOs; the private `*Raw` seams are where the HTTP lives —
 * all `notImplemented` today, so no Make scenario is contacted.
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
import type { MakeClientConfig, MakeExecution, MakeExecutionStatus } from "./types";

export class MakeClient implements AutomationTransport {
  constructor(private readonly config: MakeClientConfig = {}) {}

  async triggerWorkflow(accountId: string, request: WorkflowTriggerRequest): Promise<WorkflowRun> {
    const execution = await this.runScenarioRaw(accountId, request);
    return toWorkflowRun(execution);
  }

  async getWorkflowStatus(accountId: string, runId: string): Promise<WorkflowRun> {
    const execution = await this.getExecutionRaw(accountId, runId);
    return toWorkflowRun(execution);
  }

  async postWebhook(accountId: string, message: OutgoingWebhookMessage): Promise<{ id: string }> {
    return notImplemented(
      `MakeClient.postWebhook (account ${accountId}, event ${message.eventType})`,
    );
  }

  async verifySignature(accountId: string, delivery: RawWebhookDelivery): Promise<boolean> {
    return notImplemented(`MakeClient.verifySignature (account ${accountId})`);
  }

  // ── Raw vendor seams (HTTP goes here once wired) ─────────────────────────────

  private async runScenarioRaw(
    accountId: string,
    request: WorkflowTriggerRequest,
  ): Promise<MakeExecution> {
    return notImplemented(
      `MakeClient.runScenario (account ${accountId}, scenario ${request.workflowId})`,
    );
  }

  private async getExecutionRaw(accountId: string, runId: string): Promise<MakeExecution> {
    return notImplemented(`MakeClient.getExecution (account ${accountId}, run ${runId})`);
  }
}

const STATUS_MAP: Record<MakeExecutionStatus, WorkflowRunStatus> = {
  pending: "queued",
  running: "running",
  success: "succeeded",
  // A warning is a completed run with non-fatal issues — treated as succeeded.
  warning: "succeeded",
  error: "failed",
};

/** Pure map: Make execution → neutral workflow run. */
function toWorkflowRun(execution: MakeExecution): WorkflowRun {
  return {
    id: execution.id,
    workflowId: execution.scenarioId,
    status: STATUS_MAP[execution.status] ?? "unknown",
    startedAt: execution.startedAt,
    finishedAt: execution.finishedAt,
    error: execution.detail,
  };
}
