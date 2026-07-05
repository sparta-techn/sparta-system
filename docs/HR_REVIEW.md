# SpartaFlow — HR Implementation Review

> Review of the HR backend + frontend wiring delivered across the HR tasks:
> migrations (`2026063012*_hr_*.sql`), `src/services/hr/*`, `src/repositories/hr/*`,
> `src/features/hr/{api,queries}.ts`, and the wired UI surfaces (employee
> directory, employee details, organization/departments/teams, roles).
>
> Scope of this pass: **review** across TypeScript, React, Performance,
> Repositories, Services, Supabase queries, and RLS — and **fix only critical
> issues**. Snapshot date: 2026-06-30.

---

## 1. Verdict

The implementation is **structurally sound**: `tsc --noEmit` passes with 0 errors,
the layering (UI → queries → repositories/services → Supabase) is consistent with
the `attendance` reference pattern, there are **no N+1 query loops**, and writes
are RLS-gated correctly. The issues found are mostly **read-path visibility (RLS)
gaps** and **failure-state UX** — not happy-path breakage.

**Fixed in this pass (critical):** failure states that actively mislead
(query error rendered as "not found" / "no employees"). Everything else is
documented below with a severity and a recommendation, left unchanged to respect
the "fix only critical / HR-only / no redesign" constraints.

---

## 2. Severity summary

| # | Severity | Area | Issue | Action |
| --- | --- | --- | --- | --- |
| C1 | 🔴 Critical | React / queries | Query **errors** rendered as "Employee not found" / "No employees" | **Fixed** |
| H1 | 🟠 High | RLS | `profiles` read policy has no admin override → **offboarded** employees show as "Unknown" even to HR | Noted (pre-existing auth policy) |
| H2 | 🟠 High | RLS / routing | Any authenticated user can read the whole employee directory; HR routes aren't gated by `hr:access` | Noted |
| H3 | 🟠 High | RLS | `user_roles` is self-only for non-admins → role badges default to "Employee" for others | Noted |
| M1 | 🟡 Medium | Performance | Employee **details deep-link** loads the entire directory to resolve manager/reports | Noted |
| M2 | 🟡 Medium | Performance | `fetchHrEmployees` selects the full table, no server limit/pagination | Noted |
| M3 | 🟡 Medium | React | Org structure renders empty sections silently on error | Noted |
| M4 | 🟡 Medium | Supabase / DB | Manager-cycle trigger runs with invoker rights; detection can be incomplete if ancestor rows are RLS-hidden | Noted |
| L1–L5 | 🟢 Low | TS / data | Boundary `as` casts; `onsite`→`Remote`; dead `on_leave` filter; default desc ordering; pre-existing Prettier drift | Noted |

---

## 3. Area-by-area

### TypeScript — good
- Full project `tsc --noEmit` → **0 errors**.
- DB row types in `services/hr/types.ts` are snake_case to match PostgREST columns; insert/update types omit server-managed fields. Clean.
- **L1:** `features/hr/api.ts` uses boundary `as` casts (`as Department`, `as HrEmployee["employmentType"]`) to fit DB strings into the mock view-model unions. Acceptable and contained to the mapper, but they bypass type-safety — if the mock unions ever drive logic (not just display), these could mask bad values.
- The relaxed, untyped `db` client is used because the HR tables aren't in the generated `Database` types yet. Correct choice; regenerate `integrations/supabase/types.ts` after the migrations are applied to restore end-to-end typing.

### React — one critical, otherwise solid
- Hooks usage is correct: `useMemo` deps are accurate (`[employees, …]`), `employeeById` is memoized, and the three surfaces share `hrQueries.employees()` so TanStack Query **deduplicates** the fetch.
- **C1 (fixed):** On query error, `isLoading` is false and `data` is `undefined` → the directory fell through to `EmptyState` ("No employees match…") and the `$id` route threw `notFound()` ("Employee not found"). Both **masked real failures** (notably RLS denials once the backend is live). Added explicit `isError` branches that surface a neutral error message instead.
- **M3:** `organization-structure.tsx` still renders empty Department/Team/Hierarchy sections on error with no indication. Lower impact (no misleading "not found"); recommend an error guard for parity.

### Performance — acceptable, with scale caveats
- Directory load = **2 queries** (employees+embeds, then `user_roles` via a single `.in(...)`). No per-row fetching. Teams = 3 small queries. Good.
- **M1:** opening an employee profile via a cold deep link runs `fetchHrEmployees()` (the whole directory) just to resolve the one employee + manager + reports. When navigated from the list it's free (cache hit); cold it's wasteful. Recommend a dedicated single-employee query (`employeesService.getById` + a small manager/reports fetch) for the `$id` route.
- **M2:** `fetchHrEmployees` selects the entire `employees` table with no server-side `limit`/range; pagination is client-side. Fine at current scale, a problem at thousands of rows. Recommend server pagination (the `BaseService.paginate` already exists) feeding the directory's pager.

