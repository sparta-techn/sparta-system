# SpartaFlow — Engineering Audit

> Report only. No code was modified. Findings are derived from running the
> project's own tooling (`tsc`, `eslint`) plus a full read of `src/`.
> Snapshot date: 2026-06-30.

## Methodology & Tooling Results

| Check                          | Command            | Result                                                                                 |
| ------------------------------ | ------------------ | -------------------------------------------------------------------------------------- |
| Type safety                    | `npx tsc --noEmit` | ✅ **Clean — 0 errors**                                                                |
| Lint                           | `npx eslint .`     | ❌ **2118 problems** (2100 errors, 18 warnings)                                        |
| — of which Prettier formatting |                    | 2098 (auto-fixable)                                                                    |
| — substantive lint issues      |                    | 20 (1 hook-order **error**, 13 fast-refresh, 2 deps, 1 prefer-const, 3 stale disables) |
| Tests                          | —                  | ⚠️ **No test runner configured** (no test deps, no test files)                         |

Headline: **TypeScript discipline is genuinely strong** (0 errors, exactly one
real `any` in hand-written code, and that one is in a comment). The lint failure
is 99% formatting noise hiding ~20 real issues — one of which is a Rules-of-Hooks
violation that can crash a screen.

---

## Severity Summary

| Severity    | Count | Theme                                                               |
| ----------- | ----- | ------------------------------------------------------------------- |
| 🔴 Critical | 2     | Hook-order bug; committed `.env` / secret hygiene                   |
| 🟠 High     | 4     | Broken lint gate; no RBAC route guards; no tests; backend not wired |
| 🟡 Medium   | 8     | Duplicate components, dead code, cross-feature coupling, perf gaps  |
| 🟢 Low      | 7     | Lint warnings, console logs, oversized components, stale disables   |

---

## 🔴 Critical

### C1 — Rules-of-Hooks violation (conditional hook call)

`src/features/tasks/components/task-detail.tsx:78`

```tsx
if (!task) { return (<EmptyState .../>); }   // early return at line 62
...
const parent = useTasksStateOptional(task.parentTaskId);  // line 78 — hook AFTER return
```

`useTasksStateOptional` (a `useSyncExternalStore` wrapper, defined line 510) is
called **after** an early `return`. When `task` is null vs. non-null the hook
count differs between renders → React throws _"Rendered more hooks than during the
previous render."_ ESLint flags this as `react-hooks/rules-of-hooks` (error).
**This is a real runtime crash path**, not style. Fix: call the hook before any
early return (pass a nullable id), then branch.

### C2 — `.env` is committed and **not** git-ignored

`.gitignore` has no `.env` entry; `.env` contains `SUPABASE_*` values.

Today the committed values are the **publishable/anon key** (designed to be
public) + project URL/ID, so this is not yet a live credential leak. The danger is
structural: `client.server.ts` and `auth-middleware.ts` read
`process.env.SUPABASE_SERVICE_ROLE_KEY` from this same `.env`. The moment anyone
adds the service-role key locally, the next commit **leaks an RLS-bypassing
secret**. Treat as Critical because the guardrail is missing, not because it has
fired. Fix: add `.env*` (keep `.env.example`) to `.gitignore`, rotate keys if the
repo is shared, and document required env vars.

---

## 🟠 High

### H1 — Lint gate is effectively red (2098 Prettier errors)

`npm run lint` exits non-zero on virtually every file. Any CI quality gate or
pre-commit hook keyed on lint is either broken or disabled, which is _why_ the
real C1 hook bug slipped through. Almost all are auto-fixable
(`prettier --write .` / `eslint --fix`). Until this is cleared, lint provides no
signal. (Not auto-fixing here per "report only" — see roadmap.)

### H2 — No RBAC enforcement at the route layer

`src/routes/_authenticated/route.tsx` gates on **authentication only**
(`supabase.auth.getUser()`). Role-sensitive pages (`hr.*`, `analytics.executive`,
`manager`, owner views) have no `beforeLoad` role check; `permissions.ts` exists
but only gates scattered UI. A signed-in `viewer` can navigate directly to
`/app/hr/employees` or `/app/analytics/executive`. For mock data this is cosmetic,
but it becomes a real authorization hole the instant those pages query live
Supabase. Add role guards in route `beforeLoad` (redirect to `/unauthorized`),
backed by RLS.

### H3 — No automated tests or test infrastructure

No test runner, no test files, no testing deps in `package.json`. For a platform
of this surface area (18 features, RBAC, attendance state machine, task store
mutations) there is zero regression safety. The store mutation logic
(`tasks/store.ts`, 465 LOC of business rules) and `permissions.ts` matrix are
prime, easily-unit-testable targets.

### H4 — 16 of 18 features run on mock `localStorage`, not the backend

