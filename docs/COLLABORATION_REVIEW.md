# Collaboration Module — Review

_Date: 2026-07-01 · Scope: notifications, mentions, preferences, realtime, approvals/activity feed._

Reviewed the collaboration surface end-to-end:

- **Data layer** — `supabase/migrations/20260701120000_collaboration_core.sql`, `20260701130000_realtime_publication.sql`
- **Services** — `src/services/notifications/*`, `src/services/approvals/*`, `src/services/activity/*`
- **Repositories** — `src/repositories/notifications/*`
- **Realtime** — `src/lib/supabase/realtime.ts`, `src/hooks/use-realtime.ts`, `src/features/realtime/hooks.ts`
- **Feature runtime** — `src/features/notifications/*` (event bus, automation engine, store, channels, preferences, directory, UI)

**Fix policy for this pass:** only **critical** (app-breaking / data-integrity) issues were fixed. Everything else is documented below as a recommendation.

---

## Severity summary

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | Performance / Realtime | `useNotifications` returned a new array each `getSnapshot()` → React 19 infinite re-render loop | **Critical** | ✅ Fixed |
| 2 | Realtime / Performance | Every realtime event triggers a full inbox re-fetch (`hydrate()`), unbounded and un-coalesced | Medium | Recommended |
| 3 | Performance / Repositories | `inbox()` fetches with no `limit`/pagination (up to the 1000-row PostgREST cap) | Medium | Recommended |
| 4 | Duplicate events | Two unreconciled generation paths + no idempotency key on fan-out | Medium | Recommended |
| 5 | Repositories | Two preference sources of truth (Supabase table vs localStorage mock) | Medium | Recommended |
| 6 | Permissions | Cross-user fan-out impossible from client (insert-self RLS); server function not yet built | Low (by design) | Noted |
| 7 | Security | `href` navigation should be allowlisted to internal paths | Low (hardening) | Recommended |
| 8 | Memory | Singleton `onAuthStateChange` listeners never unsubscribed | Low (bounded) | Noted |

---

## 1. Critical — infinite re-render loop (FIXED)

**File:** `src/features/notifications/store.ts`

`useNotifications` / `notificationStore.listFor` derived their result with `read().filter().sort()`, producing a **fresh array reference on every call**. The empty branch returned a fresh `[]` literal too. `useSyncExternalStore` (React 19) requires `getSnapshot` to return a **stable reference between store changes** — a new reference each call makes React re-render endlessly ("The result of getSnapshot should be cached to avoid an infinite loop").

This is live, not latent: `NotificationDropdown` is always mounted in `src/components/layout/topbar.tsx` and calls `useNotifications(userId)`; `notification-center` and `notification-widgets` do the same.

**Fix:** memoize the derived views (`listMemo`, `listForMemo`) and clear them inside `write()`, so each `getSnapshot()` returns the same array until the store actually mutates. The "no user" snapshot now returns a shared `EMPTY_LIST` constant.

```ts
let listMemo: AppNotification[] | null = null;
const listForMemo = new Map<string, AppNotification[]>();
const EMPTY_LIST: AppNotification[] = [];

function write(next: AppNotification[]) {
  cache = next;
  listMemo = null;         // invalidate on every mutation
  listForMemo.clear();
  listeners.forEach((l) => l());
}
```

`useUnreadCount` was unaffected — it returns a `number`, which is value-stable. All 90 unit tests and `tsc --noEmit` pass after the change.

---

## 2. Realtime — full re-fetch per event (recommended)

**File:** `src/features/notifications/store.ts` → `setNotificationUser`

```ts
onChange: () => void hydrate(),
onResync: () => void hydrate(),
```

Every `INSERT`/`UPDATE`/`DELETE` on `notifications` re-fetches the **entire** inbox. Because the subscription uses `event: "*"` (default), the store's own optimistic writes (mark-read, archive) echo back as `UPDATE`s and trigger another full refetch. Under a burst (e.g. sprint fan-out) this is N full list queries.

The realtime infrastructure itself is solid: `src/lib/supabase/realtime.ts` ref-counts channels, keeps the realtime auth token in sync across refreshes, marks channels stale on `offline`/error and fires `onResync` on rejoin, and the migration sets `REPLICA IDENTITY FULL` so filtered UPDATE/DELETE payloads resolve. The issue is purely the consumer's refetch strategy.

**Recommendation:** apply the `payload.new`/`payload.old` row incrementally to the cache (upsert on INSERT/UPDATE, drop on DELETE) and reserve full `hydrate()` for `onResync` only; or debounce/coalesce `hydrate()` (e.g. trailing 250 ms).

---

## 3. Performance — unbounded inbox query (recommended)

**Files:** `src/repositories/notifications/notification.repository.ts` → `inbox()`, `src/services/notifications/notifications.service.ts` → `listForRecipient()`

`inbox()` calls `list()` with no `limit`/`offset`, so it returns up to PostgREST's default cap (1000 rows) and the store re-derives (filter+sort) that whole set on each `useMinuteTick`. Fine at low volume; degrades as history grows.

**Recommendation:** default `inbox()` to a bounded page (e.g. `limit: 50`, newest-first) and add "load more"/pagination for history. The badge already uses a `head:true` count query (`unreadCount`) — good; keep that path.

---

## 4. Duplicate events (recommended)

