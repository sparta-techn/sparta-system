# SpartaFlow — Integration Platform Architecture

> **Design document.** Describes the *target* design for the SpartaFlow
> Integration Platform. No application code is created or modified by this
> document — it is the contract the implementation must satisfy.
>
> This design deliberately mirrors patterns already proven in the codebase:
> the AI provider **adapter** layer (`src/ai/providers/` — `AIProvider`
> interface + `BaseAIProvider` abstract class + memoized factory `registry.ts`),
> the `BaseService` CRUD foundation (`src/services/core/base-service.ts`), the
> feature-first layout (`docs/ARCHITECTURE.md` §2), and the ports-and-adapters
> sketch in `docs/Integrations.md`. It supersedes and formalizes the adapter
> contract in `docs/Integrations.md` §3.

---

## 1. Goals & Constraints

| Goal | How this design meets it |
|---|---|
| **Adapter Pattern** | Every external system is reached only through an adapter that implements one uniform interface. Business logic depends on the interface, never a vendor SDK. |
| **Uniform provider contract** | Every provider implements exactly six lifecycle methods: `connect`, `disconnect`, `sync`, `healthCheck`, `settings`, `validate`. |
| **Generic `Integration` interface** | A single `Integration` interface (below) is the only type features import. |
| **Open for extension, closed for modification** | Adding a provider = one new adapter file + one registry entry. No existing adapter, feature, or interface changes. (Open/Closed Principle.) |
| **Consistency with the codebase** | Same idioms as `src/ai/providers/`: abstract base for shared behaviour, thin concrete adapters, a memoized registry, a `reset()` test seam. |

**Non-goals of this doc:** concrete vendor endpoints, UI screens, and SQL DDL
(referenced where relevant, specified in their own docs).

---

## 2. Layered Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ Features (notifications, projects, hr, dependencies, …)      │
│   depend ONLY on the Integration interface + capability ports│
└───────────────┬─────────────────────────────────────────────┘
                │  resolve by id / capability
                ▼
┌─────────────────────────────────────────────────────────────┐
│ IntegrationRegistry  (composition root)                      │
│   id ─► factory ─► memoized adapter instance                 │
└───────────────┬─────────────────────────────────────────────┘
                │  implements
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Integration (interface)  ◄── BaseIntegration (abstract)      │
│   connect · disconnect · sync · healthCheck · settings ·     │
│   validate                                                   │
└───────────────┬─────────────────────────────────────────────┘
                │  extended by thin concrete adapters
                ▼
┌───────────────────────────────┬─────────────────────────────┐
│ SlackIntegration              │ ClickUpIntegration   …       │
│  → SlackClient (SDK/HTTP)     │  → ClickUpClient             │
└───────────────────────────────┴─────────────────────────────┘
                │
                ▼
   Persistence: integration_accounts · integration_links ·
   integration_events · integration_sync_runs  (Supabase + RLS)
```

**Directory layout** (feature-first, matching `docs/ARCHITECTURE.md`):

```text
src/integrations/
  core/
    types.ts            # Integration interface + shared DTOs (the contract)
    base-integration.ts # BaseIntegration abstract class (shared behaviour)
    registry.ts         # id ─► factory map, memoized, reset() seam
    errors.ts           # IntegrationError taxonomy
    http-client.ts      # timeout + retry + circuit breaker + logging
    crypto.ts           # credential encryption helpers (app-layer)
    index.ts            # public barrel
  ports/
    chat-notifier.ts    # capability port: notifyUser / notifyChannel
    task-provider.ts    # capability port: listProjects / getTask / search
    vcs-activity.ts     # capability port: commits / PRs / reviews
    calendar.ts         # capability port: leaves / working hours
    index.ts
  slack/
    slack-integration.ts # implements Integration + ChatNotifierPort
    slack-client.ts      # SDK/HTTP wrapper (only file that imports the SDK)
    mappers.ts           # external DTO ↔ SpartaFlow DTO
    webhooks/handler.ts  # inbound signature-verified events
    README.md            # capabilities, scopes, rate limits, secrets
  clickup/  github/  gitlab/  google-calendar/  discord/  …  (same shape)