Only `auth` and `attendance` use Supabase (`api.ts`/`queries.ts`). Everything else
(`tasks`, `projects`, `sprints`, `kanban`, `dependencies`, `notifications`,
`eod`, `midday`, `checkin`, `time-tracking`, `task-communication`, analytics)
persists to `localStorage` via `store.ts` seeded from `mock-data.ts` (~3,092 LOC
of seed data). This is by design (stores are written to mirror the future
repository surface) but it is the dominant gap to production. Tracked in detail in
`docs/ARCHITECTURE.md §15`.

---

## 🟡 Medium

### M1 — Duplicate `EmptyState` component

A full-featured state library exists at `src/components/states.tsx`
(`EmptyState`, `NoResultsState`, `ErrorState`, `LoadingState`, `ListSkeleton`),
yet a second, weaker `EmptyState` lives at
`src/features/hr/components/empty-state.tsx` — and **four files in `tasks` and
`task-communication` import the HR copy**, not the shared one. Two problems in
one: a duplicate component and cross-feature coupling. Adopt `components/states`
everywhere; delete the HR copy.

### M2 — Dead code: 5 orphaned dashboard components

None of these are imported anywhere (the dashboard route uses the real feature
widgets instead):

- `src/features/dashboard/components/today-status-card.tsx` (129 LOC; superseded by `attendance/components/today-status-card.tsx`)
- `src/features/dashboard/components/check-in-card.tsx`
- `src/features/dashboard/components/midday-status-card.tsx`
- `src/features/dashboard/components/notifications-widget.tsx`
- `src/features/dashboard/components/dependencies-widget.tsx`

They appear to be an earlier dashboard prototype replaced by `CheckInWidget`,
`MiddayWidget`, etc. from the owning features. Safe to delete after confirming no
dynamic import.

### M3 — Duplicate component basenames / patterns across features

- `badges.tsx` duplicated in `tasks/`, `projects/`, `hr/` components.
- `dashboard-widgets.tsx` duplicated in `tasks/` and `hr/`.
- `today-status-card.tsx` duplicated in `attendance/` and `dashboard/` (the latter dead — see M2).

These are independent reimplementations of the same visual patterns. Extract a
shared badge primitive and reconcile.

### M4 — `useNow` / ticking-clock hook reimplemented 3+ times

Inline `setInterval`-based clock hooks appear in
`time-tracking/hooks/use-now.ts`, `attendance/hooks/use-timer.ts`, and the dead
`dashboard/components/today-status-card.tsx` — plus 10 total `window.setInterval`
sites (several at the same `60_000` cadence). Missing a single shared
`useInterval`/`useNow` abstraction. Multiple independent 1s timers also have a
minor perf cost (each forces its own subtree re-render every second).

### M5 — Heavy cross-feature coupling, no feature public API

Features deep-import each other's internals: `@/features/tasks` is imported 41×,
`@/features/hr` 25×, `@/features/projects` 11× — reaching directly into
`mock-data`, `store`, and `components`. There is no per-feature barrel
(`index.ts`) defining a public surface, so the "feature-first" boundary is
porous. `task-detail.tsx` alone imports from `hr`, `projects`, `time-tracking`,
and `task-communication`. Introduce per-feature public entry points and depend on
those.

### M6 — No route-level code-splitting / lazy loading

Zero lazy routes (no `.lazy.tsx`, no `lazyRouteComponent`). Every route — including
heavy ones like `eod-wizard.tsx` (977 LOC), `midday-wizard.tsx` (780 LOC),
`project-analytics-dashboard.tsx` (recharts) — is in the initial graph. CLAUDE.md
mandates "lazy load routes." Convert heavy routes to lazy.

### M7 — No list virtualization

No virtualization library or usage anywhere, despite tables/boards (tasks list,
kanban, attendance history, HR directory) that will grow unbounded against real
data. CLAUDE.md mandates "virtualize long lists." Add `@tanstack/react-virtual`
for the known-large surfaces.

### M8 — No memoization on large components

`React.memo` is used **0 times**; `useMemo`/`useCallback` appear in 38 files but
the largest components (`eod-wizard` 977, `midday-wizard` 780, `task-detail` 522)
are monolithic and unmemoized. Combined with M4's per-second timers this risks
visible re-render churn. Decompose and memoize the wizard/detail screens.

---

## 🟢 Low

| ID  | Finding                                                                                                                                                         | Location                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| L1  | `react-hooks/exhaustive-deps`: `useMemo` has unnecessary `data` dep (×2)                                                                                        | `project-analytics/components/project-analytics-dashboard.tsx:78-79`        |
| L2  | `prefer-const`: `let key` never reassigned                                                                                                                      | `features/projects/store.ts:109`                                            |
| L3  | 13 `react-refresh/only-export-components` warnings (mostly shadcn `ui/*` + contexts — low risk, but `filters-context`/`auth-context` could split constants out) | various                                                                     |
| L4  | 3 stale `eslint-disable` directives for `no-console` (no longer needed)                                                                                         | `notifications/automation-engine.ts:84,99`, `notifications/event-bus.ts:63` |
| L5  | 11 `console.*` calls in shipping code                                                                                                                           | across `src`                                                                |
| L6  | Oversized components (>400 LOC) should be decomposed                                                                                                            | eod/midday/checkin wizards, task-detail                                     |
| L7  | No root `README.md` (only `AGENTS.md`, `CLAUDE.md`); `docs/` is spec-heavy but has no onboarding/setup or testing doc                                           | repo root                                                                   |

