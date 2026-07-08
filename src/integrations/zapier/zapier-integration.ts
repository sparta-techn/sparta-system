/**
 * ZapierIntegration — the Zapier provider adapter.
 *
 * Extends {@link BaseIntegration} and *additionally* implements
 * {@link AutomationPort} by delegating to the shared {@link AutomationService}
 * (Zapier transport + in-memory retry queue + DLQ). STATUS: placeholder — no
 * Zapier hook is contacted; `available` stays false until the client is wired.
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
import { AutomationService, InMemoryDeadLetterQueue, InMemoryRetryQueue } from "../automation";
import { ZapierClient } from "./zapier-client";
import type { ZapierClientConfig } from "./types";

export const ZAPIER_METADATA: IntegrationMetadata = {
  id: "zapier",
  displayName: "Zapier",
  description: "Trigger Zaps via Catch Hooks and exchange webhooks with delivery retries.",
  category: "other",
  scope: "org",
  auth: "webhook_secret",
  capabilities: ["automation.workflow", "webhook.inbound", "webhook.outbound"],
  supportsWebhooks: true,
  available: false,
};

export class ZapierIntegration extends BaseIntegration implements AutomationPort {
  readonly metadata = ZAPIER_METADATA;

  private readonly automation: AutomationService;

  constructor(store: AccountStore, config: ZapierClientConfig = {}) {
    super(store);
    this.automation = new AutomationService(
      new ZapierClient(config),
      new InMemoryRetryQueue(),
      new InMemoryDeadLetterQueue(),
    );
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("Zapier connect (Catch Hook secret validation)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("Zapier sync");
  }

  protected async probe(_account: IntegrationAccountData): Promise<void> {
    return notImplemented("Zapier health check (hook reachability)");
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "catchHookUrl",
          label: "Catch Hook URL",
          type: "string",
          required: true,
          help: "The Zapier Catch Hook URL workflow triggers POST to.",
        },
        {
          key: "signingSecret",
          label: "Signing secret",
          type: "secret",
          required: false,
          help: "Shared secret used to verify inbound Zapier webhooks.",
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