supabase/migrations/     # integration_* tables + RLS (see §11)
```

> The `src/integrations/supabase/` folder is unrelated infrastructure (the
> Supabase client). The Integration Platform lives in `src/integrations/core`,
> `ports`, and per-provider folders. No existing file is repurposed.

---

## 3. The Generic `Integration` Interface

This is the single contract every provider implements. It is intentionally
narrow — six lifecycle methods — so features and the registry never depend on
provider specifics. Capability-specific behaviour is layered on top via **ports**
(§5), never by widening this interface.

```ts
// src/integrations/core/types.ts

/** Stable, unique identifier for a provider. Extend the union per provider. */
export type IntegrationId =
  | "slack"
  | "clickup"
  | "github"
  | "gitlab"
  | "google-calendar"
  | "discord"
  | (string & {}); // open for future ids without editing this file's consumers

/** How an integration is scoped: to one user, or to the whole org. */
export type IntegrationScope = "user" | "org";

/** Coarse capability tags a provider advertises (drives port resolution). */
export type IntegrationCapability =
  | "chat.notify"
  | "task.read"
  | "task.write"
  | "vcs.activity"
  | "calendar.sync"
  | "webhook.inbound";

/** Static, code-level description of a provider (no secrets, no runtime state). */
export interface IntegrationMetadata {
  readonly id: IntegrationId;
  readonly displayName: string;
  readonly scope: IntegrationScope;
  readonly capabilities: readonly IntegrationCapability[];
  /** Auth mechanism the connect() flow expects. */
  readonly auth: "oauth2" | "api_token" | "webhook_secret";
  /** Whether this provider emits inbound webhooks (see §8). */
  readonly supportsWebhooks: boolean;
}

/** A persisted connection between SpartaFlow and an external account. */
export interface IntegrationAccount {
  id: string;                 // UUID
  integrationId: IntegrationId;
  scope: IntegrationScope;
  ownerId: string;            // user id (scope="user") or org id (scope="org")
  externalAccountId: string;  // id on the provider side
  status: "active" | "revoked" | "error";
  /** Opaque, encrypted at the app layer (see §7). Never returned to the client raw. */
  credentialsRef: string;
  settings: IntegrationSettings;
  createdAt: string;
  updatedAt: string;
}

// ----- Method payloads (neutral DTOs, no vendor fields) -----

export interface ConnectInput {
  scope: IntegrationScope;
  ownerId: string;
  /** OAuth authorization code, or an API token, depending on `metadata.auth`. */
  credential: { kind: "oauth_code"; code: string; redirectUri: string }
            | { kind: "api_token"; token: string }
            | { kind: "webhook_secret"; secret: string };
}

export interface SyncInput {
  accountId: string;
  /** Incremental cursor from the previous run; absent = full sync. */
  since?: string;
  signal?: AbortSignal;
}

export interface SyncResult {
  ok: boolean;
  itemsProcessed: number;
  /** Cursor to persist and pass as `since` on the next run. */
  nextCursor?: string;
  errors: IntegrationError[];
}

export type HealthState = "healthy" | "degraded" | "down";

export interface HealthStatus {
  state: HealthState;
  checkedAt: string;
  /** Round-trip latency of the probe, ms. */
  latencyMs?: number;
  detail?: string;
}

/** JSON-serializable per-account configuration (channel ids, filters, toggles). */
export type IntegrationSettings = Record<string, unknown>;

/** Declarative description of the settings a provider accepts (drives Admin UI). */
export interface SettingsSchema {
  fields: Array<{
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "select" | "secret";
    required: boolean;
    options?: Array<{ value: string; label: string }>;
    default?: unknown;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field?: string; message: string }>;
}

/**
 * The contract every provider adapter implements.
 *
 * Callers (features, registry) depend only on this interface — never on a
 * concrete class or a vendor SDK. Mirrors the role of `AIProvider` in
 * `src/ai/types/provider.ts`.
 */
export interface Integration {
  /** Static description; no runtime state, no secrets. */
  readonly metadata: IntegrationMetadata;

