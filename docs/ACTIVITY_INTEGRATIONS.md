# Recent-Activity Integrations — Figma, Google Drive, Google Docs

Architecture for three content/storage providers that feed SpartaFlow a unified
**recent-activity stream** — a design updated in Figma, a file edited in Drive, a
document commented on in Docs — through one vendor-neutral capability port.

> **Status: architecture only — no external API is called yet.**
> Every network path terminates at a per-provider `notImplemented` client seam.
> Metadata + settings schemas are live (so all three render in the Admin
> integrations list today); each stays `available: false` until its `*-client.ts`
> bodies are wired. Wiring one provider touches only that provider's client — no
> port, feature, or other adapter changes (the Open/Closed guarantee).

These extend the platform in
[`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) /
[`src/integrations/README.md`](../src/integrations/README.md) and follow the same
two-layer shape proven by the GitHub provider ([`docs/GITHUB.md`](./GITHUB.md)):
the generic six-method `Integration` lifecycle **plus** a capability port.

---

## What each provider supports

| Concern | How it's provided |
|---|---|
| **Connection** | `BaseIntegration.connect` → the adapter's `authenticate` vendor hook (placeholder). |
| **Validation** | `BaseIntegration.validate` — scope/credential/required-field checks, shared by all providers. |
| **Health Check** | `BaseIntegration.healthCheck` → the adapter's `probe` hook (a cheap identity call, placeholder). |
| **Settings** | `BaseIntegration.settings` + each adapter's declarative `settingsSchema` (renders the Admin form). |
| **Sync placeholder** | `BaseIntegration.sync` → the adapter's `performSync` hook — deliberately `notImplemented`. |
| **Recent Activity** | The `RecentActivityPort` capability port (below), implemented per provider. |

The first five are **inherited** — no provider re-implements them. Only *Recent
Activity* is provider-specific, so it is the only new contract these providers add.

---

## The shared capability port — `RecentActivityPort`

Rather than widen the `Integration` interface, recent-activity is a **capability
port** an adapter additionally implements (Architecture doc §5). It is declared
once in `src/integrations/ports/recent-activity.ts` and shared by all three
providers (and any future one — Dropbox, Notion, …).

```ts
export interface RecentActivityPort {
  listRecentActivity(
    accountId: string,
    params?: ActivityPageParams,   // { cursor?, perPage?, since? }
  ): Promise<ActivityPage<ActivityItem>>;
}
```

`ActivityItem` is the normalized event every provider maps onto:

```ts
interface ActivityItem {
  id: string;
  action: ActivityAction;          // created | edited | commented | shared | renamed | moved | deleted | restored | viewed
  actor: ActivityActor;            // id, displayName, email?, avatarUrl?
  resource: ActivityResource;      // id, type ("design"|"file"|"document"|"folder"|…), name, url?
  occurredAt: string;              // ISO
  summary?: string;
}
```

A feature resolves the port by capability and **never names a vendor** — the
activity feed renders Figma, Drive and Docs events identically:

```ts
import { getIntegrationRegistry, isRecentActivityPort } from "@/integrations";

const provider = getIntegrationRegistry().get("figma");
if (isRecentActivityPort(provider)) {
  const { items, nextCursor } = await provider.listRecentActivity(accountId, { perPage: 25 });
}
```

New capability tag: `"activity.recent"` (added to `IntegrationCapability`). Once a
provider flips `available: true`, `registry.firstWithCapability("activity.recent")`
resolves it automatically.

---

## Per-provider folder shape

Each provider is a self-contained folder — the per-provider layout the
architecture targets:

```
src/integrations/<provider>/
  types.ts                              # provider DTOs + client config
  <provider>-client.ts                  # the ONE HTTP/SDK seam (all notImplemented)
  <provider>-recent-activity.service.ts # RecentActivityPort impl + pure mapper
  <provider>-integration.ts             # adapter: BaseIntegration + RecentActivityPort
  index.ts                              # provider barrel
```

Data flow (identical for all three):

```
feature ─▶ RecentActivityPort ◀─implements─ <Provider>Integration
                                                   │ delegates
                                                   ▼
                                   <Provider>RecentActivityService
                                                   │ maps DTO → ActivityItem, delegates
                                                   ▼
                                          <Provider>Client ── notImplemented
                                          (single HTTP/SDK seam)
```

The service holds **no network code** (per CLAUDE.md: external communication goes
through service classes over the one client seam) and owns the pure
vendor→neutral mapper — trivially unit-testable the moment the client returns
real data.

---

## Figma

- **Folder:** `src/integrations/figma/`
- **Metadata:** `category: "other"`, `scope: "user"`, `auth: "oauth2"`,
  capabilities `["activity.recent", "webhook.inbound"]`, `supportsWebhooks: true`.
- **Activity source:** file updates, version updates, comments, deletes, library
  publishes (`FigmaEventType` → `ActivityAction`; resource `type: "design"`).
- **Settings:**

  | Key | Type | Purpose |
  |---|---|---|
  | `teamId` | string (optional) | Restrict activity to one Figma team. |
  | `includeComments` | boolean (default `true`) | Count file comments as activity. |

## Google Drive

- **Folder:** `src/integrations/google-drive/`
- **Metadata:** `category: "storage"`, `scope: "user"`, `auth: "oauth2"`,
  capabilities `["activity.recent", "webhook.inbound"]`, `supportsWebhooks: true`.
- **Activity source:** the Drive Activity API — create / edit / comment / rename /
  move / delete / restore / permission-change. MIME types map to neutral resource
  types (`folder`, `document`, `spreadsheet`, `presentation`, `file`).
- **Settings:**

  | Key | Type | Purpose |
  |---|---|---|
  | `folderId` | string (optional) | Restrict activity to a folder subtree. Blank = all files. |
  | `includeSharedDrives` | boolean (default `true`) | Include shared drives. |

## Google Docs

- **Folder:** `src/integrations/google-docs/`
- **Metadata:** `category: "storage"`, `scope: "user"`, `auth: "oauth2"`,
  capabilities `["activity.recent"]`, `supportsWebhooks: false` — Docs emits no
  webhooks of its own (change signals arrive via Drive).
- **Activity source:** document revisions — create / edit / suggest / comment /
  rename (`suggest` normalises to `edited` with a summary; resource
  `type: "document"`).
- **Settings:**

  | Key | Type | Purpose |
  |---|---|---|
  | `documentId` | string (optional) | Limit activity to a single document. Blank = all. |
  | `includeSuggestions` | boolean (default `true`) | Count suggestion edits as activity. |

---

## Boundaries the design keeps

- **One capability, three vendors.** All three share `RecentActivityPort`; a
  feature depends on the port, never on Figma/Drive/Docs.
- **One network seam per provider.** Each `*-client.ts` is the only file that will
  import a vendor SDK or issue HTTP — the single place to audit auth, retries and
  rate limits (Architecture doc §9).
- **Vendor types never leak.** Provider DTOs stop at the service mapper; features
  see only `ActivityItem`.
- **Neutral pagination.** Figma cursors and Google page tokens are both exposed as
  the port's opaque `nextCursor`; callers never learn how a vendor paginates.
- **Strict TypeScript, no `any`** — verified with `npx tsc --noEmit`.

---

## Wiring a real provider (the only future change)

1. Fill that provider's `*-client.ts` bodies: resolve a token via
   `config.resolveToken(accountId)`, call the API, map raw payloads to the
   provider DTOs in `types.ts`.
2. Implement the three placeholder vendor hooks in `*-integration.ts`
   (`authenticate` = OAuth code exchange, `performSync`, `probe` = identity call).
3. Flip `available: true` in the provider's metadata.

The `RecentActivityPort`, the mappers, the registry, hooks and every other adapter
stay untouched.

---

## Related

- [`docs/GITHUB.md`](./GITHUB.md) — the sibling `VcsActivityPort` provider.
- [`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) — full platform design.
- [`src/integrations/README.md`](../src/integrations/README.md) — implementation overview.
