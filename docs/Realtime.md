# SpartaFlow — Supabase Realtime

> How live updates flow from Postgres to the UI: the publication, the channel
> manager, and the per-domain React hooks. This is the **implementation
> reference** for the code shipped in `src/lib/supabase/realtime.ts`,
> `src/hooks/use-realtime.ts`, and `src/features/realtime/`. The original
> conceptual design vision is retained in §9. Snapshot: 2026-07-01.

---

## 1. Layers

```
Component / provider
  └── useNotificationsRealtime(userId, { onChange, onResync })   ← src/features/realtime/hooks.ts
        └── useRealtimeSubscription(sub)                          ← src/hooks/use-realtime.ts  (auto-unsubscribe on unmount)
              └── subscribeToTable(sub) → realtimeManager         ← src/lib/supabase/realtime.ts (ref-count, reconnect, auth)
                    └── supabase.channel(...).on("postgres_changes", …)
                          └── Postgres → supabase_realtime publication  ← migration 20260701130000
```

| Layer         | File                                                          | Responsibility                                                           |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Publication   | `supabase/migrations/20260701130000_realtime_publication.sql` | Tables in `supabase_realtime` + `REPLICA IDENTITY FULL`                  |
| Transport     | `src/lib/supabase/realtime.ts`                                | `RealtimeManager`: ref-counted channels, reconnect/resync, auth sync     |
| React binding | `src/hooks/use-realtime.ts`                                   | `useRealtimeSubscription` — subscribe in an effect, tear down on unmount |
| Domain hooks  | `src/features/realtime/hooks.ts`                              | One scoped hook per domain                                               |
| Barrel        | `src/features/realtime/index.ts`                              | `@/features/realtime` public API                                         |

The transport layer is **framework-agnostic** (no React) and reuses the single
app Supabase client (`@/integrations/supabase/client`) — no duplicate client, so
auth token and socket are shared.

---

## 2. Connected domains

| #   | Domain                  | Hook                        | Table(s)                                | Default scope (filter)                 | State    |
| --- | ----------------------- | --------------------------- | --------------------------------------- | -------------------------------------- | -------- |
| 1   | **Notifications**       | `useNotificationsRealtime`  | `notifications`                         | `recipient_id=eq.<user>`               | live     |
| 2   | **Task Updates**        | `useTaskRealtime`           | `tasks`                                 | `project_id=eq.<project>`              | dormant¹ |
| 3   | **Task Assignments**    | `useTaskAssignmentRealtime` | `tasks`                                 | `assignee_id=eq.<user>`                | dormant¹ |
| 4   | **Comments**            | `useCommentsRealtime`       | `comments`                              | `parent_id=eq.<entity>`                | dormant¹ |
| 5   | **Mentions**            | `useMentionsRealtime`       | `mentions`                              | `mentioned_user_id=eq.<user>` (INSERT) | live     |
| 6   | **Daily Reports**       | `useDailyReportsRealtime`   | `daily_reports`, `daily_status_updates` | `user_id=eq.<user>` (or team-wide)     | live     |
| 7   | **Attendance**          | `useAttendanceRealtime`     | `attendance` (+ `work_sessions`²)       | `user_id=eq.<user>` (or team-wide)     | live     |
| 8   | **Dependency Requests** | `useDependencyRealtime`     | `dependency_requests`                   | none / custom (RLS-scoped)             | live     |

¹ **Dormant**: the `tasks` and `comments` tables don't exist yet. The hooks
compile and can be mounted today but stay **inert** — `isRealtimeEnabled(table)`
is `false`, so no channel is opened (no `CHANNEL_ERROR` noise). When those
tables land, add them to `PUBLISHED_TABLES` (and to the publication migration)
and the hooks light up with **no call-site changes**.

² `work_sessions` / `work_session_breaks` were already published in migration
`20260628201706`.

---

## 3. Requirements — how each is met

### Subscribe only to relevant channels

- Every domain hook takes a **scope id** and builds a Postgres `filter`
  (`recipient_id=eq.…`, `project_id=eq.…`). Only matching rows are streamed.