  /**
   * (1) Establish a connection: exchange the credential, fetch the external
   * account identity, persist an encrypted IntegrationAccount, return it.
   * Idempotent per (integrationId, ownerId, externalAccountId).
   */
  connect(input: ConnectInput): Promise<IntegrationAccount>;

  /**
   * (2) Tear down a connection: revoke tokens with the provider where possible,
   * remove webhooks, mark the account "revoked", and purge credentials.
   * Safe to call on an already-disconnected account (no-op).
   */
  disconnect(accountId: string): Promise<void>;

  /**
   * (3) Pull/push data for one account. Incremental when `since` is supplied.
   * Must be resumable and idempotent — a re-run with the same cursor is safe.
   */
  sync(input: SyncInput): Promise<SyncResult>;

  /**
   * (4) Liveness/credential probe. Cheap, read-only, side-effect free. Feeds the
   * Admin health page and the circuit breaker (§9).
   */
  healthCheck(accountId: string): Promise<HealthStatus>;

  /**
   * (5) The settings surface. With no argument, returns the declarative schema
   * (for rendering the Admin form). With a patch, validates + persists it and
   * returns the merged settings.
   */
  settings(accountId: string): Promise<SettingsSchema>;
  settings(accountId: string, patch: IntegrationSettings): Promise<IntegrationSettings>;

  /**
   * (6) Validate a prospective connection or settings patch WITHOUT persisting —
   * e.g. confirm a token has the required scopes, or a channel id exists.
   * Called by connect()/settings() and by the Admin "Test connection" button.
   */
  validate(input: ConnectInput | IntegrationSettings): Promise<ValidationResult>;
}
```

**Why these six, and only these six.** `connect`/`disconnect` own the credential
lifecycle; `sync` owns data movement; `healthCheck` owns observability;
`settings` owns configuration; `validate` owns pre-flight correctness. Anything
domain-specific (send a Slack message, list ClickUp tasks) is a **capability
port** (§5), so the core interface stays stable as providers proliferate — the
key to "support future providers without changing existing code."

---

## 4. `BaseIntegration` — Shared Behaviour

Concrete adapters stay thin by extending an abstract base, exactly as
`BaseAIProvider` (`src/ai/providers/base-provider.ts`) does for AI. The base
implements the parts every provider shares — account persistence, settings
merge/validate plumbing, health-probe timing, credential encryption calls — so
an adapter only writes the genuinely vendor-specific pieces.

```ts
// src/integrations/core/base-integration.ts  (design sketch)

export abstract class BaseIntegration implements Integration {
  abstract readonly metadata: IntegrationMetadata;

  /** Vendor-specific: exchange credential → external identity + scopes. */
  protected abstract authenticate(input: ConnectInput): Promise<{
    externalAccountId: string;
    credentials: Record<string, unknown>; // plaintext; base encrypts before store
  }>;

  /** Vendor-specific: the actual data pull/push for one run. */
  protected abstract performSync(
    account: IntegrationAccount,
    input: SyncInput,
  ): Promise<SyncResult>;

  /** Vendor-specific: cheap liveness probe (e.g. GET /me). */
  protected abstract probe(account: IntegrationAccount): Promise<void>;

  /** Vendor-specific: the settings fields this provider accepts. */
  protected abstract settingsSchema(): SettingsSchema;

  // ---- Shared, implemented once here ----

  async connect(input: ConnectInput): Promise<IntegrationAccount> {
    const check = await this.validate(input);
    if (!check.valid) throw new IntegrationError("invalid_request", check.errors);
    const { externalAccountId, credentials } = await this.authenticate(input);
    // encrypt (crypto.ts) → upsert integration_accounts → register webhooks → return
    ...
  }

  async healthCheck(accountId: string): Promise<HealthStatus> {
    const account = await this.loadAccount(accountId);
    const startedAt = Date.now();
    try {
      await this.probe(account);
      return { state: "healthy", checkedAt: iso(), latencyMs: Date.now() - startedAt };
    } catch (e) {
      return { state: "down", checkedAt: iso(), detail: String(e) };
    }
  }

