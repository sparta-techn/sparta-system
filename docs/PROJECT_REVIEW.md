# SpartaFlow — Project Execution Module Review

> Full review of the Project Execution module: migration `20260630150000`,
> `services/projects/*`, `repositories/projects/*`, `features/projects/*` (store,
> mappers, dashboard, components), and the reused Analytics/HR layers.
> Scope rule for this pass: **fix only critical issues, do not redesign UI.**
> Snapshot: 2026-07. After fixes: `tsc --noEmit` clean · `eslint` clean ·
> `vitest` 48 passing.

---

## 1. Summary

| Area | Verdict |
| --- | --- |
| Architecture | Solid — clean service → repository → store → UI layering, conventions consistent with HR/Attendance. |
| Performance | Acceptable for current scale; one N+1 hydration pattern + unmemoized dashboard worth addressing before large datasets. |
| Supabase queries | Correct & parameterized via `BaseService`; RLS-safe. N+1 fan-out noted. |
| Repositories | Clean, thin, singletons, dependency-injected; reuse Tasks. |
| Permissions | RLS ↔ `rules.ts` ↔ UI consistent (archive = managers, delete = owners). |
| TypeScript | Strict, no `any` in module logic; row/domain split explicit. |
| Reusable components | Good — dashboard composes the existing Analytics module; UI primitives reused. |

**2 critical issues found and fixed** (Section 2). Remaining items are
non-critical recommendations (Section 9), intentionally **not** changed under the
"fix only critical" rule.

---

## 2. Critical issues — FIXED

### C1. Member changes never persisted (silent data loss)
`features/projects/store.ts` — `updateProject` applied the optimistic state
update **before** calling `reconcileMembers`, which then read the "previous"
members via `getProject(projectId)?.members` — i.e. the *already-overwritten*
list. The diff (`prev` vs `next`) was therefore always empty, so **adding,
removing, or re-roling a member updated the cache but issued no Supabase write**;
the change vanished on reload.

- **Failure scenario:** open a project → Members → add a member → reload ⇒ the
  member is gone (never written to `project_members`).
- **Fix:** capture `prevMembers` at the top of `updateProject` (before mutation)
  and pass it into `reconcileMembers(id, prev, next)`. The diff now runs against
  the true prior state, so add/remove/role-change persist.

### C2. Just-created project lands on a dead "Project not found" page
`createProject` returned an optimistic row with a temp id (`proj-…`), the create
dialog navigated to `/app/projects/{tempId}`, and the async write-through then
**swapped the project's id** to the DB-generated UUID. The route param stayed on
the temp id, so a few hundred ms after creation the detail page flipped to
"Project not found" — and the URL was also broken on reload.

- **Failure scenario:** create a project → you're navigated to it → on the next
  store tick the page shows "Project not found".
- **Fix:** generate the id **client-side** (`crypto.randomUUID()`) and pass it as
  `projects.id` on insert (`ProjectInsert.id` is now optional). The optimistic id
  *is* the persisted id — no swap, the route stays valid, and the per-project
  overlay (favorite/env/client/template) survives reload because it's keyed by
  the same stable id. The obsolete `id.startsWith("proj-")` write-through guard
  was removed.

Both fixes are localized to `store.ts` + a one-line type widening in
`services/projects/types.ts`; **no UI markup changed**.

---

## 3. Architecture

- **Layering is clean and consistent** with the rest of the app: pure
  `BaseService` subclasses (one table each) → thin domain repositories
  (singletons, constructor-injected) → store facade → components. Matches the
  documented HR/Attendance conventions.
- **Snake-case row types vs camelCase domain** are bridged in one place
  (`features/projects/mappers.ts`), keeping the impedance boundary explicit.
- **Append-only `project_activity`** is enforced at the service (`update`/`upsert`/
  `remove` reject) *and* the grant level (SELECT/INSERT only) — good defense in depth.
- **Reuse over duplication:** `ProjectRepository.listTasks` delegates to the
  existing `TasksService`; the dashboard composes `project-analytics` utils +
  `insights` rather than recomputing analytics. Aligns with CLAUDE.md.
- **Business rules** live in a pure, tested module (`services/projects/rules.ts`)
  mirrored by schema FKs and RLS.

No architectural defects. One observation: the legacy mock-typed
`projects.service.ts` / root `project.repository.ts` coexist with the new
snake-case stack; this is intentional and documented, but should be removed once
nothing imports them, to avoid confusion.

---

## 4. Performance

