/**
 * N8nIntegration — the n8n provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link AutomationPort} by delegating to the shared {@link AutomationService}
 * (wired with the n8n transport + an in-memory retry queue + DLQ). STATUS:
 * placeholder — no n8n instance is contacted; `available` stays false until the
 * client is wired.
 */

import type {
  ConnectInput,
  IntegrationAccountData,
  IntegrationMetadata,
  SettingsSchema,
  SyncInput,
  SyncResult,
} from "../types";
import type { AccountStore } from "../services/account-store";
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
import { BaseIntegration, type AuthenticatedIdentity } from "../providers/base-integration";
import { notImplemented } from "../services/errors";
import {
  AutomationService,
  InMemoryDeadLetterQueue,
  InMemoryRetryQueue,
} from "../automation";
import { N8nClient } from "./n8n-client";
import type { N8nClientConfig } from "./types";

export const N8N_METADATA: IntegrationMetadata = {
  id: "n8n",
  displayName: "n8n",
  description: "Trigger n8n workflows and exchange webhooks with delivery retries.",
  category: "other",
  scope: "org",
  auth: "api_token",
  capabilities: ["automation.workflow", "webhook.inbound", "webhook.outbound"],
  supportsWebhooks: true,
  available: false,
};

export class N8nIntegration extends BaseIntegration implements AutomationPort {
  readonly metadata = N8N_METADATA;

  private readonly automation: AutomationService;

  constructor(store: AccountStore, config: N8nClientConfig = {}) {
    super(store);
    this.automation = new AutomationService(
      new N8nClient(config),
      new InMemoryRetryQueue(),
      new InMemoryDeadLetterQueue(),
    );
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("n8n connect (API key validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("n8n sync");
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    return notImplemented("n8n health check (GET /workflows)");
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "baseUrl",
          label: "Instance URL",
          type: "string",
          required: true,
          help: "Your n8n instance base URL (self-hosted or cloud).",
        },
        {
          key: "defaultWorkflowId",
          label: "Default workflow id",
          type: "string",
          required: false,
          help: "Workflow triggered when a caller omits an explicit id.",
        },
      ],
    };
  }

  // ── AutomationPort — delegated to the shared service ─────────────────────────

  triggerWorkflow(accountId: string, request: WorkflowTriggerRequest): Promise<WorkflowRun> {
    return this.automation.triggerWorkflow(accountId, request);
  }

  getWorkflowStatus(accountId: string, runId: string): Promise<WorkflowRun> {
    return this.automation.getWorkflowStatus(accountId, runId);
  }

  sendOutgoingWebhook(
    accountId: string,
    message: OutgoingWebhookMessage,
  ): Promise<WebhookDeliveryResult> {
    return this.automation.sendOutgoingWebhook(accountId, message);
  }

  parseIncomingWebhook(
    accountId: string,
    delivery: RawWebhookDelivery,
  ): Promise<IncomingWebhookEvent> {
    return this.automation.parseIncomingWebhook(accountId, delivery);
  }

  processDueRetries(accountId: string): Promise<RetryRunSummary> {
    return this.automation.processDueRetries(accountId);
  }

  get retryQueue(): RetryQueue {
    return this.automation.retryQueue;
  }

  get deadLetterQueue(): DeadLetterQueue {
    return this.automation.deadLetterQueue;
  }
}