  async settings(accountId: string, patch?: IntegrationSettings) {
    if (patch === undefined) return this.settingsSchema();
    const check = await this.validate(patch);
    if (!check.valid) throw new IntegrationError("invalid_request", check.errors);
    return this.mergeAndPersistSettings(accountId, patch); // shared
  }

  async validate(input: ConnectInput | IntegrationSettings): Promise<ValidationResult> {
    // shared schema-shape validation; adapters override to add live checks
    ...
  }

  // loadAccount / mergeAndPersistSettings / disconnect (revoke+purge) shared here
}
```

Concrete adapters (`SlackIntegration`, `ClickUpIntegration`, …) implement only
`authenticate`, `performSync`, `probe`, `settingsSchema`, plus any capability
port (§5). Everything else is inherited — no adapter re-implements account
persistence or health timing, just as no AI adapter re-implements `countTokens`.

---

## 5. Capability Ports (keeping the core interface stable)

The six lifecycle methods are universal, but a feature that wants to *send a
notification* needs more than lifecycle. Rather than widen `Integration`, we
layer **capability ports** — small interfaces an adapter additionally implements.
This is the ports-and-adapters split from `docs/Integrations.md`, made precise.

```ts
// src/integrations/ports/chat-notifier.ts
export interface ChatNotifierPort {
  notifyUser(accountId: string, userRef: string, msg: NotificationMessage): Promise<DeliveryResult>;
  notifyChannel(accountId: string, channelRef: string, msg: NotificationMessage): Promise<DeliveryResult>;
}

// src/integrations/ports/task-provider.ts
export interface TaskProviderPort {
  listProjects(accountId: string): Promise<ExternalProject[]>;
  getTask(accountId: string, taskId: string): Promise<ExternalTask>;
  searchTasks(accountId: string, query: string): Promise<ExternalTask[]>;
}
```

A feature resolves a port by capability and stays vendor-blind:

```ts
// notifications feature — never names Slack or Discord
const notifier = registry.resolveCapability<ChatNotifierPort>("chat.notify");
await notifier.notifyUser(accountId, userRef, message);
```

Swapping Slack for Discord is a registry/config change; the feature is untouched.
Adding WhatsApp later = a new adapter implementing the same `ChatNotifierPort` —
no port, feature, or existing adapter changes. **Closed for modification.**

---

## 6. The Registry (composition root)

One memoized factory map resolves an id to an adapter and, by capability, to a
port implementation. This is the same shape as `src/ai/providers/registry.ts`
(factory map + `Map` memoization + `reset()` test seam), extended with a
capability lookup.

```ts
// src/integrations/core/registry.ts  (design sketch)

const factories: Record<IntegrationId, () => Integration> = {
  slack: () => new SlackIntegration(),
  clickup: () => new ClickUpIntegration(),
  github: () => new GitHubIntegration(),
  // ...one line per provider — the ONLY place a vendor is named
};

const instances = new Map<IntegrationId, Integration>();

export function getIntegration(id: IntegrationId): Integration {
  const cached = instances.get(id);
  if (cached) return cached;
  const make = factories[id];
  if (!make) throw new IntegrationError("unknown_provider", `No adapter for "${id}".`);
  const inst = make();
  instances.set(id, inst);
  return inst;
}

/** Resolve the configured provider for a capability (e.g. active chat notifier). */
export function resolveCapability<T>(cap: IntegrationCapability): T { /* config → id → cast */ }

export function registeredIntegrations(): IntegrationId[] { return Object.keys(factories); }