### Repositories — good
- Thin, intention-revealing, constructor-injected services (DI/testable), shared singletons. Matches the existing repository conventions.
- The deliberate **two `EmployeeRepository`s** (profiles-directory vs. `employees` employment record) are kept in separate barrels to avoid an export clash — correct and documented.

### Services — good
- All four extend `BaseService` and reuse its CRUD; domain methods are minimal and correct.
- **Correct handling of null filtering:** `listActive()` uses a custom `.is("archived_at", null)` rather than the generic `.eq(col, null)` (which PostgREST does *not* treat as `IS NULL`) — a real bug avoided.
- **L4:** `BaseService.list` defaults to `desc` unless `direction:"asc"`. Mitigated here because `listActive()` orders `name ASC` explicitly and the directory sorts client-side, but other default `list()` calls will come back newest-first.

### Supabase queries — correct, error-surfacing now improved
- The embedded select resolves cleanly: each of `departments`/`teams`/`positions`/`employment_types`/`profiles` has exactly one FK from `employees`, so there's **no embedding ambiguity**; `employee_profiles` is a unique reverse to-one. The `one()` helper defensively handles object-or-array embeds.
- Roles are batched with `.in("user_id", …)` — no N+1.
- **M4:** `tg_employees_no_manager_cycle` is `SET search_path = public` but **not** `SECURITY DEFINER`; its `SELECT … FROM employees` runs under the writer's RLS. Writes are admin-only (admins see all rows), so it's correct in practice, but making it `SECURITY DEFINER` would guarantee complete chain traversal regardless of caller.

### RLS — enabled everywhere; read-visibility gaps to close
- Every new table has `ENABLE ROW LEVEL SECURITY` + policies in the creating migration. **Writes** are gated correctly (`hr/super_admin/owner`; catalog tables `super_admin/owner`). Helpers reuse the `SECURITY DEFINER` `has_any_role`. Good.
- **H1:** the pre-existing `profile_read_directory` policy is `status <> 'offboarded' OR id = auth.uid()` with **no admin override**. The new `employees` policy *does* let HR read offboarded rows, but the embedded `profiles` row is then hidden → offboarded employees render as **"Unknown / —"** even for HR. Fixing means amending the auth-migration `profiles` policy (adds an admin `OR has_any_role(...)` clause) — out of HR-only scope, flagged for the auth/profiles owner.
- **H2:** `employees` SELECT is `status <> 'offboarded' OR self OR admin`, so **any authenticated user** can enumerate active employees (consistent with the existing all-authenticated `profiles` directory read, but worth knowing). The HR routes sit under `_authenticated` only — not gated by `hr:access`. Recommend a route/`beforeLoad` guard using the existing `hasPermission("hr:access")`.
- **H3:** `roles_self_read` returns only the caller's own role unless they're `hr/super_admin/owner`. So when a **non-admin** opens the HR page, every other person's `RoleBadge` falls back to "Employee" (the mapper defaults empty roles). Acceptable if H2 is addressed (HR pages become admin-only); otherwise it's misleading data.

---

## 4. Fixes applied (critical only)

**C1 — surface query errors instead of masking them.**

- `src/features/hr/components/employee-directory.tsx`: added an `isError` branch (`Couldn’t load employees. Please try again.`) before the empty-state, so a backend/RLS failure no longer reads as "No employees match your filters".
- `src/routes/_authenticated/app/hr.employees.$id.tsx`: added an `isError` guard so a failed fetch shows an error message rather than throwing `notFound()` ("Employee not found").

Both are minimal, HR-scoped, preserve the existing UI/markup, and pass `tsc` (0 errors) and lint (no rule violations beyond the repo-wide pre-existing Prettier drift, **L5**, which also affects untouched HR files and was intentionally not reformatted).

---

## 5. Recommended follow-ups (not done — outside "critical / HR-only")

1. **H2 + H3:** gate HR routes with `hasPermission("hr:access")` in `beforeLoad`; then non-admin role-visibility (H3) becomes moot.
2. **H1:** add an admin `OR has_any_role(...)` clause to the `profiles` read policy so HR can see offboarded people (touches the auth migration).
3. **M1/M2:** add a single-employee query for the `$id` route and server-side pagination for the directory (`BaseService.paginate`).
4. **M3:** error guard on `organization-structure.tsx`.
5. **M4:** make the cycle-guard trigger `SECURITY DEFINER`.
6. **Typing:** regenerate `integrations/supabase/types.ts` post-migration and drop the boundary casts where possible.

*No other module was modified. Only the two failure-path fixes (C1) change behavior; everything else is documentation.*
