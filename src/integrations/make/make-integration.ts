/**
 * MakeIntegration — the Make (Integromat) provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link AutomationPort} by delegating to the shared {@link AutomationService}
 * (Make transport + in-memory retry queue + DLQ). STATUS: placeholder — no Make
 * scenario is contacted; `available` stays false until the client is wired.
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
import { MakeClient } from "./make-client";
import type { MakeClientConfig } from "./types";

export const MAKE_METADATA: IntegrationMetadata = {
  id: "make",
  displayName: "Make",
  description: "Trigger Make scenarios and exchange webhooks with delivery retries.",
  category: "other",
  scope: "org",
  auth: "api_token",
  capabilities: ["automation.workflow", "webhook.inbound", "webhook.outbound"],
  supportsWebhooks: true,
  available: false,
};

export class MakeIntegration extends BaseIntegration implements AutomationPort {
  readonly metadata = MAKE_METADATA;

  private readonly automation: AutomationService;

  constructor(store: AccountStore, config: MakeClientConfig = {}) {
    super(store);
    this.automation = new AutomationService(
      new MakeClient(config),
      new InMemoryRetryQueue(),
      new InMemoryDeadLetterQueue(),
    );
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Make connect (API token validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Make sync");
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    return notImplemented("Make health check (GET /scenarios)");
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "apiBaseUrl",
          label: "API base URL",
          type: "string",
          required: true,
          help: "Region-specific Make API base, e.g. https://eu1.make.com/api/v2.",
        },
        {
          key: "defaultScenarioId",
          label: "Default scenario id",
          type: "string",
          required: false,
          help: "Scenario triggered when a caller omits an explicit id.",
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