/** Test/reset seam — clears memoized instances (mirrors resetProviders()). */
export function resetIntegrations(): void { instances.clear(); }
```

**Adding a provider touches exactly two things:** a new `src/integrations/<p>/`
folder and one line in `factories`. Feature code, the `Integration` interface,
ports, and every other adapter are untouched — the Open/Closed guarantee.

---

## 7. Authentication & Credentials

- **OAuth2** where supported (Slack, ClickUp, GitHub, GitLab, Google); **API
  token** fallback; **webhook secret** for inbound-only providers. Declared per
  provider in `metadata.auth`.
- Credentials are **encrypted at the app layer** (`core/crypto.ts`) before they
  ever reach Supabase; the row stores ciphertext (`credentialsRef`). The
  Supabase **service-role key is never exposed client-side** (per `CLAUDE.md`
  Security + `docs/ARCHITECTURE.md` §10); connect/refresh run in server
  functions using the existing `requireSupabaseAuth` middleware.
- **Refresh tokens** rotate automatically; a refresh failure flips the account to
  `status: "error"`, raises a `healthCheck` → `down`, and alerts Super Admin.
- **Scope**: each provider declares `metadata.scope` (`user` vs `org`), which
  drives RLS ownership (§11).

---

## 8. Inbound Webhooks

Providers with `supportsWebhooks: true` expose `webhooks/handler.ts`. Routed via
`/api/webhooks/<integrationId>`; each handler:

1. **Verifies the signature in constant time** (secret from the encrypted account).
2. Persists the raw payload to `integration_events` (audit + replay).
3. **Acks within 5 s**, then enqueues a domain event for async processing.
4. Processing runs through `sync`/port methods — never inline in the HTTP handler.

Replay is supported from the Admin UI by re-dispatching a stored
`integration_events` row.

---

## 9. Outbound Calls & Resilience

All outbound HTTP flows through `core/http-client.ts`:

- **Timeout** (default 5 s), **retry** on idempotent calls only, **circuit
  breaker** per provider, structured logging.
- **Rate-limit aware**: backoff respects `Retry-After`; a `429` never becomes a
  user-facing error.
- **Open circuit degrades gracefully**: `healthCheck` reports `degraded`, and the
  feature surface shows a paused state ("Slack notifications paused") rather than
  failing the user's primary action.
- **Failure isolation** (from `docs/Integrations.md` §10): an adapter failure
  *never* fails the user's core action. If Slack is down, the in-app
  notification still delivers; Slack delivery is retried out-of-band.

---

## 10. Error Model

A single `IntegrationError` taxonomy (mirroring `src/ai/utils/errors.ts` and
`src/services/core/errors.ts`) so every adapter fails identically:

```ts
export type IntegrationErrorCode =
  | "invalid_request" | "unknown_provider" | "unauthorized"
  | "rate_limited" | "provider_unavailable" | "not_connected" | "sync_conflict";
```

Errors carry a code, a human message, and optional field-level detail (for
`validate`). Adapters throw; the registry and features catch and translate to UI
state through the shared `states` module (`docs/ARCHITECTURE.md` §4).

---

## 11. Persistence (Supabase + RLS)

UUID PKs, RLS on every table, per `CLAUDE.md` Database rules and
`docs/DB_RULES.md`.

| Table | Purpose | Ownership / RLS |
|---|---|---|
| `integration_accounts` | One connected account (encrypted creds, settings, status). | `scope="user"` → owner only; `scope="org"` → org admins (`owner`/`super_admin`). |
| `integration_links` | Maps SpartaFlow entity ↔ external entity (project↔ClickUp space, user↔Slack id). | Readable by entity viewers; writable by admins. |
| `integration_events` | Raw inbound webhook payloads (audit + replay). | Admin-only. |
| `integration_sync_runs` | Per-`sync` outcome: cursor, itemsProcessed, errors, timing. | Admin-only; feeds health page. |

Important cross-entity/privileged writes go through **server functions**, not
direct client queries; simple owner-scoped reads use client + RLS. Every
connect/disconnect/settings change is written to `audit_logs` (Security §
`CLAUDE.md`).

---

## 12. How Features Consume It (end-to-end example)

**Dependency escalation → notify the blocker owner:**

```ts
// features/dependencies — vendor-blind
import { resolveCapability } from "@/integrations/core/registry";
import type { ChatNotifierPort } from "@/integrations/ports";

