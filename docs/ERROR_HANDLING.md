# Error Handling — Implementation Reference

> Companion to [`ErrorHandling.md`](./ErrorHandling.md), which is the **design
> spec** (target taxonomy, canonical `AppError`, observability rituals). This
> document describes **what is wired in the codebase today**, how the pieces fit
> together, and how to use them. Where the spec is still aspirational
> (correlation IDs, circuit breakers, Sentry), that's called out in §9.

The system has two halves:

1. **Domain error contracts** (already present, per layer) — every service /
   provider normalizes its failures into one typed shape so the UI never
   handles raw Supabase/PostgREST/provider errors.
2. **Presentation-layer handler** (`src/lib/errors.ts`) — a single place that
   turns *any* of those shapes (or a raw throw) into a **category**, a
   **user-safe message**, and a **retry decision**, plus the global wiring that
   applies them.

---

## 1. Building blocks

| Concern | Module | Notes |
| --- | --- | --- |
| Data-layer errors | `src/services/core/errors.ts` — `ServiceError`, `toServiceError`, `notFound` | Every service method wraps failures here. |
| Auth error messages | `src/features/auth/errors.ts` — `mapAuthError` | Sanitized (no account enumeration). |
| Integration errors | `src/integrations/services/errors.ts` — `IntegrationError` | Stable `IntegrationErrorCode`. |
| AI errors | `src/ai/utils/errors.ts` — `AIError` | Stable `AIErrorCode`. |
| **Central handler** | **`src/lib/errors.ts`** | `classifyError`, `getErrorMessage`, `shouldRetry`, `retryDelay`, `isSessionExpired`, `reportError`. |
| **Error boundary** | **`src/components/error-boundary.tsx`** | `ErrorBoundary`, `ErrorFallback`. |
| **Full-page screens** | **`src/components/error-screen.tsx`** | `ErrorScreen`, `OfflineScreen`. |
| Inline fallbacks | `src/components/states.tsx` — `ErrorState`, `EmptyState`, `LoadingState`, `ListSkeleton` | Pre-existing state primitives. |
| Connectivity | **`src/hooks/use-online-status.ts`**, **`src/components/layout/connection-banner.tsx`** | Ambient offline banner. |
| Realtime transport | `src/lib/supabase/realtime.ts` | Ref-counted channels, reconnect + resync. |
| Global wiring | `src/router.tsx`, `src/routes/__root.tsx`, `src/components/layout/app-shell.tsx` | See §8. |
| SSR/server errors | `src/server.ts`, `src/start.ts`, `src/lib/error-page.ts`, `src/lib/error-capture.ts` | 500 wrapper + stack recovery. |

**Bold** = added/changed in this pass. Everything else was already in place and
is reused, not duplicated.

---

## 2. The central handler — `src/lib/errors.ts`

The one import the UI and data layers should reach for.

```ts
type ErrorCategory =
  | "network" | "auth" | "permission" | "not_found"
  | "validation" | "rate_limit" | "server" | "unknown";

classifyError(error): ErrorCategory   // structured codes/status first, then message sniff
getErrorMessage(error): string        // concise, user-safe copy (auth → mapAuthError)
isNetworkError(error): boolean
isAuthError(error): boolean
isSessionExpired(error): boolean       // expired vs. never-signed-in
isRetryable(error): boolean
shouldRetry(failureCount, error): boolean   // TanStack Query `retry`
retryDelay(attempt): number                 // exp backoff + jitter, capped 15s
reportError(error, context?): void          // → reportLovableError, tagged w/ category
```

**Classification order** (first match wins): offline/network → Supabase
`AuthError` → HTTP status (401/403/404/400·422/429/5xx) → stable codes
(`ServiceError`/`IntegrationError`/PostgREST like `PGRST116`, `42501`, `23505`)
→ message fallbacks for JWT/session. This ordering means a real server reply is
always trusted over message text, and message sniffing only rescues raw `fetch`
failures that never reached a service.

---

## 3. Error Boundary + Fallback Components

`src/components/error-boundary.tsx` provides a class `ErrorBoundary` for
**sub-route isolation** (TanStack Router already covers route-level errors — see
§8). It catches render/lifecycle errors, reports once via `reportError`, and
renders a fallback.

