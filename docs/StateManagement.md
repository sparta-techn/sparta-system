# State Management — SpartaFlow Hub

A pragmatic, layered approach. Each kind of state lives in exactly one place.

---

## 1. Categories of State

| Category                          | Tool                                                  | Examples                                                              |
| --------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| **Server state**                  | TanStack Query                                        | Attendance, dependencies, reports, announcements.                     |
| **Realtime state**                | TanStack Query cache + Supabase Realtime              | Live team status, incoming notifications.                             |
| **Local UI state**                | `useState` / `useReducer`                             | Dialog open, form step, hover.                                        |
| **Cross-feature ephemeral state** | Zustand (slices)                                      | Command palette, sidebar collapse, toast queue, current scope filter. |
| **Form state**                    | React Hook Form + Zod                                 | All forms.                                                            |
| **URL state**                     | `useSearchParams`                                     | Filters, pagination, tabs, date ranges.                               |
| **Session / auth**                | AuthProvider (context) backed by Supabase             | Current user, claims, permissions.                                    |
| **Feature flags**                 | FeatureFlagsProvider (server-resolved, client-cached) | A/B and rollout gates.                                                |

Redux is explicitly **not** used.

---

## 2. Server State (TanStack Query)

- **Query keys** are tuples: `[feature, entity, params]`, e.g. `['dependencies','list',{ scope:'team', teamId, status:'open' }]`.
- A central `queryKeys` factory per feature prevents typos and enables targeted invalidation.
- **Stale time** defaults: dashboards 30s, detail pages 60s, configuration 5min, audit logs 0.
- **Refetch on window focus** enabled for dashboards, disabled for forms.
- **Suspense + ErrorBoundary** wrap each feature screen for consistent loading/error UX.
- **Query options live in `application/`**, not in components — components call hooks (`useDependenciesList()`).

---

## 3. Mutations

- All mutations go through `useFeatureMutation()` wrappers that:
  1. Validate input with Zod.
  2. Apply optimistic updates if safe.
  3. Call the use-case (Application layer).
  4. Translate errors via the error mapper.
  5. Invalidate or patch the relevant query keys.
  6. Emit toast / log telemetry.
- Idempotency keys are added for `startWork`, `finishWork`, `submitEndOfDayReport` to make retries safe.

---

## 4. Optimistic Updates

Applied where the success path is the overwhelming majority and the rollback is cheap:

- Acknowledging a dependency.
- Marking a notification read.
- Toggling announcement read.
- Starting / ending a break.

Not applied where conflicts are likely or rules are server-evaluated:

- Submitting reports (server validates structure).
- Approving leaves (server enforces balance + workflow).
- Role changes (server-only, audited).

Optimistic updates always include a rollback in `onError` and a refetch in `onSettled`.

---

## 5. Realtime Updates

- A single `useRealtimeSubscriptions()` hook starts channels relevant to the user's scopes.
- Incoming events are normalized to `{ type, entity, id, payload }` and pushed into a reducer `applyRealtimePatch(queryClient, event)`.
- The reducer mutates only the affected query keys via `setQueryData`, never the whole cache.
- Presence is handled separately; "who is online" is its own slice updated by `presenceSync`.

This keeps realtime updates **coherent with cached queries**, avoiding the "two sources of truth" trap.

---

## 6. Caching Strategy

| Data                      | Cache lifetime              | Invalidation triggers                       |
| ------------------------- | --------------------------- | ------------------------------------------- |
| Today's attendance        | 30s + realtime              | Any attendance mutation, midnight rollover. |
| Dependencies (open)       | 30s + realtime              | Mutation, realtime, manual refresh.         |
| Reports (rollups)         | 5 min                       | Day boundary, manual refresh.               |
| Directory                 | 10 min                      | HR edits, role changes.                     |
| Announcements             | 1 min + realtime            | Create, expire, read.                       |
| Notifications             | 0 (always fresh) + realtime | Any new event.                              |
| Org config (roles, teams) | 30 min                      | Admin edits.                                |

---

## 7. Loading Strategy

- **Skeletons over spinners.** Every list/card has a matching `*Skeleton`.
- **Streaming SSR** for dashboards: render shell immediately, stream data widgets.
- **Suspense boundaries** at the widget level so one slow query doesn't block the page.
- **Prefetching** on hover for primary navigation links via `queryClient.prefetchQuery`.

---

## 8. Error States

- Per-widget `ErrorState` with a retry action that calls `query.refetch()`.
- Global error boundary catches render errors and offers "Reload" + "Report".
- Mutation errors surface as toasts with a "Retry" action for safe operations.
- Network offline state is surfaced once globally; queries pause until back online.

---

## 9. Form State

- React Hook Form for all forms.
- Zod schemas live in `features/<x>/application/validators/`.
- Schemas are shared between client (resolver) and server (action validation) — one source of truth.
- Drafts (Morning, Midday, EOD) autosave to `localStorage` keyed by `(userId, formId, date)` and to the server every 30s.

---

## 10. URL State Rules

- Filters, sort, pagination, tabs, date ranges — always in the URL.
- Modal open/close — in the URL when the modal contains shareable content; in local state otherwise.
- Never store auth tokens, user data, or anything sensitive in the URL.

---

## 11. Global UI Slices (Zustand)

Used sparingly; each slice is < 100 lines and has a single responsibility:

- `commandPaletteStore` — open state, active query.
- `layoutStore` — sidebar collapsed, theme preference (mirrored to user settings).
- `toastStore` — queue + dismissal (wrapper around shadcn `sonner`).
- `scopeStore` — current "viewing as" scope (team / department) for managers.

---

## 12. Anti-Patterns

- Using `useEffect` + `fetch` for initial data.
- Mixing TanStack Query and Zustand for the same data.
- Storing server data in React Context.
- Using `useState` for data that belongs in the URL.
- Manual cache structures parallel to TanStack Query.