- When the scope id is missing the hook subscribes to **nothing** (passes `null`
  down) — the idiom for "wait until we know the user/project". Board-wide hooks
  (`useDependencyRealtime`, `teamWide` variants) rely on **RLS** to scope rows
  server-side.
- Channels are **ref-counted** by `(schema, table, event, filter)`: two
  components watching the same scope share one socket subscription.

### Automatically unsubscribe on page disposal

- `useRealtimeSubscription` subscribes inside `useEffect` and **returns the
  unsubscribe fn as the cleanup**, so React tears the channel down on unmount.
- It re-subscribes only when the channel identity (`table/event/filter/enabled`)
  changes; callbacks live in a ref, so ordinary re-renders don't churn the
  socket. The manager removes the underlying channel once the **last** subscriber
  for a key unsubscribes.

### Handle reconnects gracefully

- The Supabase socket auto-reconnects; channels auto-rejoin.
- The manager watches each channel's status. On `CHANNEL_ERROR` / `TIMED_OUT` it
  marks the channel **stale** and reports `reconnecting`. On the next
  `SUBSCRIBED` after a stale period it fires **`onResync`** so callers can
  **refetch** whatever changed while offline (Realtime does not replay missed
  events — the resync callback is how you reconcile).
- `window` `online` / `offline` events mark all channels stale, so any network
  blip triggers a resync on recovery.
- **Auth stays fresh**: the manager calls `supabase.realtime.setAuth(token)` from
  the current session and on every `onAuthStateChange`, so RLS-scoped streams
  keep flowing across token refreshes and re-auth on the correct identity.

---

## 4. Usage

### Notifications badge (live + reconnect refetch)

```tsx
import { useNotificationsRealtime } from "@/features/realtime";
import { useQueryClient } from "@tanstack/react-query";

function useNotificationBell(userId: string) {
  const qc = useQueryClient();
  useNotificationsRealtime(userId, {
    onChange: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
    onResync: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
    onStatus: (s) => s === "reconnecting" && console.debug("notifications reconnecting"),
  });
}
```

### Project task board (dormant until `tasks` ships)

```tsx
import { useTaskRealtime } from "@/features/realtime";

useTaskRealtime(projectId, {
  onChange: (payload) => applyTaskChange(payload.eventType, payload.new),
});
// No-op today; activates automatically once `tasks` is published.
```

### Team attendance dashboard (RLS-scoped, team-wide)

```tsx
import { useAttendanceRealtime } from "@/features/realtime";

useAttendanceRealtime(null, { onChange: refetchTeamAttendance }, { teamWide: true });
```

**Recommended pattern:** point `onChange` **and** `onResync` at a TanStack Query
`invalidateQueries` for the relevant key. Realtime becomes a cache-invalidation
signal; the query stays the single source of truth and reconnects self-heal.

---

## 5. The publication migration

`20260701130000_realtime_publication.sql` — idempotent (guards each `ADD TABLE`
against `pg_publication_tables`):

- Adds to `supabase_realtime`: `notifications`, `mentions`, `activity_feed`,
  `approval_requests`, `dependency_requests`, `daily_reports`,
  `daily_status_updates`, `attendance`, `attendance_sessions`, `break_sessions`.
- Sets `REPLICA IDENTITY FULL` on each so **UPDATE / DELETE** payloads carry the
  old row — required for filters on non-PK columns (e.g. `recipient_id`,
  `user_id`) to match on updates/deletes, and so `payload.old` is populated.

RLS is still enforced **per subscriber** by the Realtime server — a client only
receives change events for rows it is allowed to `SELECT`.

---

## 6. API reference

### `@/lib/supabase/realtime`

- `subscribeToTable(sub): () => void` — low-level subscribe (used by the hook).
- `realtimeManager` — the singleton (`subscribe`, `markAllStale`, `disposeAll`).
- `isRealtimeEnabled(table)` / `PUBLISHED_TABLES` — publication membership.
- `createBroadcastChannel` / `createPresenceChannel` — ephemeral channels
  (typing indicators, presence) with an `unsubscribe` fn.
