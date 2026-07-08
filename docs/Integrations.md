# Integrations Architecture — SpartaFlow Hub

External systems are reached through a **modular integration layer** (Ports & Adapters). Business logic depends on **ports** (interfaces); each integration provides an **adapter** that implements them. Swapping ClickUp for Linear, or adding GitLab next to GitHub, never touches business logic.

---

## 1. Architectural Pattern

```text
Feature Use-Case ──► Port (interface in domain/)
                          ▲
                          │ implemented by
                          ▼
                    Adapter (integrations/<provider>/adapter.ts)
                          │
                          ▼
                    Client (SDK / HTTP)
```

- Ports live in `domain/ports/` or per-feature `domain/ports/`.
- Adapters live in `src/integrations/<provider>/`.
- A composition root (`src/integrations/registry.ts`) wires concrete adapters at boot.

---

## 2. Capabilities per Integration

| Integration            | Direction              | Capabilities                                                                                                           |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **ClickUp**            | both                   | Read projects/tasks for linking in reports & dependencies; webhook on task status changes; deep-links from SpartaFlow. |
| **GitHub**             | inbound                | Commits, PRs, reviews per user (opt-in performance signal).                                                            |
| **GitLab**             | inbound                | Same as GitHub for GitLab-using teams.                                                                                 |
| **Slack**              | outbound + interactive | Notifications to DMs/channels; slash commands (`/sparta status`); interactive buttons (ack dependency).                |
| **Discord**            | outbound               | Notifications mirror (where Slack is unavailable).                                                                     |
| **Google Calendar**    | bidirectional          | Sync leaves; surface core working hours.                                                                               |
| **Google Meet**        | outbound link          | Generate meeting links for managers.                                                                                   |
| **Figma**              | inbound                | Active file signals for designers (opt-in).                                                                            |
| **Postman**            | inbound                | Collection runs / monitor results (QA signals).                                                                        |
| **AI Services**        | both                   | Summarization, risk detection, suggestions. Provider-agnostic.                                                         |
| **Email (Resend/SES)** | outbound               | Transactional emails.                                                                                                  |

---

## 3. Adapter Contract (Common)

Every adapter implements:

```text
interface ProviderAdapter {
  id: ProviderId
  connect(input): Promise<IntegrationAccount>
  disconnect(accountId): Promise<void>
  health(accountId): Promise<HealthStatus>
  capabilities(): Capability[]
}
```

Per-capability ports, e.g.:

```text
interface TaskProviderPort {
  listProjects(): Promise<ExternalProject[]>
  getTask(id): Promise<ExternalTask>
  searchTasks(q): Promise<ExternalTask[]>
}

interface ChatNotifierPort {
  notifyUser(userId, message: NotificationMessage): Promise<DeliveryResult>
  notifyChannel(channelId, message): Promise<DeliveryResult>
}
```

Features depend on ports, not providers. `notifications` calls `ChatNotifierPort`; the registry returns Slack or Discord based on configuration.

---

## 4. Authentication & Credentials

- OAuth where supported (ClickUp, GitHub, GitLab, Google, Figma, Slack).
- API tokens fallback (encrypted, stored in `integration_accounts.credentials`, encrypted at app layer with a Vault-stored key).
- Refresh tokens rotated automatically; failures alert Super Admin.
- Per-user vs per-org connections: each integration declares its scope.

---

## 5. Inbound Webhooks

- Routed via `/api/webhooks/<provider>`.
- Each handler:
  1. Verifies signature in constant time.
  2. Persists raw payload in `integration_events`.
  3. Acks within 5 s.
  4. Enqueues a domain event for async processing.
- Replay supported via Admin UI.

---

## 6. Outbound Calls

- All outbound HTTP wrapped in `httpClient` with: timeout (defaults 5 s), retry (idempotent only), circuit breaker, structured logging.
- Per-provider rate-limit awareness; backoff respects `Retry-After`.
- Open circuit visibly disables the feature surface ("Slack notifications paused").

---

## 7. Domain Event Bus

- Source of all integration triggers.
- Events: `attendance.late`, `dependency.opened`, `dependency.escalated`, `report.submitted`, `announcement.published`, `leave.approved`.
- Subscribers (adapters) are registered explicitly; never call adapters from use-cases directly.
- Persisted via `domain_event_outbox` and dispatched by a worker — guarantees at-least-once delivery with idempotent handlers.

---

## 8. AI Services Layer

AI is a _port_, not a vendor:

```text
interface AIPort {
  summarize(text, opts): Promise<Summary>
  classifyBlocker(text): Promise<BlockerInsight>
  embed(text): Promise<Vector>
  chat(stream): AsyncIterable<Token>
}
```

- Default provider configurable (Lovable AI Gateway, OpenAI, Anthropic, local).
- Inputs are PII-scrubbed before leaving the system.
- Output is treated as untrusted (never executed, sanitized on render).
- Usage metered per user/feature; quotas enforced.

---

## 9. Linking Model

`integration_links` maps SpartaFlow entities ↔ external entities:

| SpartaFlow | External                                  |
| ---------- | ----------------------------------------- |
| Project    | ClickUp space, GitHub repo, Figma project |
| User       | Slack user, GitHub login, Google email    |
| Team       | Slack channel, ClickUp list               |

Links are managed in Admin and respected by the UI for deep-linking.

---

## 10. Failure Handling

- Adapter failures never fail the user's primary action. Example: if Slack is down, the in-app notification still delivers; Slack delivery is retried.
- "Degraded mode" indicators on Admin dashboard; per-integration health page.
- Integration outages logged to `audit_logs` so HR/PM can explain delays.

---

## 11. Adding a New Integration (Process)

1. Define / reuse a port in `domain/ports/`.
2. Scaffold `src/integrations/<provider>/` (`client.ts`, `mappers.ts`, `adapter.ts`, `webhooks/`, `README.md`).
3. Register in `integrations/registry.ts` behind a feature flag.
4. Add OAuth/token flow to Admin → Integrations.
5. Write contract tests for the adapter (mocked + recorded fixtures).
6. Document capabilities, rate limits, and required secrets.

---

## 12. Anti-Patterns (Forbidden)

- Calling SDKs directly from features.
- Storing tokens unencrypted.
- Letting integration latency block user-facing flows.
- Coupling notification logic to a specific channel.
- Sending PII to AI providers without scrubbing.
