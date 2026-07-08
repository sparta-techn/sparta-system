# Integration Center (UI)

The Integration Center is the Admin screen that lists every registered provider
and surfaces its live operational state. It is now **connected to services** and
no longer shows static placeholders: every provider — including the not-yet-wired
ones — renders real, reactive data across six views.

> **Data source: a local, offline mock service.** Real providers are still
> placeholders (every vendor call throws `notImplemented`), so the Center reads
> from `MockTelemetryService` — deterministic, seeded-by-provider-id data that
> makes **no network calls**. When a real telemetry backend lands, only the hook's
> data source changes; the components stay the same.

Route: **`/app/integrations`** (`src/routes/_authenticated/app/integrations.tsx`,
a thin assembler rendering `<IntegrationList />` inside `AppShell` + `PageHeader`).

---

## What it displays

Each provider card shows a status badge, its capability tags and a compact
telemetry summary (**Health · Last sync · Errors**). A **Details** button opens a
side sheet with all six views:

| View              | Source                    | Contents                                                     |
| ----------------- | ------------------------- | ------------------------------------------------------------ |
| **Status**        | telemetry `status`        | state, connected, account count, last checked, message.      |
| **Health**        | telemetry `health`        | probe state (healthy/degraded/down), latency, checked-at.    |
| **Last Sync**     | telemetry `lastSync`      | last run, result, items processed, duration, cursor.         |
| **Errors**        | telemetry `errors`        | table of recent errors (time, code, message).                |
| **Configuration** | **real** `SettingsSchema` | each provider's settings fields + defaults (secrets masked). |
| **Logs**          | telemetry `logs`          | scrollable, level-tagged log stream.                         |

Configuration is the one view backed by real platform data — it reads each
provider's declared `SettingsManager.schema(id)`, so the form fields are accurate
even though their values are mock defaults.

---

## Architecture

No redesign: the existing components and shared UI primitives (`Card`, `Badge`,
`Button`, `Sheet`, `Tabs`, `Table`, `ScrollArea`, `Separator`) are reused; only
data wiring and a detail sheet were added.

```
route (/app/integrations)
  └─ IntegrationList ──────── useIntegrationCenter()  ← reactive
       ├─ IntegrationCard[]   (status badge + Health/Last sync/Errors summary + actions)
       └─ IntegrationDetail   (Sheet + Tabs: the six views)

useIntegrationCenter()  ── merges ──▶ IntegrationManager.catalog()  (metadata, real)
                          └───────────▶ MockTelemetryService        (telemetry, mock)
```

### The reactive data flow

- `MockTelemetryService` (`src/integrations/services/mock-telemetry.ts`) is a
  reactive store (`subscribe` / `getSnapshot`) — the same idiom as
  `IntegrationManager`. It seeds deterministic telemetry per provider id on
  construction (so renders don't flicker) and exposes mock actions
  (`connect` / `disconnect` / `sync` / `refresh` / `refreshAll`) that mutate the
  cached telemetry and publish.
- `useIntegrationCenter()` (`src/integrations/hooks/use-integration-center.ts`)
  subscribes via `useSyncExternalStore`, merges each provider's static
  **metadata** (real, from the manager catalog) with its **telemetry** (mock), and
  returns rows + action callbacks. `useIntegrationTelemetry(id)` is the
  single-provider variant for the detail sheet.
- Wired into the composition root: `getTelemetryService()` in
  `src/integrations/services/container.ts`.

### Actions

All actions are local and offline, so **every** provider (placeholders included)
is interactive:

- **Connect / Disconnect** — flips the provider's mock status and appends a log.
- **Sync** — updates Last Sync (fresh timestamp + item count) and logs it.
- **Refresh** / **Refresh all** — re-stamps the health probe time.

Nothing leaves the browser; a footer note in the detail sheet says so.

---

## Files

| File                                         | Role                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `services/mock-telemetry.ts`                 | Local reactive telemetry store + DTOs (status/health/last-sync/errors/logs). |
| `services/container.ts`                      | Adds `getTelemetryService()` to the composition root.                        |
| `hooks/use-integration-center.ts`            | `useIntegrationCenter` / `useIntegrationTelemetry` view models.              |
| `components/integration-card.tsx`            | Card with status badge, telemetry summary and actions.                       |
| `components/integration-detail.tsx`          | Sheet with the six tabbed views.                                             |
| `components/integration-list.tsx`            | The Center grid; owns detail-sheet + action wiring.                          |
| `components/format.ts`                       | Presentational helpers (relative time, health/log tone).                     |
| `routes/_authenticated/app/integrations.tsx` | Thin route page.                                                             |

---

## Swapping in real telemetry (later)

When providers are wired and a real telemetry backend exists:

1. Implement a telemetry reader with the same shape as `MockTelemetryService`
   (status/health/last-sync/errors/logs), reading from the providers'
   `healthCheck` / `sync` results and a persisted `integration_events` store.
2. Point `getTelemetryService()` at it in `container.ts`.

`useIntegrationCenter`, the cards, and the detail sheet are untouched — the mock
service is the seam.

---

## Related

- [`src/integrations/README.md`](../src/integrations/README.md) — platform overview.
- [`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) — full design.
- Provider capability docs: [`GITHUB.md`](./GITHUB.md), [`ACTIVITY_INTEGRATIONS.md`](./ACTIVITY_INTEGRATIONS.md), [`NOTIFICATIONS.md`](./NOTIFICATIONS.md), [`AUTOMATION.md`](./AUTOMATION.md), [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md).
