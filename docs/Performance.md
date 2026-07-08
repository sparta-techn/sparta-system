# Performance — SpartaFlow Hub (Backend)

Targets and the database-layer techniques used to meet them. Application-layer guidance (code splitting, image budgets) lives in the architecture-phase docs.

## 1. SLOs

| Surface                                         | P50    | P95           | P99           |
| ----------------------------------------------- | ------ | ------------- | ------------- |
| Auth sign-in                                    | 250 ms | 600 ms        | 1 s           |
| `getMe` (session hydration)                     | 80 ms  | 200 ms        | 400 ms        |
| Dashboard initial load (server fn)              | 150 ms | 400 ms        | 800 ms        |
| List queries (attendance/dependencies, 50 rows) | 80 ms  | 250 ms        | 500 ms        |
| Single-row mutations                            | 80 ms  | 250 ms        | 600 ms        |
| Realtime delivery (publish → client)            | 200 ms | 500 ms        | 1.5 s         |
| Background jobs (pg_cron)                       | n/a    | within window | within window |

Error budget: 99.9% monthly availability for sign-in and dashboards.

## 2. Index Strategy

Indexes follow access patterns, not column heuristics. Highlights (full set lives next to each table in `DatabaseSchema.md`):

- `attendance(user_id, work_date desc)`, `attendance(work_date)`, `attendance(status, work_date)`.
- `dependencies(assignee_user_id, status)`, `dependencies(assignee_team_id, status)`, partial `(due_at) where status not in ('resolved','cancelled')`.
- `notifications(user_id, read_at) where archived_at is null`.
- `audit_logs(target_table, target_id, occurred_at desc)`, BRIN on `occurred_at`.
- `announcements(published_at desc) where deleted_at is null`, GIN on `audience_ids`.
- `user_roles(user_id) where revoked_at is null`.
- Full-text: GIN `to_tsvector('simple', coalesce(title,'')||' '||coalesce(body_md,''))` for announcements; `pg_trgm` GIN on `profiles.display_name`, `profiles.full_name` for directory search.

Indexes maintained as part of the table migration that introduces the query pattern. New indexes need an EXPLAIN-with-data justification in the PR.

## 3. Query Patterns

- All list endpoints use **keyset/cursor pagination**: `where (created_at, id) < ($cursor_ts, $cursor_id) order by created_at desc, id desc limit 50`. No `OFFSET` for paginated lists.
- Aggregations for dashboards prefer **materialized views** refreshed on a schedule (`mv_company_health_daily`, `mv_user_perf_weekly`) over on-demand `GROUP BY` against raw tables.
- Heavy joins for manager dashboards expressed as **views** with `security_invoker = on` so the planner sees the policies and can prune.
- Avoid `select *` everywhere — TypeScript types are generated from the explicit projections used in server fns.

## 4. Materialized Views

| MV                        | Refresh                    |
| ------------------------- | -------------------------- |
| `mv_company_health_daily` | every 15 min, CONCURRENTLY |
| `mv_user_perf_weekly`     | nightly 02:00              |
| `mv_dependency_aging`     | every 30 min               |
| `mv_team_daily_health`    | every 10 min               |

Refresh jobs check stale-or-skip flags to coalesce when traffic is low.

## 5. Connection Management

- Browser uses Supabase WS + REST — no pooled connections to manage.
- Server fns hit Postgres through Supabase REST/SQL. For Edge Functions that need raw SQL, use Supabase **transaction pooler** to keep ephemeral connections cheap.
- Long-running maintenance (exports, refreshes) uses `application_name='maintenance'` so it's easy to identify and `pg_terminate_backend()` if needed.

## 6. RLS Performance

- Policies use SECURITY DEFINER helpers (`has_role`, `manages_team`) marked `STABLE` so the planner can cache within a query.
- Helpers index lookups by `(user_id)` on `user_roles` and `(team_id, user_id)` on `team_members`.
- For super-hot queries (e.g. `getMe`), the helper output is sometimes inlined as a CTE the policy reads from to avoid repeated lookups.

## 7. Caching

- TanStack Query on the client with sensible `staleTime` (60 s for lists, 5 min for `me`, infinite for static reference data).
- Server-side: Postgres prepared statements (Supabase auto), and `materialized views` for derived data. No app-layer Redis required at current scale.
- HTTP caching: public buckets behind CDN with immutable filenames; private signed URLs short-TTL.

## 8. Search

- Directory search: `pg_trgm` on `display_name`, `full_name` with `gin_trgm_ops`. Threshold tuned for ≤ 50 ms median.
- Announcements / EOD report search: tsvector + GIN.
- For company-wide free-text across multiple tables (future), introduce a single `search_documents` table populated by triggers — avoids cross-table tsvector unions.

## 9. Realtime

- Narrow publication (see `Realtime.md`).
- Per-team channels keep payload counts bounded.
- Replication lag monitored; alert at > 5 s.

## 10. Pagination & Filtering Patterns

Standard list endpoint contract (server fn):