```tsx
// Isolate a widget so its crash doesn't take down the dashboard:
<ErrorBoundary variant="inline" context={{ boundary: "kpi-widget" }}>
  <RevenueChart />
</ErrorBoundary>

// Auto-recover when the thing it depends on changes (e.g. route param):
<ErrorBoundary resetKeys={[projectId]}>
  <ProjectPanel id={projectId} />
</ErrorBoundary>

// Custom fallback (element or render fn):
<ErrorBoundary fallback={({ error, reset }) => <MyFallback error={error} onRetry={reset} />}>
  <Thing />
</ErrorBoundary>
```

Fallbacks:
- `ErrorFallback` (default) — `variant="inline"` → `ErrorState` card with a
  "Try again" button; `variant="page"` → full-page `ErrorScreen`.
- `ErrorScreen` / `OfflineScreen` (`error-screen.tsx`) — the canonical
  **user-friendly full-page screens**. No stack traces; copy is derived from
  `getErrorMessage(error)` unless a `title`/`description` is passed.

The boundary hierarchy (spec §14) is realized as:

| Spec layer | Where |
| --- | --- |
| Global ErrorBoundary | `__root.tsx` wraps `<Outlet/>` (`variant="page"`). |
| Route ErrorBoundary | TanStack `errorComponent` on the root route → `ErrorScreen`. |
| Feature ErrorBoundary | `app-shell.tsx` wraps page `{children}` (`variant="inline"`) so the sidebar/topbar survive a feature crash. |
| Widget ErrorBoundary | Opt-in: wrap any streamed widget with `<ErrorBoundary variant="inline">`. |

---

## 4. API Error Handler (global query/mutation wiring)

`src/router.tsx` attaches global handlers to the `QueryClient`:

- **`QueryCache.onError`** — `reportError` always; redirect on session expiry
  (§5); toast **only** when a *background* refetch fails while stale data is
  still on screen (`query.state.data !== undefined`) — the one case with no
  inline error UI. Fresh loads render their own `ErrorState` via
  `useQuery().error`, so we don't double-report with a toast.
- **`MutationCache.onError`** — `reportError` + a friendly `toast.error(...)` by
  default (writes rarely have inline error UI).

**Opt out** of the global toast per query/mutation with meta:

```ts
useQuery({ queryKey, queryFn, meta: { suppressGlobalError: true } });
useMutation({ mutationFn, meta: { suppressGlobalError: true } });
```

Services keep raw persistence details out of the UI by throwing `ServiceError`
(`toServiceError`) — the handler above then maps that to a category + message.

---

## 5. Authentication Errors

- **At navigation**: `_authenticated/route.tsx` `beforeLoad` calls
  `supabase.auth.getUser()` and `redirect`s to `/auth` (with `redirect` search)
  when there is no valid user.
- **Mid-session expiry**: when any query/mutation fails auth, the global handler
  calls `handleSessionExpiry(error)` → if `isSessionExpired(error)` it does a
  one-shot `window.location.assign("/auth/session-expired")`. A module-level
  flag prevents a redirect storm from simultaneous 401s, and it never fires on
  `/auth/*` routes (no loop).
- **Message safety**: `getErrorMessage` routes auth errors through
  `mapAuthError`, which returns generic copy ("Incorrect email or password")
  to avoid account enumeration.
- `AuthProvider` (`features/auth/auth-context.tsx`) already tolerates identity
  load failures (logs, clears profile/roles) without crashing.

---

## 6. Realtime Errors

Handled at the transport in `src/lib/supabase/realtime.ts` (unchanged — already
robust) and surfaced to callers:

- **Reconnect**: the socket auto-retries; the manager marks channels `stale` on
  `CHANNEL_ERROR`/`TIMED_OUT`, emits `onStatus("reconnecting")`, and on rejoin
  fires **`onResync`** so callers refetch anything missed.
- **Auth sync**: the Realtime token tracks the session across refreshes so
  RLS-scoped changes keep flowing.
- **Network**: `online`/`offline` events mark all channels stale → resync on
  return.

