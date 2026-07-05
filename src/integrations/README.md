# SpartaFlow Integration Platform

Infrastructure for connecting SpartaFlow to external systems (Slack, ClickUp,
GitHub, …) through a uniform **Adapter Pattern**. This folder is the
implementation of the design in [`docs/INTEGRATION_ARCHITECTURE.md`](../../docs/INTEGRATION_ARCHITECTURE.md).

> **Status: infrastructure only — no external API is connected yet.**
> The offline `mock` provider exercises the full lifecycle for local dev and
> tests. `slack` / `clickup` / `github` are declared **placeholders**: their
> metadata + settings schemas are live (so the Admin UI renders today), but every
> network action throws `not_implemented` until a real `*-client.ts` is wired.

---

## Folder structure

```
src/integrations/
  types/        # The Integration interface + neutral DTOs (the contract)
  models/       # ProviderStatus, IntegrationAccount (domain value objects)
  providers/    # BaseIntegration + adapters + ProviderFactory + IntegrationRegistry
  services/     # IntegrationManager, SettingsManager, AccountStore, container
  hooks/        # useIntegrations, useIntegration (React, reactive)
  components/    # IntegrationList, IntegrationCard, ProviderStatusBadge
  index.ts      # public barrel — import from "@/integrations"
```

Import from the barrel (`@/integrations`), not sub-paths.

---

## The five core building blocks

| Class | Location | Responsibility |
|---|---|---|
| **`IntegrationManager`** | `services/integration-manager.ts` | App-facing facade. Orchestrates connect / disconnect / sync / healthCheck and holds the reactive per-provider `ProviderStatus`. The only thing features/hooks call. |
| **`IntegrationRegistry`** | `providers/integration-registry.ts` | Resolves an `IntegrationId` → a **memoized** adapter instance (built via the factory). Also lists the catalog and resolves by capability. Has a `reset()` test seam. |
| **`ProviderFactory`** | `providers/provider-factory.ts` | The single table mapping each id → `{ metadata, create }`. **The one extension point** — add a provider here and nowhere else. |
| **`ProviderStatus`** | `models/provider-status.ts` | Immutable runtime-status value object (`disconnected` → `connecting` → `connected` / `degraded` / `error` / `disabled`) with label/tone + `fromHealth()` derivation + serializable snapshot. |
| **`SettingsManager`** | `services/settings-manager.ts` | Vendor-blind settings surface: fetch schema, validate a patch, persist a merged patch — uniform across providers. |

Wired together as process singletons in `services/container.ts`
(`getIntegrationManager()`).

---

## The provider contract (Adapter Pattern)

Every provider implements the six-method `Integration` interface
(`types/integration.ts`):

```ts
interface Integration {
  readonly metadata: IntegrationMetadata;
  connect(input: ConnectInput): Promise<IntegrationAccountData>;
  disconnect(accountId: string): Promise<void>;
  sync(input: SyncInput): Promise<SyncResult>;
  healthCheck(accountId: string): Promise<HealthStatus>;
  settings(accountId: string): Promise<SettingsSchema>;
  settings(accountId: string, patch: IntegrationSettings): Promise<IntegrationSettings>;
  validate(input: ConnectInput | IntegrationSettings): Promise<ValidationResult>;
}
```

Adapters extend **`BaseIntegration`** (`providers/base-integration.ts`), which
implements all shared lifecycle plumbing (account persistence, settings
merge/validate, health timing). A concrete adapter writes only four vendor hooks:

```ts
protected authenticate(input): Promise<AuthenticatedIdentity>  // exchange credential
protected performSync(account, input): Promise<SyncResult>      // pull/push data
protected probe(account): Promise<void>                         // liveness probe
protected settingsSchema(): SettingsSchema                      // form fields
```

This mirrors the AI layer's `AIProvider` / `BaseAIProvider` / memoized `registry`
in `src/ai/providers/` — the same adapter pattern, generalized to external
systems.

---

## Usage

### In a component (reactive)

```tsx
import { useIntegrations } from "@/integrations";

function IntegrationsPage() {
  const { integrations, connect, refresh } = useIntegrations();
  // integrations: { metadata, status }[] — re-renders when any status changes
}
```

Or drop in the ready-made list:

```tsx
import { IntegrationList } from "@/integrations";
// <IntegrationList />  — renders a card per provider with a live status badge
```

### Programmatically

```ts
import { getIntegrationManager } from "@/integrations";

const mgr = getIntegrationManager();
const account = await mgr.connect("mock", {
  scope: "user",
  ownerId: userId,
  credential: { kind: "api_token", token },
});           // returns a PublicIntegrationAccount — no credentialRef
await mgr.sync({ accountId: account.id });
const status = mgr.getStatus("mock");   // ProviderStatus
```

---

## Adding a new provider (no existing code changes)

1. Create `providers/<provider>-integration.ts` extending `BaseIntegration`
   (implement the four vendor hooks + a `<Provider>_METADATA`).
2. Add **one line** to `PROVIDER_TABLE` in `providers/provider-factory.ts`.
3. Flip `available: true` in its metadata once the real `*-client.ts` is wired.

That's it — the `Integration` interface, registry, manager, hooks and every
other adapter are untouched. This is the Open/Closed guarantee: *support future
providers without changing existing code*.

---

## Boundaries & guarantees

- **No external APIs are called.** Persistence is the in-memory
  `InMemoryAccountStore` (the seam a Supabase-backed store slots into later —
  it already mirrors the future `integration_accounts` table). Placeholder
  adapters throw the greppable `notImplemented(...)`.
- **Credentials never leak.** Accounts returned to callers are
  `PublicIntegrationAccount` (the `credentialRef` is stripped).
- **Errors are uniform.** Everything throws `IntegrationError` with a stable
  `code`, matching `AIError` / `ServiceError`.
- **Strict TypeScript, no `any`.** Verified with `npx tsc --noEmit`.

See [`docs/INTEGRATION_ARCHITECTURE.md`](../../docs/INTEGRATION_ARCHITECTURE.md)
for the full design (auth/credentials, webhooks, resilience, persistence + RLS).