| Item | Severity | Notes |
| --- | --- | --- |
| **N+1 hydration fan-out** | Medium | `store.ts` `hydrate()` issues 4 base queries + **4 queries per project** (members, milestones, activity, risks) via `Promise.all` over `projectRows`. Fine for a handful of projects; at scale prefer batched `…listByProjectIds(ids)` using PostgREST `.in("project_id", ids)` (one query per child table). |
| **Unmemoized dashboard** | Low–Med | `project-dashboard.tsx` calls `filterProjectTasks` / `snapshotTasks` / `calcProjectHealth` / `unifiedActivity` on **every render** (no `useMemo`, unlike `ProjectAnalyticsDashboard`). Cheap on mock data; wrap in `useMemo` keyed by `projectId` + store slices when task volume grows. |
| **O(n) cache lookups** | Low | `personById`, `getProject`, `risksFor`, etc. are linear `find`/`filter`. `personById` runs per member per render. Acceptable now; index `people`/`projects` into a `Map` if directories get large. |
| Hydration on module import | Low | `hydrate()` fires on first import of the store; the store is only imported by lazy-loaded project routes, so it's effectively route-scoped. Fine. |

None are correctness bugs; deferred per the "critical only" rule.

---

## 5. Supabase queries

- All reads/writes go through `BaseService`, which builds parameterized PostgREST
  queries (`.eq` per filter, `.order`, `.range`) — no string interpolation, no
  injection surface.
- `ProjectCalendarService.listInRange` correctly uses `.gte`/`.lt` on `starts_at`.
- Writes rely on DB defaults (`auth.uid()` for `created_by`/`actor_id`) — the
  client never spoofs audit columns.
- **N+1** as noted in §4 is the only query-shape concern.

---

## 6. Repositories

- Thin, intention-revealing, one concern each; singletons exported lower-camel.
- Activity feed is populated as a side effect of domain verbs (create/status/
  member/milestone/risk) through a single `projectActivityService.log`.
- **Non-atomic activity logging** (write then log, two statements) is a known,
  documented limitation — acceptable; a DB trigger would make it transactional.
- `ProjectRiskRepository.resolve` / `MilestoneRepository.setStatus` correctly
  stamp derived fields and log. No defects.

---

## 7. Permissions

- **RLS ↔ rules ↔ UI are consistent:**
  - Archive (a status update) = `can_manage_project` (owner / super_admin /
    project_manager + the project's own manager) ⇄ `PROJECT_ARCHIVE_ROLES` /
    `canArchiveProject`.
  - Delete = `projects_delete` policy (owner / super_admin) ⇄
    `PROJECT_DELETE_ROLES` / `canDeleteProject`; the settings-tab delete button is
    disabled ("requires Owner").
- `is_project_member` / `can_manage_project` are `SECURITY DEFINER` with pinned
  `search_path` — recursion-safe and the standard pattern here.
- Grants are `authenticated` / `service_role` only; helper `EXECUTE` revoked from
  `PUBLIC, anon`. No service-key exposure.
- Minor note: the literal rule says "Owners delete" while RLS + `rules.ts` also
  allow `super_admin` (platform owner-equivalent). Intentional and documented; no
  change.

---

## 8. TypeScript & reusable components

- Strict throughout; no `any` in module logic. The relaxed `db` client is the
  only loosely-typed seam (expected — these tables aren't in generated types
  yet). `corePatch` is built field-by-field rather than cast wholesale.
- Row vs domain types are cleanly separated; enums single-sourced from
  `features/projects/types` + reused `PriorityLevel`.
- Components reuse shared primitives (`Card`, `StatCard`, `Progress`, `Badge`,
  `EmployeeAvatar`) and the Analytics module; no duplicate analytics or UI
  primitives were introduced.

---

## 9. Recommendations (non-critical, deferred)

1. **Batch hydration** — add `listByProjectIds` (PostgREST `.in`) to the member/
   milestone/activity/risk services and fetch each child table once.
2. **Memoize the dashboard** derivations (`useMemo`), matching `ProjectAnalyticsDashboard`.
3. **Index directories** (`people`, `projects`) into `Map`s if they grow large.
4. **Transactional activity logging** via DB triggers for guaranteed consistency.
5. **Regenerate `supabase/types.ts`** after the migration is applied, then tighten
   the explicit row types onto the generated ones and drop the relaxed `db` seam.
6. **Retire the legacy** `projects.service.ts` / root `project.repository.ts` once
   no imports remain.
7. **Workspace settings** still need the extended `company_settings` columns to
   persist (panel is local-only today).

---

## 10. Files changed in this review

```
src/features/projects/store.ts        # C1: capture prevMembers before optimistic update;
                                       # C2: client-generated UUID id (no swap); drop temp-id guard
src/services/projects/types.ts        # C2: ProjectInsert.id optional
```
No UI markup, styling, or layout changed. Tests, type-check, and lint pass clean.