Consume per-domain via `DomainHandlers` (`features/realtime/hooks.ts`):

```ts
useNotificationsRealtime(userId, {
  onChange: (payload) => { /* apply */ },
  onResync: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  onStatus: (s) => setLive(s === "subscribed"),
});
```

The ambient offline state is shown by `ConnectionBanner`. A per-feature "Live
updates paused" indicator (spec §7) can be built from `onStatus` where desired.

---

## 7. Network Retry Strategy

Defined once in `src/lib/errors.ts`, applied via `QueryClient` defaults:

| Operation | Policy |
| --- | --- |
| Reads (`useQuery`) | `retry: shouldRetry` → up to **3** attempts, **only** for `network`/`server`/`unknown`. `retryDelay` = `min(2^n·1000, 15s)` + jitter. |
| `auth`/`permission`/`not_found`/`validation`/`rate_limit` | **Never** retried — fail fast so the user sees the real problem. |
| Writes (`useMutation`) | `retry: false` — a retried mutation can double-apply. Offer a manual "Try again" (the error toast + re-submit). |
| Realtime | Socket-level auto-reconnect with backoff + `onResync` (§6). |

---

## 8. Global wiring map

```
router.tsx
  └─ QueryClient
       ├─ QueryCache.onError    → report · session-expiry redirect · background-refetch toast
       ├─ MutationCache.onError → report · session-expiry redirect · error toast
       └─ defaultOptions        → shouldRetry / retryDelay (reads) · retry:false (writes)

__root.tsx
  ├─ <ConnectionBanner/>            (ambient offline)
  ├─ errorComponent → <ErrorScreen> (route-level crashes)
  └─ <ErrorBoundary variant="page"> around <Outlet/>  (last-resort)

app-shell.tsx
  └─ <ErrorBoundary variant="inline"> around page {children}  (feature isolation)

server.ts / start.ts → SSR 500 wrapper (renderErrorPage) + error-capture stack recovery
```

---

## 9. Status vs. the design spec

| Spec item | Status |
| --- | --- |
| Typed per-layer errors | ✅ `ServiceError` / `IntegrationError` / `AIError` / auth mapping |
| Category classification | ✅ `classifyError` (8 categories) |
| User-friendly messages, no stack traces | ✅ `getErrorMessage` + `ErrorScreen` |
| Auth expiry → redirect | ✅ `beforeLoad` guard + global session-expiry redirect |
| Retry strategy (reads 3×/backoff, no write retry) | ✅ `shouldRetry` / `retryDelay` |
| Realtime reconnect + resync | ✅ `realtimeManager` |
| Offline banner | ✅ `ConnectionBanner` + `useOnlineStatus` |
| Boundary hierarchy (global/route/feature/widget) | ✅ root + route + app-shell + opt-in widget |
| Error reporting hook | ✅ `reportError` → `reportLovableError` |
| Canonical `AppError` w/ `correlationId` | ⬜ Not yet — `reportError` tags `category`; add a correlation ID when a server logger lands. |
| Circuit breakers / webhook replay | ⬜ Integration-layer, future |
| Sentry + per-feature dashboards | ⬜ Observability, future (`reportLovableError` is the current sink) |
| MFA redirect | ⬜ Not applicable until MFA ships |

---

## 10. Cookbook

**Show inline error for a query (default pattern):**
```tsx
const { data, error, isPending, refetch } = useQuery(...);
if (isPending) return <ListSkeleton />;
if (error) return <ErrorState title="Couldn't load" description={getErrorMessage(error)}
  action={<Button onClick={() => refetch()}>Retry</Button>} />;
```

**Wrap a risky widget:**
```tsx
<ErrorBoundary variant="inline" context={{ boundary: "chart" }} resetKeys={[range]}>
  <AnalyticsChart range={range} />
</ErrorBoundary>
```

**Throw a user-safe error from a service:** normalize with `toServiceError(err)`
(or `notFound(entity, id)`); the global handler maps it to a category + message.

**Silence the global toast** (feature owns its own error UI): pass
`meta: { suppressGlobalError: true }`.

---

_Last updated: 2026-07-02._