```
input: { cursor?: { created_at, id }, limit: number<=100, filters: {...}, sort: 'created_at'|'priority' }
output: { rows[], next_cursor?, total_estimate? }
```

`total_estimate` derived from `pg_class.reltuples` for large tables (never `count(*)` on hot paths). Exact counts only on filtered queries with selective indexes.

## 11. Bulk Operations

- Bulk inserts (CSV imports, seed data) use `COPY` via Edge Function with row-level RLS bypass (service role) plus app-level permission check.
- Bulk updates throttled (`update … where ctid in (select … limit 5000)` looped) to avoid locking storms.

## 12. Observability

- `pg_stat_statements` on; nightly job exports the top-50 slowest statements to `metrics`.
- Logflare alerts on query > 500 ms median.
- `auto_explain` on for queries > 1 s in non-prod.
- Sentry transaction spans on every server fn with DB attribution.

## 13. Capacity Planning

| Resource              | Today  | 12-month target |
| --------------------- | ------ | --------------- |
| Active employees      | 100    | 1,000           |
| Daily attendance rows | 100    | 1,000           |
| Daily workflow rows   | ~300   | ~3,000          |
| Dependencies / month  | ~500   | ~5,000          |
| Notifications / day   | ~2,000 | ~20,000         |
| DB size after 1 yr    | < 5 GB | < 50 GB         |
| Realtime concurrent   | < 200  | < 2,000         |

Supabase tier sized to 2× expected peak; vertical scaling path documented before saturation.

## 14. Anti-patterns (forbidden)

- `select count(*)` on `audit_logs`/`activity_logs` in user-facing paths.
- `OFFSET` pagination on hot endpoints.
- `select *` in server fns.
- Querying base tables when a view/MV already projects the answer.
- Creating indexes "just in case" without an EXPLAIN-backed justification.
- N+1 patterns in server fns (use joins / single round trip).

---

# Performance — SpartaFlow Hub (Frontend / Application)

The sections above cover the **database layer**. This part covers the
**client/application layer**: bundle, rendering, query caching, and asset
strategy. Stack: React 19 + TanStack Start (SSR) + TanStack Router + TanStack
Query + Vite 8. Routes are file‑based and **automatically code‑split** by the
TanStack Router plugin.

## A. TL;DR — what changed in this pass

| Area          | Change                                                                                                                          | File                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Query caching | Global `QueryClient` defaults: `staleTime` 60s, `gcTime` 5m, `refetchOnWindowFocus: false`, `retry: 1`                          | `src/router.tsx`                                                                  |
| Navigation    | Enabled `defaultPreload: "intent"` (100ms delay, 30s preload stale time) for instant route transitions                          | `src/router.tsx`                                                                  |
| Rendering     | `React.memo` on hot, pure leaf components rendered per row/card                                                                 | `status-badge`, `employee-chip`, `badges`, `task-card`, `kanban-card`, `task-row` |
| Rendering     | Stabilized the row‑selection callback (`useCallback` + functional update) so memoized rows don't re‑render on sibling selection | `tasks-list.tsx` + `task-row.tsx`                                                 |

All changes are behavior‑preserving. `tsc --noEmit` is clean, **157/157 tests
pass**, and the production build succeeds. Only **safe** optimizations were
applied; higher‑risk items are listed under §M as recommendations.

## B. Bundle size — 🟢 healthy, framework‑managed

- Production build emits **232 client JS chunks** — routes and heavy vendor
  libraries are already split.
- `index-*.js` ~430 KB is the shared vendor baseline (React + TanStack
  Router/Query core), cached across all routes. Per‑route chunks are small and
  lazy (`executive` ~83 KB, `integrations` ~60 KB, `projects.$id` ~55 KB,
  `tasks.$id` ~38 KB) and load only when the route is visited.
- `recharts` (heaviest feature dep) is imported through a **single chokepoint**,
  `src/components/ui/chart.tsx`, and only lands in analytics/executive chunks —
  never in the initial load.
- `lucide-react` icons are imported **by name** everywhere → tree‑shakeable. No
  barrel / `import * as` usage.

No action taken; the framework's automatic splitting is correct.

## C. Lazy‑loaded routes — 🟢 automatic

Every `src/routes/**` file becomes its own chunk via `@tanstack/router-plugin`.
No manual `React.lazy` is needed for routes and none should be added.

## D. React rendering — 🟡 improved

Large lists (tasks list/table/cards, kanban columns) render from
`useSyncExternalStore` stores. Before this pass there were **zero** `React.memo`
usages, so any parent re‑render (selection, filter) re‑rendered every row plus
every badge/avatar inside it.

Applied:

- Wrapped pure, primitive‑prop leaves in `React.memo`: `StatusBadge`,
  `EmployeeChip`, `TaskStatusBadge` / `TaskPriorityBadge` / `TaskLabelChip`,
  `TaskCard`, `KanbanCard`, `TaskRow`.
- **Stabilized the selection callback** in `tasks-list.tsx`: replaced the
  per‑row inline closure `onSelectChange={(c) => toggle(t.id, c)}` with one
  `useCallback` handler `onToggle(id, next)` using a functional state update.
  Without this, `memo(TaskRow)` would be defeated by a fresh callback identity
  each render. Now toggling one row's checkbox no longer re‑renders siblings.

