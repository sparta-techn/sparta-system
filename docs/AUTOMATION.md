# Automation Integrations — n8n, Zapier, Make

Architecture for three **workflow-automation** providers. SpartaFlow triggers
external workflows, reads their status, and exchanges webhooks with them — all
through one vendor-neutral capability port, backed by shared delivery-reliability
infrastructure (retry queue + dead-letter queue).

> **Status: architecture only — no external API is called yet.**
> The *transport* to each provider (n8n / Zapier / Make) is a `notImplemented`
> client seam. The *reliability infrastructure* (retry queue, DLQ capture) is real
> internal plumbing — it makes no external calls — so the retry → dead-letter
> pipeline works end-to-end today; only the vendor delivery and the DLQ **replay**
> are placeholders. Each provider stays `available: false` until its client is wired.

These extend the platform in
[`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) /
[`src/integrations/README.md`](../src/integrations/README.md), following the same
two-layer shape as the other capability providers
([`docs/GITHUB.md`](./GITHUB.md), [`docs/NOTIFICATIONS.md`](./NOTIFICATIONS.md)):
the generic six-method `Integration` lifecycle **plus** a capability port.

---

## Supported features

| Feature | Where it lives | Status |
|---|---|---|
| **Incoming Webhooks** | `AutomationPort.parseIncomingWebhook` — verify signature + parse. | Verify seam placeholder. |
| **Outgoing Webhooks** | `AutomationPort.sendOutgoingWebhook` — emit; queue-on-failure. | Transport placeholder. |
| **Workflow Trigger** | `AutomationPort.triggerWorkflow`. | Transport placeholder. |
| **Workflow Status** | `AutomationPort.getWorkflowStatus`. | Transport placeholder. |
| **Retry Queue** | `RetryQueue` + `InMemoryRetryQueue` (backoff scheduler). | **Working** (in-memory). |
| **Dead Letter Queue** | `DeadLetterQueue` + `InMemoryDeadLetterQueue`. | Capture works; `replay` placeholder. |

---

## The capability port — `AutomationPort`

Declared in `src/integrations/ports/automation.ts` and implemented by all three
providers. It bundles the automation surface plus accessors to the reliability
queues:

```ts
interface AutomationPort {
  triggerWorkflow(accountId, req: WorkflowTriggerRequest): Promise<WorkflowRun>;
  getWorkflowStatus(accountId, runId: string): Promise<WorkflowRun>;
  sendOutgoingWebhook(accountId, msg: OutgoingWebhookMessage): Promise<WebhookDeliveryResult>;
  parseIncomingWebhook(accountId, raw: RawWebhookDelivery): Promise<IncomingWebhookEvent>;
  processDueRetries(accountId): Promise<RetryRunSummary>;   // the retry pump
  readonly retryQueue: RetryQueue;
  readonly deadLetterQueue: DeadLetterQueue;
}
```

Workflow status is normalized across vendors to a single `WorkflowRunStatus`
(`queued | running | succeeded | failed | cancelled | unknown`), so a feature
reads a run without knowing whose it is:

```ts
import { getIntegrationRegistry, isAutomationPort } from "@/integrations";

const provider = getIntegrationRegistry().get("n8n");
if (isAutomationPort(provider)) {
  const run = await provider.triggerWorkflow(accountId, {
    workflowId: "wf_123",
    payload: { sprintId: "s-42" },
    idempotencyKey: "sprint-close-42",
  });
  const status = await provider.getWorkflowStatus(accountId, run.id);
}
```

New capability tags: `"automation.workflow"` and `"webhook.outbound"` (added to
`IntegrationCapability`, alongside the existing `"webhook.inbound"`).

---

## Delivery reliability (Retry Queue + DLQ)

The reliability machinery is **vendor-neutral and shared** — written once in
`src/integrations/automation/` and reused by every provider (composition over
duplication). The vendor-specific part is only the transport.

```
src/integrations/automation/
  automation-transport.ts    # AutomationTransport — the neutral client seam
  automation-service.ts      # AutomationService — implements AutomationPort (shared)
  retry-queue.ts             # InMemoryRetryQueue + exponential backoff (working)
  dead-letter-queue.ts       # InMemoryDeadLetterQueue (capture works; replay placeholder)
  index.ts
```

### Outgoing delivery lifecycle

```
sendOutgoingWebhook
   │  transport.postWebhook  ── notImplemented today
   ├─ success ─▶ DeliveryResult { state: "delivered", externalId }
   └─ failure ─▶ retryQueue.enqueue()  ─▶ DeliveryResult { state: "queued", detail=<error> }

processDueRetries  (a scheduler calls this on due items)
   for each due delivery:
     transport.postWebhook
       ├─ success ─▶ retryQueue.recordSuccess()
       └─ failure ─▶ retryQueue.recordFailure()
                        ├─ attempts left  ─▶ reschedule (backoff)
                        └─ exhausted      ─▶ DeadLetterEntry ─▶ deadLetterQueue.add()
```

Nothing is silently dropped: a failed send becomes `queued` (with the transport
error preserved in `lastError`), retries back off exponentially
(`DEFAULT_RETRY_POLICY`: 5 attempts, 1s → 5m, ×2), and an exhausted delivery is
dead-lettered. Because the queues make no network calls, this whole pipeline is
real and unit-testable today — only the `postWebhook` transport is a placeholder,
so in practice every delivery currently ends up `queued` then eventually
dead-lettered.

### Retry policy & backoff

`RetryPolicy { maxAttempts, baseDelayMs, maxDelayMs, factor, jitter }`;
`nextBackoffMs(policy, attempt) = min(maxDelayMs, baseDelayMs · factor^(attempt-1))`
(optionally jittered). `InMemoryRetryQueue` is the seam a durable, Supabase-backed
queue slots into later — same interface, persistent rows.

### Dead-letter queue (placeholder)

`InMemoryDeadLetterQueue` captures exhausted deliveries (`add` / `list` / `purge`
work in-memory) so the pipeline completes, but **`replay(id)` is `notImplemented`**
— re-dispatching a dead-lettered delivery needs the vendor transport that isn't
wired. The class is the seam for a durable `integration_dead_letters` table with
RLS + an Admin replay UI.

---

## Per-provider shape

Each provider is a thin folder; the shared service does the heavy lifting.

```
src/integrations/<provider>/
  types.ts                 # vendor DTOs (executions) + client config
  <provider>-client.ts     # implements AutomationTransport; maps vendor→neutral; notImplemented seams
  <provider>-integration.ts# adapter: BaseIntegration + AutomationPort (delegates to AutomationService)
  index.ts
```

The client is the only vendor-specific code: it maps the provider's execution
status onto `WorkflowRunStatus` and (later) verifies that provider's webhook
signature. Lifecycle concerns — Connection, Validation, Health Check, Settings,
Sync — are all inherited from `BaseIntegration`.

### n8n — `src/integrations/n8n/`
- `auth: "api_token"` (n8n API key), webhooks on. Full execution status
  (`new/waiting`→queued, `running`, `success`→succeeded, `error`→failed,
  `canceled`→cancelled).
- Settings: `baseUrl` (required), `defaultWorkflowId`.

### Zapier — `src/integrations/zapier/`
- `auth: "webhook_secret"` (Catch Hook), webhooks on. Webhook-first: a trigger
  POSTs to a Catch Hook and returns a request id. Zapier exposes **no run-status
  API**, so `getWorkflowStatus` honestly returns `unknown` with no network call —
  a genuine capability gap surfaced rather than faked.
- Settings: `catchHookUrl` (required), `signingSecret`.

### Make — `src/integrations/make/`
- `auth: "api_token"`, webhooks on. Full execution status (`pending`→queued,
  `running`, `success`→succeeded, `warning`→succeeded, `error`→failed).
- Settings: `apiBaseUrl` (required, region-specific), `defaultScenarioId`.

---

## Inbound webhooks

`parseIncomingWebhook(accountId, raw)` verifies the signature
(`transport.verifySignature`, constant-time per Architecture doc §8 — placeholder
today) and parses the body into a neutral `IncomingWebhookEvent` (`eventType`,
`signatureValid`, `payload`). This is the method the shared
`/api/webhooks/<integrationId>` route (Architecture doc §8) will call before
enqueuing a domain event — verification and parsing never live inline in the HTTP
handler.

---

## Boundaries the design keeps

- **One capability, three vendors.** All three implement `AutomationPort`; a
  feature triggers workflows and emits events without naming n8n/Zapier/Make.
- **Reliability is shared, not copied.** `AutomationService` + the queues are
  written once; providers contribute only a transport (Open/Closed).
- **One transport seam per provider.** Each `*-client.ts` is the only file that
  will touch the vendor API — the single place to audit auth, retries, rate
  limits and signature verification (Architecture doc §9). `idempotencyKey`
  threads through triggers and webhooks.
- **Honest placeholders.** Failed sends are `queued`, not fake-`delivered`;
  Zapier's missing status API returns `unknown`; DLQ `replay` is explicitly
  `notImplemented`.
- **Strict TypeScript, no `any`** — verified with `npx tsc --noEmit`.

---

## Wiring a real provider (the only future change)

1. Fill that provider's `*-client.ts`: implement the private `*Raw` seams
   (resolve the credential via `config.resolve*`, call the API), and
   `verifySignature` (constant-time HMAC over the raw body).
2. Implement the three placeholder vendor hooks in `*-integration.ts`
   (`authenticate`, `performSync`, `probe`).
3. Swap `InMemoryRetryQueue` / `InMemoryDeadLetterQueue` for the durable
   Supabase-backed implementations (same interfaces) in the integration
   constructor, and implement DLQ `replay`.
4. Flip `available: true` in the provider's metadata.

The `AutomationPort`, `AutomationService`, the retry/DLQ interfaces, the registry,
hooks and every other adapter stay untouched.

---

## Related

- [`docs/NOTIFICATIONS.md`](./NOTIFICATIONS.md) — `NotifierPort` providers.
- [`docs/GITHUB.md`](./GITHUB.md) — `VcsActivityPort` provider.
- [`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) — full platform design (§8 webhooks, §9 resilience).
