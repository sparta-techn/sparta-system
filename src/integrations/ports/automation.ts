/**
 * AutomationPort — the capability port for workflow-automation providers
 * (n8n, Zapier, Make).
 *
 * Bundles the automation surface SpartaFlow needs: trigger a workflow, read its
 * status, send outgoing webhooks, verify + parse incoming webhooks, and drive the
 * delivery-reliability machinery (retry queue + dead-letter queue). Like the
 * other capability ports (Architecture doc §5) it is vendor-neutral: a feature
 * fires a workflow or emits an event without naming n8n/Zapier/Make.
 *
 * The reliability infrastructure (RetryQueue / DeadLetterQueue) is real internal
 * plumbing — it touches no external API. The *transport* to each provider is the
 * placeholder: every vendor call routes through a `notImplemented` client seam.
 */

// ── Workflows ────────────────────────────────────────────────────────────────

export interface WorkflowRef {
  id: string;
  name?: string;
}

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "unknown";

export interface WorkflowRun {
  /** Provider run/execution id. */
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Deep link to the run on the provider. */
  externalUrl?: string;
}

export interface WorkflowTriggerRequest {
  workflowId: string;
  /** Arbitrary JSON payload handed to the workflow. */
  payload: Record<string, unknown>;
  /** Idempotency key so a retried trigger doesn't double-run the workflow. */
  idempotencyKey?: string;
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

/** A raw inbound HTTP delivery, before verification/parsing. */
export interface RawWebhookDelivery {
  headers: Record<string, string>;
  /** Raw request body (verified as bytes/text before JSON parse). */
  body: string;
  receivedAt: string;
}

/** A verified + parsed inbound webhook. */
export interface IncomingWebhookEvent {
  id: string;
  eventType: string;
  /** Whether the signature check passed (constant-time, per Architecture §8). */
  signatureValid: boolean;
  receivedAt: string;
  payload: Record<string, unknown>;
}

/** An event SpartaFlow emits to a provider endpoint. */
export interface OutgoingWebhookMessage {
  eventType: string;
  payload: Record<string, unknown>;
  /** Target endpoint; the provider resolves a configured default when omitted. */
  endpoint?: string;
  /** Idempotency key forwarded as a header where the provider supports it. */
  idempotencyKey?: string;
}

export type WebhookDeliveryState =
  | "delivered"
  | "queued"
  | "retrying"
  | "dead_lettered"
  | "failed";

export interface WebhookDeliveryResult {
  /** Delivery id (also the retry-queue id when queued). */
  id: string;
  state: WebhookDeliveryState;
  attempts: number;
  externalId?: string;
  detail?: string;
}

// ── Retry queue + dead-letter queue (delivery reliability) ───────────────────

/** Exponential-backoff retry policy for a queued delivery. */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Backoff multiplier per attempt. */
  factor: number;
  /** Add randomized jitter to spread retries. */
  jitter: boolean;
}

export interface DeliveryAttempt {
  attempt: number;
  at: string;
  state: WebhookDeliveryState;
  detail?: string;
}

/** An outgoing delivery awaiting (re)attempt in the retry queue. */
export interface QueuedDelivery {
  id: string;
  accountId: string;
  message: OutgoingWebhookMessage;
  attempts: number;
  policy: RetryPolicy;
  /** ISO instant the next attempt becomes due. */
  nextAttemptAt: string;
  lastError?: string;
  history: readonly DeliveryAttempt[];
}

/** A delivery that exhausted its retries — parked for inspection/replay. */
export interface DeadLetterEntry {
  id: string;
  accountId: string;
  message: OutgoingWebhookMessage;
  attempts: number;
  reason: string;
  deadLetteredAt: string;
}

export interface EnqueueInput {
  accountId: string;
  message: OutgoingWebhookMessage;
  /** The error from the initial (failed) delivery attempt. */
  error?: string;
  /** Override the default retry policy. */
  policy?: RetryPolicy;
}

/**
 * A durable-ish buffer of outgoing deliveries pending retry. The in-memory
 * implementation is the seam a Supabase-backed queue slots into later; it makes
 * no external calls.
 */
export interface RetryQueue {
  /** Record a failed delivery and schedule its first retry. */
  enqueue(input: EnqueueInput): QueuedDelivery;
  /** Deliveries whose `nextAttemptAt` is at//before `now` (default: current time). */
  due(now?: Date): readonly QueuedDelivery[];
  /** Mark a delivery delivered — removes it from the queue. */
  recordSuccess(id: string): void;
  /**
   * Record a failed retry. Returns a {@link DeadLetterEntry} when the delivery
   * has now exhausted its attempts (caller routes it to the DLQ), else null.
   */
  recordFailure(id: string, error: string): DeadLetterEntry | null;
  peek(id: string): QueuedDelivery | undefined;
  size(): number;
}

/**
 * Terminal store for deliveries that exhausted retries. **Placeholder**: capture
 * (`add`/`list`/`purge`) is an in-memory scaffold; `replay` (re-emitting through
 * the provider) is `notImplemented` until the transport is wired.
 */
export interface DeadLetterQueue {
  add(entry: DeadLetterEntry): Promise<void>;
  list(accountId: string): Promise<readonly DeadLetterEntry[]>;
  /** Re-dispatch a dead-lettered delivery — placeholder (needs the provider API). */
  replay(id: string): Promise<void>;
  purge(id: string): Promise<void>;
}

/** Outcome of one retry-queue pump. */
export interface RetryRunSummary {
  attempted: number;
  delivered: number;
  requeued: number;
  deadLettered: number;
}

// ── The port ─────────────────────────────────────────────────────────────────

/**
 * Workflow automation for one connected account. Scoped by `accountId` so a
 * single adapter instance serves many connected accounts.
 */
export interface AutomationPort {
  /** Fire a workflow and return its (initial) run. */
  triggerWorkflow(accountId: string, request: WorkflowTriggerRequest): Promise<WorkflowRun>;

  /** Read the current status of a workflow run. */
  getWorkflowStatus(accountId: string, runId: string): Promise<WorkflowRun>;

  /**
   * Emit an outgoing webhook. On a transport error the delivery is enqueued for
   * retry and a `queued` result is returned (nothing is silently dropped).
   */
  sendOutgoingWebhook(
    accountId: string,
    message: OutgoingWebhookMessage,
  ): Promise<WebhookDeliveryResult>;

  /** Verify a raw inbound delivery's signature and parse it into an event. */
  parseIncomingWebhook(
    accountId: string,
    delivery: RawWebhookDelivery,
  ): Promise<IncomingWebhookEvent>;

  /** Pump due retries: re-attempt each, moving the exhausted ones to the DLQ. */
  processDueRetries(accountId: string): Promise<RetryRunSummary>;

  /** The outgoing-delivery retry buffer. */
  readonly retryQueue: RetryQueue;
  /** The dead-letter store for exhausted deliveries (replay is placeholder). */
  readonly deadLetterQueue: DeadLetterQueue;
}

/** Structural guard: does an adapter implement the automation port? */
export function isAutomationPort(value: unknown): value is AutomationPort {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.triggerWorkflow === "function" &&
    typeof candidate.sendOutgoingWebhook === "function" &&
    typeof candidate.processDueRetries === "function" &&
    typeof candidate.retryQueue === "object" &&
    typeof candidate.deadLetterQueue === "object"
  );
}