---

## Cross-Cutting Observations

**Folder structure** — Clean and consistent feature-first layout; routes follow
TanStack flat dot-notation correctly; generated files (`routeTree.gen.ts`,
supabase `client*.ts`, `types.ts`) are properly isolated. Main weakness is the
absence of feature public APIs (M5) and the shared-vs-feature component
duplication (M1–M3).

**TypeScript** — Excellent. Strict mode honored, no hand-written `any`,
well-modeled domain types per feature. Keep this bar when wiring the backend.

**Routing** — Correct and idiomatic. The single gap is authorization (H2): the
guard is authentication-only.

**Security** — Three real concerns: C2 (env hygiene), H2 (no role guards), and the
frontend permission matrix (`permissions.ts`) that must stay in lockstep with RLS
as tables land. The service-role client is correctly isolated to `.server.ts` —
good. No `dangerouslySetInnerHTML` found.

**Missing documentation** — No setup/onboarding README, no testing guide, and no
per-feature docs that map a feature to its store/types. `docs/ARCHITECTURE.md`
(as-built) now covers the macro picture.

**Missing abstractions** — (1) a shared `useInterval`/`useNow` hook; (2) a single
state-component library actually adopted everywhere; (3) per-feature public
barrels; (4) a unified data-access contract (the `attendance` `api.ts`+`queries.ts`
pattern) to replace ad-hoc `store.ts` access; (5) per-route error boundaries
(only `__root.tsx` has one today).

**Reusable opportunities** — Promote `attendance/{api,queries}.ts` to the template
for every feature; consolidate `badges`, `EmptyState`, `useNow`, and chip
components; lift shared wizard primitives out of the 3 large wizards.

---

## Implementation Roadmap

Ordered by risk-reduction per unit effort. Each phase is independently shippable.

### Phase 0 — Stop the bleeding (½ day)

1. **C1**: Move `useTasksStateOptional` above the early return in `task-detail.tsx`. Add a unit test reproducing the null-task render.
2. **C2**: Add `.env*` to `.gitignore`, commit `.env.example`, rotate keys if the repo has been shared, document required vars in README.
3. **H1**: Run `eslint --fix` + `prettier --write .` to clear the 2098 formatting errors in one commit (isolated, no logic change), so lint becomes a real signal.

### Phase 1 — Make the gate trustworthy (2–3 days)

4. **H3**: Add Vitest + React Testing Library. First targets: `permissions.ts` matrix, `tasks/store.ts` mutations, the C1 regression.
5. **L1, L2, L4**: Clear the remaining substantive lint findings; remove stale `eslint-disable`s.
6. Wire `tsc --noEmit` + `eslint` + `vitest` into CI / a pre-commit hook so regressions can't merge.

### Phase 2 — De-duplicate & tidy (2–3 days)

7. **M2**: Delete the 5 dead dashboard components.
8. **M1**: Replace `hr/components/empty-state` usages with `components/states`; delete the duplicate.
9. **M4**: Extract one `useInterval`/`useNow` hook; replace the 3+ inline copies.
10. **M3**: Consolidate `badges.tsx` / `dashboard-widgets.tsx` patterns into shared primitives where they truly overlap.

### Phase 3 — Harden architecture (3–5 days)

11. **M5**: Add per-feature `index.ts` public barrels; refactor deep cross-feature imports to use them.
12. **H2**: Add role-based `beforeLoad` guards to sensitive routes; redirect unauthorized → `/unauthorized`.
13. **L3**: Split constants/contexts out of component files flagged by fast-refresh.

### Phase 4 — Performance (3–5 days)

14. **M6**: Lazy-load heavy routes (eod/midday wizards, analytics).
15. **M8 + L6**: Decompose the >400 LOC wizards/detail; memoize hot subtrees.
16. **M7**: Add `@tanstack/react-virtual` to tasks list, kanban, attendance history, HR directory.

### Phase 5 — Backend integration (large; see `docs/ARCHITECTURE.md §15`)

17. **H4**: Per feature, migrate `store.ts` → Supabase `api.ts` + `queries.ts` (attendance pattern), add tables + **RLS** + RPCs, retire `mock-data.ts`. Keep `permissions.ts` ↔ RLS parity checked by a test.

---

_Audit scope: static analysis + full source read. Dynamic/runtime profiling,
dependency CVE scanning, and Supabase RLS penetration testing are recommended as
follow-ups before production._