Two generation paths exist and are **not reconciled**:

- **Client runtime** — `event-bus.ts` → `automation-engine.ts` → `rules.ts` → `notificationStore.addMany()` with local `ntf_*` ids.
- **Persistent** — the `notifications` table (hydrated by the store, streamed via realtime), plus the pure mapping in `src/services/notifications/rules.ts`.

`automation-engine` adds local notifications to the store, but the next `hydrate()` (triggered by any realtime event) calls `write(rows…)` and **overwrites the whole cache**, silently discarding the client-generated rows. So today client notifications are transient; no duplicates accumulate, but the two paths disagree about the source of truth.

There is also **no idempotency key**: `automationEngine.dispatch` produces a notification per matching rule per event, and `store.addMany` de-dupes only by generated notification `id` (always fresh), not by `eventId`. When the server-side fan-out is built, a double-published event or a retry will create duplicate rows.

**Recommendation:**

- Pick one source of truth. If persistence wins, the automation engine should write through a fan-out function rather than only into the in-memory store.
- Add a dedupe/idempotency key to generated notifications — e.g. a unique `(recipient_id, event_name, entity_id)` partial index or an `event_id` column — so retries are naturally idempotent. `src/services/notifications/rules.ts::generateNotification` is the right choke point to stamp it.

---

## 5. Repositories — split preference state (recommended)

- `src/repositories/notifications/notification-preference.repository.ts` → Supabase `notification_preferences` (RLS-scoped, `categories`/`channels`/`quiet_hours`).
- `src/features/notifications/preferences.ts` → **localStorage** mock (`sf:notifications:prefs:v1`).

The automation engine's mute gate (`specToNotifications` → `prefs.categories[...] === false`) and the preferences UI read the **localStorage** copy. Muting a category therefore does **not** persist to `notification_preferences`, and won't apply on another device or to any server-side fan-out. Note also the category key sets differ (the mock adds `tasks`; the DB enum uses `system`).

Repositories themselves are clean: thin, RLS-scoped, singleton-exported, correct delegation to services.

**Recommendation:** back `preferences.ts` with `notificationPreferenceRepository` (read-through cache), and align the category keys with the `notification_category` enum used by `src/services/notifications/rules.ts::CATEGORY_BY_EVENT`.

---

## 6. Permissions (noted — by design)

RLS in `20260701120000_collaboration_core.sql` is strong and consistent:

- `notifications`: recipient-scoped `SELECT`/`UPDATE`/`DELETE`; `INSERT` restricted to **self** (`recipient_id = auth.uid()`).
- `mentions`: readable by the mentioned user or the author; author-only insert; recipient-only "mark seen"; author-only delete.
- `approval_requests` / `approval_actions`: scoped to requester, assignee, or elevated roles (`owner`/`super_admin`/`hr`); actions append-only.
- `activity_feed`: readable by the actor, project members, or elevated roles; append-only.
- Grants to `authenticated` / `service_role` only — never `anon`.

**Consequence (not a hole):** the insert-self policy means a browser client **cannot** create a notification addressed to another user. Real cross-user fan-out (task assigned → notify assignee, sprint started → notify team) must run server-side under a `SECURITY DEFINER` function or edge function with the service role. That function does not exist yet, so notifications aimed at *other* users are currently never persisted. This is the intended architecture (the migration comments say as much) — flagging it so the fan-out function isn't forgotten.

---

## 7. Security (mostly clean; one hardening)

- **XSS:** no `dangerouslySetInnerHTML` in any notification component; titles/bodies render as escaped React text. No stored-XSS vector from notification content. ✅
- **Service keys:** the service layer wraps the anon client (`src/services/core/client.ts`); no service key in the browser bundle. ✅
- **`href` navigation (hardening):** notifications and `actions[]` carry an `href` used for navigation. The rule builders currently emit internal paths, but nothing validates it at the render site. If any `href` ever originates from user-controlled `payload`, an anchor could carry `javascript:` or an off-site open-redirect.
  **Recommendation:** allowlist `href` to app-internal paths (`startsWith("/")`, reject `javascript:`/`data:`/absolute external) before binding it to an `<a>`/router link.

---

## 8. Memory (noted — bounded)

No growing leaks found:

- `src/features/notifications/store.ts` tears down and rebinds `realtimeUnsub` on user change; the new memo caches are cleared on every `write()` (bounded).
- `event-bus.ts` caps `recent` at `MAX_RECENT = 200`.
- `useMinuteTick` clears its `setInterval` on unmount.
- `realtime.ts` ref-counts channels and removes them when the last subscriber unsubscribes.

**Minor:** `bootstrap.ts` and `realtime.ts::wireAuth` register `supabase.auth.onAuthStateChange(...)` and never unsubscribe. These are app-singletons (guarded by `bootstrapped`/`authWired`), so it's one persistent listener each for the app's lifetime — bounded, not a growing leak. If the bootstrap is ever made re-runnable, retain and dispose the returned `subscription`.

---

## What changed in this pass

- **Fixed (critical):** memoized derived snapshots in `src/features/notifications/store.ts` to stop the `useSyncExternalStore` infinite-render loop.
- Everything else above is left as a documented recommendation per the "fix only critical issues" scope.

_Verification: `npx tsc --noEmit` clean; `npm test` → 90 passing._
