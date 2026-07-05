# Infrastructure Integrations — Supabase, Cloudflare, Hostinger VPS

Architecture for three **infrastructure-status** providers that feed SpartaFlow's
Owner Dashboard operational health: deployment, storage, DNS, SSL and server
information — through one vendor-neutral capability port.

> **Status: architecture only — no external API is called yet.**
> Every network path terminates at a per-provider `notImplemented` client seam.
> Metadata + settings schemas are live (so all three render in the Admin list
> today); each stays `available: false` until its client is wired. Wiring one
> provider touches only that provider's client — no port, feature, or other
> adapter changes (Open/Closed).

These extend the platform in
[`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) /
[`src/integrations/README.md`](../src/integrations/README.md), following the same
two-layer shape as the other capability providers
([`docs/GITHUB.md`](./GITHUB.md), [`docs/AUTOMATION.md`](./AUTOMATION.md)): the
generic six-method `Integration` lifecycle **plus** a capability port.

---

## Supported checks

| Check | Where it lives |
|---|---|
| **Health Check** | The inherited `Integration.healthCheck` lifecycle method (→ each adapter's `probe`). Not repeated on the port. |
| **Deployment Status** | `InfrastructurePort.getDeploymentStatus` → `DeploymentStatus` (phase, version, url). |
| **Storage Status** | `InfrastructurePort.getStorageStatus` → `StorageStatus` (bytes used/limit, buckets). |
| **DNS Status** | `InfrastructurePort.getDnsStatus` → `DnsStatus` (zone, records, propagation). |
| **SSL Status** | `InfrastructurePort.getSslStatus` → `SslStatus` (issuer, expiry, auto-renew). |
| **Server Information** | `InfrastructurePort.getServerInfo` → `ServerInfo` (region, CPU, RAM, disk, uptime). |

Health Check is the platform's existing liveness lifecycle method, so it isn't
duplicated on the port — the same treatment the notification/automation batches
gave the inherited Connection/Validation/Settings/Sync concerns.

---

## The capability port — `InfrastructurePort`

Declared in `src/integrations/ports/infrastructure.ts` and implemented by all
three providers. Each status DTO shares an `InfraStatusBase`
(`state`, `checkedAt`, `detail?`) where `state` is a normalized
`InfraState = operational | degraded | down | unknown | not_supported`.

```ts
interface InfrastructurePort {
  readonly supportedChecks: readonly InfrastructureCheck[];   // which of the 5 this provider serves
  supports(check: InfrastructureCheck): boolean;
  getDeploymentStatus(accountId): Promise<DeploymentStatus>;
  getStorageStatus(accountId): Promise<StorageStatus>;
  getDnsStatus(accountId): Promise<DnsStatus>;
  getSslStatus(accountId): Promise<SslStatus>;
  getServerInfo(accountId): Promise<ServerInfo>;
}
```

A feature renders a status tile without naming a vendor:

```ts
import { getIntegrationRegistry, isInfrastructurePort } from "@/integrations";

const provider = getIntegrationRegistry().get("hostinger");
if (isInfrastructurePort(provider)) {
  const server = await provider.getServerInfo(accountId);   // { state, region, cpuCores, uptimeSeconds, … }
}
```

New capability tag: `"infra.status"`.

---

## Not every provider serves every check

The three platforms genuinely differ, so each declares its `supportedChecks`. A
check a provider doesn't serve returns a `not_supported` status **with no client
call** — surfaced honestly rather than faked or thrown (the same
`supports()`-guard pattern the Notifier/Calendar batch used for notification kinds).

| Check | Supabase | Cloudflare | Hostinger VPS |
|---|:---:|:---:|:---:|
| Deployment | ✅ | ✅ | ✅ |
| Storage | ✅ | ✅ (R2) | ✅ (disk) |
| DNS | — | ✅ | ✅ |
| SSL | ✅ | ✅ (edge) | ✅ |
| Server info | ✅ (compute) | — (edge) | ✅ |

Supabase doesn't manage DNS; Cloudflare is an edge platform with no server — those
cells return `not_supported`.

---

## Shared service + per-provider shape

The supports/not-supported guard is **vendor-neutral and shared** — written once
in `src/integrations/infrastructure/` and reused by every provider.

```
src/integrations/infrastructure/
  infrastructure-transport.ts   # InfrastructureTransport — the neutral client seam
  infrastructure-service.ts     # InfrastructureService — implements InfrastructurePort (shared)
  index.ts

src/integrations/<provider>/
  types.ts                      # client config
  <provider>-client.ts          # implements InfrastructureTransport; maps vendor→neutral; notImplemented
  <provider>-integration.ts     # adapter: BaseIntegration + InfrastructurePort (delegates to the service)
  index.ts
```

Data flow:

```
feature ─▶ InfrastructurePort ◀─implements─ <Provider>Integration
                                                  │ delegates
                                                  ▼
                                        InfrastructureService
                                          │ supports(check)?
                                          ├─ no  ─▶ { state: "not_supported" }   (no client call)
                                          └─ yes ─▶ <Provider>Client ── notImplemented
                                                    (single API seam)
```

`InfrastructureService` composes a vendor `InfrastructureTransport` with the
provider's `supportedChecks`; providers differ only in their transport (vendor
mapping) + which checks they advertise (composition over duplication, CLAUDE.md).
Lifecycle concerns — Connection, Validation, Health Check, Settings, Sync — are
all inherited from `BaseIntegration`.

---

## The three providers

### Supabase — `src/integrations/supabase-platform/`
- Monitors SpartaFlow's own Supabase project via the **Management API** (personal
  access token). The project **service-role key is never used** (CLAUDE.md
  Security). `category: "other"`, `scope: "org"`, `auth: "api_token"`.
- Checks: deployment, storage, SSL, server. **DNS → not supported.**
- Settings: `projectRef` (required), `storageWarnPct` (default 80).
- Lives in its own folder to stay separate from `src/integrations/supabase/`,
  which is the app's runtime DB/auth client (a different concern).

### Cloudflare — `src/integrations/cloudflare/`
- Monitors DNS zones/records, edge SSL certificate packs, Pages/Workers
  deployments and R2 storage. `category: "other"`, `scope: "org"`,
  `auth: "api_token"` (scoped token).
- Checks: DNS, SSL, deployment, storage. **Server info → not supported** (edge).
- Settings: `zoneId` (DNS/SSL), `accountIdentifier` (Pages/Workers/R2).

### Hostinger VPS — `src/integrations/hostinger/`
- Monitors a VPS: server specs/region/uptime, hosted SSL, disk storage, app
  deployment and managed DNS. `category: "other"`, `scope: "org"`,
  `auth: "api_token"`.
- Checks: **all five.**
- Settings: `virtualMachineId` (required), `diskWarnPct` (default 85).

---

## Boundaries the design keeps

- **One capability, three heterogeneous platforms.** All implement
  `InfrastructurePort`; a feature reads status without naming a vendor.
- **Honest capability granularity.** `supportedChecks` + `not_supported` results
  let a narrow platform (Cloudflare/Supabase) coexist with a full one (VPS) behind
  one interface — no per-provider branching in feature code.
- **One API seam per provider.** Each `*-client.ts` is the only file that will
  touch the vendor API — the single place to audit auth and rate limits
  (Architecture doc §9). Supabase reads use the Management API token, never the
  service-role key.
- **Normalized status.** Vendor-specific health vocabularies collapse to one
  `InfraState`; features render a consistent status tile.
- **Strict TypeScript, no `any`** — verified with `npx tsc --noEmit`.

---

## Wiring a real provider (the only future change)

1. Fill that provider's `*-client.ts`: resolve the token via
   `config.resolveToken`, call the API, and map the response onto the neutral
   `Deployment/Storage/Dns/Ssl/Server` DTOs (mapping `state` to `InfraState`).
2. Implement the three placeholder vendor hooks in `*-integration.ts`
   (`authenticate`, `performSync`, `probe` — `probe` powers Health Check).
3. Flip `available: true` in the provider's metadata.

The `InfrastructurePort`, `InfrastructureService`, the registry, hooks and every
other adapter stay untouched.

---

## Related

- [`docs/AUTOMATION.md`](./AUTOMATION.md) — `AutomationPort` providers.
- [`docs/GITHUB.md`](./GITHUB.md) — `VcsActivityPort` provider.
- [`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) — full platform design.