async function escalate(dep: Dependency) {
  const notifier = resolveCapability<ChatNotifierPort>("chat.notify"); // Slack OR Discord
  await notifier.notifyUser(dep.integrationAccountId, dep.ownerRef, {
    title: "Dependency escalated",
    body: dep.summary,
    deepLink: `/app/dependencies/${dep.id}`,
  });
}
```

The feature never imports a vendor SDK, names Slack, or touches credentials — it
depends on a **port**, resolved by the **registry**, implemented by an
**adapter** built on the **`Integration`** contract. Exactly the layering
`CLAUDE.md` mandates ("components must never call APIs directly").

---

## 13. Adding a New Provider (checklist)

1. Create `src/integrations/<provider>/` with `<provider>-integration.ts`
   (extends `BaseIntegration`, implements the six methods via the abstract
   hooks + any capability port), `<provider>-client.ts` (the *only* file that
   imports the vendor SDK), `mappers.ts`, optional `webhooks/handler.ts`, and
   `README.md`.
2. Add the `IntegrationId` to the union in `core/types.ts` and one line to the
   `factories` map in `core/registry.ts`.
3. Add the OAuth/token flow to Admin → Integrations (behind a feature flag).
4. Add the `integration_*` migration only if the provider needs new columns
   (usually it does not — the schema is generic).
5. Write contract tests against the `Integration` interface (mocked client +
   recorded fixtures), reusing the shared test seam `resetIntegrations()`.
6. Document capabilities, required scopes, rate limits, and secrets in the
   provider `README.md`.

**Nothing above the provider folder + registry line changes.** That is the
concrete meaning of "support future providers without changing existing code."

---

## 14. Anti-Patterns (forbidden)

- Importing a vendor SDK anywhere except that provider's `*-client.ts`.
- Widening the `Integration` interface for one provider's feature (use a port).
- Calling an adapter directly from a feature bypassing the registry.
- Storing credentials unencrypted, or returning raw credentials to the client.
- Letting integration latency or failure block a user's primary action.
- Coupling notification logic to a specific channel (depend on `ChatNotifierPort`).

---

## 15. Relationship to Existing Docs

- **`docs/Integrations.md`** — the earlier ports-&-adapters sketch. This document
  formalizes its §3 adapter contract into the concrete six-method `Integration`
  interface and reconciles the capability layer.
- **`docs/ARCHITECTURE.md`** — feature-first layout, Supabase integration points,
  and the `states`/error conventions this design reuses.
- **`src/ai/providers/`** — the reference implementation of this exact pattern
  (interface + abstract base + memoized factory registry) for AI vendors; the
  Integration Platform is the same pattern generalized to external systems.

---

## 16. Implementation Status (as built)

The infrastructure now exists under `src/integrations/` — see
[`src/integrations/README.md`](../src/integrations/README.md). It realizes this
design with a flat, feature-first folder layout (matching `docs/ARCHITECTURE.md`
§2) rather than the illustrative `core/`+`ports/` sketch in §2 above:

| This doc (conceptual) | As built |
|---|---|
| `Integration` interface, DTOs | `src/integrations/types/` |
| `BaseIntegration`, adapters, factory, registry | `src/integrations/providers/` |
| `IntegrationManager`, `SettingsManager`, `AccountStore`, composition root | `src/integrations/services/` |
| `ProviderStatus`, `IntegrationAccount` value objects | `src/integrations/models/` |
| React consumption | `src/integrations/hooks/`, `src/integrations/components/` |

**Delivered:** the six-method `Integration` contract; `BaseIntegration` with all
shared lifecycle plumbing; `ProviderFactory` (single extension table) +
memoized `IntegrationRegistry`; `IntegrationManager` (reactive status facade) +
`SettingsManager`; `ProviderStatus` model; an offline `mock` provider that
exercises the whole lifecycle; and Slack / ClickUp / GitHub **placeholders**
(live metadata + schema, actions throw `notImplemented`).

**Deliberately deferred (no external APIs yet):** capability ports (§5), inbound
webhooks (§8), the resilient `http-client` (§9), real OAuth/credential
encryption (§7), and Supabase-backed persistence + RLS (§11). Persistence is an
in-memory `AccountStore` that already mirrors the future `integration_accounts`
surface, so swapping it for Supabase is a one-file change in the composition
root.
```