- Types: `TableSubscription<Row>`, `PostgresEvent`, `RealtimeStatus`.

### `@/hooks/use-realtime`

- `useRealtimeSubscription(sub | null)` — generic React binding.

### `@/features/realtime`

- The eight domain hooks + `DomainHandlers<Row>` + re-exports of the above.

---

## 7. Limitations / next steps

1. **`tasks` / `comments` dormant** — activate by creating those tables, adding
   them to the publication + `PUBLISHED_TABLES`. No hook changes needed.
2. **Consumers not wired yet** — hooks are ready but not mounted in feature
   providers/pages (those features are still mock- or query-backed). Wiring is a
   per-feature follow-up: mount the hook, invalidate the matching query.
3. **No missed-event replay** — Realtime is fire-and-forget; the `onResync`
   callback (refetch) is the reconciliation path after a disconnect.
4. **Generated types** — `postgres_changes` payloads are typed via the hook's
   `Row` type param (default `Record<string, unknown>`). After regenerating
   `src/integrations/supabase/types.ts`, pass concrete row types for stronger
   payloads.

---

## 8. Files added / changed

```
supabase/migrations/
  20260701130000_realtime_publication.sql   # NEW — publication + replica identity

src/lib/supabase/
  realtime.ts                                # UPGRADED — RealtimeManager (ref-count, reconnect, auth)

src/hooks/
  use-realtime.ts                            # NEW — useRealtimeSubscription

src/features/realtime/
  hooks.ts                                   # NEW — 8 per-domain hooks
  index.ts                                   # NEW — barrel
```

`tsc --noEmit` clean · `eslint` clean · `vitest` 48 passing.

---

## 9. Design vision (aspirational — retained from the original plan)

The following patterns were specified in the original realtime design and remain
the intended direction. They go **beyond** what is implemented today and, where
they name tables, use the earlier proposed schema (e.g. `announcements`,
`dependencies`, `morning_checkins`) rather than the shipped tables
(`dependency_requests`, `daily_reports`/`daily_status_updates`). Treat this
section as forward-looking guidance, not current behaviour.

**Channel patterns.** Beyond scoped `postgres_changes`, three topic conventions:
per-user `user:{id}`, per-team `team:{id}`, per-department `department:{id}`, plus
an admin-only `org:ops`. Subscribe authorization enforced via Realtime
authorization (RLS on `realtime.messages` for Broadcast/Presence, Postgres RLS
for Postgres Changes). `createBroadcastChannel` / `createPresenceChannel` in the
transport layer already provide the primitives for these.

**Broadcast events** (ephemeral, never hit Postgres): `presence.online`,
`dependency.typing`, `manager.ping`.

**Presence**: `team:{id}` channels track who's online (`available` /
`in_meeting` / `on_break`), status piggy-backing on break start/end.

**Fan-out strategy.** Avoid org-wide `postgres_changes`. Company-wide events fan
out as **one `notifications` row per recipient** (RLS naturally scopes delivery
to each user's `user:{me}` channel) instead of a single mega-topic. Manager
dashboards subscribe **per-team** to spread load. Target ≤ 5 active channels per
typical client.

**Backpressure & reconnect.** Wrap subscribers in a TanStack Query cache writer
that invalidates affected queries on reconnect (implemented today via the
`onResync` callback). Heartbeat/stall detection (force reconnect if a channel is
silent > 60 s) and jittered exponential backoff are future hardening.

**Kill switch.** A `realtime.enabled` feature flag should fall the UI back to
30 s polling during incidents.

**Performance targets.** Median publish→render ≤ 500 ms intra-region; Realtime
CPU ≤ 60% at peak.

**Edge cases.** Role revoked while subscribed → `user_roles` UPDATE forces a `me`
refetch and unsubscribe from now-disallowed channels; announcement republished →
dedupe by id; notification read in tab A → UPDATE updates the badge in tab B;
suspended user → sessions revoked, subscriptions close, redirect to `/auth`.