Safe because memoized components are pure functions of their props; their
internal `useTasksState` subscriptions still refresh them when task data
actually changes — memo only skips renders caused by unrelated parent updates.

## E. Query caching — 🟡 improved

Only `attendance` and `hr` use TanStack Query today; most feature data flows
through localStorage‑backed stores (seed layer awaiting Supabase wiring). The
`QueryClient` had **no defaults**, so every query used `staleTime: 0`,
`refetchOnWindowFocus: true`, `retry: 3`.

Applied (`src/router.tsx`):

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // no redundant refetch on remount/nav
      gcTime: 5 * 60_000, // keep unused data 5m → instant revisits
      refetchOnWindowFocus: false, // no refetch storm on tab focus
      retry: 1, // fail fast instead of 3× latency
    },
  },
});
```

Consistent with §7 above (60s lists / 5min `me`). Per‑query overrides still win
— e.g. `features/attendance/queries.ts` keeps 15s for live status. The global
value is only a floor for queries that don't set their own.

## F. Images — 🟢 negligible surface

Only **2** `<img>` tags in the codebase; avatars are pure CSS (initials on an
`hsl()` background, see `EmployeeChip`). Fonts are self‑hosted variable fonts
(`@fontsource-variable/*`) imported in `styles.css` — no render‑blocking font
CDN. Nothing to optimize; if raster images are added, set width/height and
`loading="lazy"`.

## G. Icons — 🟢 already optimal

`lucide-react` imported by named export throughout → tree‑shaken to used icons
only. No change.

## H. Memoization — 🟡 see §D

`useMemo` (54 sites) and `useCallback` (32 sites) already cover expensive
derivations (filter/sort in `tasks-list`, `kanban-board`). The gap was
**component** memoization (`React.memo`), now addressed for the hottest leaves.

## I. Pagination — 🟢 layer ready

`src/services/core/base-service.ts` exposes offset (`list({ limit, offset })` →
`.range()`) and page‑addressed (`paginate({ page, pageSize })` with
`count: "exact"`) helpers, and `src/components/ui/pagination.tsx` exists. (Note:
§10/§14 above prescribe keyset pagination for hot DB endpoints — prefer that for
large tables; the offset helper is fine for small, bounded lists.) Wiring lists
to these is per‑feature work for when screens leave mock data.

## J. Virtual scrolling — 🟡 not present (deferred)

No virtualization library installed. Current lists come from small seed data, so
virtualization is not yet warranted and would add premature complexity. Revisit
when real datasets (hundreds+ rows) land — see §M.

## K. Loading states — 🟡 partial

`isLoading`/`isPending` handled in 5 files (attendance/hr consumers). Most
screens read synchronously from local stores, so async surface is small today.
No route defines a `pendingComponent` yet — a cheap win once routes gain async
loaders (§M).

## L. Skeletons — 🟢 pattern established

`Skeleton` primitive (`src/components/ui/skeleton.tsx`) used in 4 places,
including `TasksList` (6 skeleton rows while `loading`). Extend this pattern to
new async screens instead of spinners.

## M. Recommendations (deferred — not applied)

Not "safe drop‑ins"; each needs a feature decision or real data volume:

1. **Route‑level `pendingComponent` + skeletons.** As routes gain async
   (Supabase) loaders, add a `pendingComponent` (per‑route or shared on the
   `_authenticated` layout) so navigation shows a skeleton. Pairs with the
   `defaultPreload: "intent"` now enabled.
2. **Virtualize long lists — only when needed.** If tasks/attendance/audit lists
   exceed ~150–200 visible rows, adopt `@tanstack/react-virtual` for
   `TasksList`, kanban columns, and `attendance-history-table`. Keep the simple
   render for small lists (virtualization complicates scroll/DnD).
3. **Server pagination on list screens.** When features leave mock data, consume
   `BaseService.paginate()` / keyset cursors (§10) + the `Pagination` component
   instead of loading all rows.
4. **Split `recharts` further if it spreads.** Already isolated to analytics
   routes; if chart usage grows, lazy‑import `components/ui/chart.tsx` behind a
   `React.lazy` boundary.
5. **Consider `defaultPreloadStaleTime: 0` with query‑driven loaders.** If route
   loaders adopt `queryClient.ensureQueryData`, let React Query own the cache to
   avoid double‑caching. Revisit once such loaders exist.

## N. How to re‑measure

```bash
# Bundle: build and inspect client chunks
npx vite build
find .output/public -name '*.js' | xargs ls -la | sort -k5 -rn | head -20

# Correctness gates (keep green after any perf change)
npx tsc --noEmit
npx vitest run

# Rendering: React DevTools Profiler on /app/tasks/all and /app/tasks/kanban —
# toggle a selection / drag a card and confirm only touched rows re-render.
```

_Frontend section last updated: 2026-07-02. Keep §A's table current when you
touch these areas._
