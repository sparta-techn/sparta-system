# SpartaFlow — Route Guards

> Every route resolves an **access policy** — authentication, roles, and
> permissions — enforced before its component renders. Guards are a **UX layer**
> that mirrors the authoritative RBAC enforced by Postgres RLS; they are never
> the security boundary for data. See [`RBAC.md`](./RBAC.md).

---

## 1. What every route defines

| Concern                      | Where it's defined                                    | Default                                                           |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| **Authentication Required**  | `_authenticated` layout (`beforeLoad` + `staticData`) | Required for everything under `/_authenticated`; public elsewhere |
| **Required Role**            | `staticData.guard.roles` (any-of)                     | none = any authenticated user                                     |
| **Required Permissions**     | `staticData.guard.permissions` (all-of)               | none = any authenticated user                                     |
| **Unauthorized Page**        | redirect target when not signed in                    | `/auth` (sign-in)                                                 |
| **Forbidden Page**           | redirect target when signed in but denied             | `/unauthorized`                                                   |
| **Session Expired Handling** | `beforeLoad` + gate + query layer                     | `/auth/session-expired`                                           |

A route's **effective policy is the merge of its whole matched chain** (root →
leaf). A leaf inherits its group layout's requirements and may only tighten
them — it can never loosen a parent's guard.

---

## 2. Declaring a guard

Each route declares its policy in `staticData`, typed via a module augmentation
(`src/features/auth/route-guard.ts`):

```ts
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/hr")({
  staticData: routeGuard({ permissions: ["employees.read"] }),
  // …
});
```

`RouteGuard` fields (all optional):

| Field             | Semantics                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `authRequired`    | Require a session. Defaults to `true` under `_authenticated`; set `false` for public routes.                                 |
| `roles`           | **Any-of** — roles are alternatives (e.g. a manager view allows owner/admin/hr/PM/lead).                                     |
| `permissions`     | **All-of** — permissions are _requirements_; the user must hold every one. This is what makes inheritance tighten correctly. |
| `requireAllRoles` | Switch `roles` to all-of for the rare "must hold every role" case.                                                           |

---

## 3. Enforcement

Two layers, both client-side (SSR is off for `_authenticated` because the
Supabase session lives in `localStorage`):

### a. `beforeLoad` — authentication + session expiry

`src/routes/_authenticated/route.tsx`:

- `supabase.auth.getUser()` succeeds → continue.
- Fails **and** no stored session → **not signed in** → `redirect → /auth`
  with `?redirect=<href>` (the **Unauthorized** destination; sign-in bounces
  back after success).
- Fails **but** a stored session exists (expired/invalid token) → **Session
  Expired** → `redirect → /auth/session-expired`.

### b. `<RouteGuardGate>` — roles + permissions

`src/features/auth/components/route-guard-gate.tsx`, mounted around the layout
`<Outlet/>`:

1. Reads every matched route's `staticData.guard` via `useMatches()` and merges
   them (`mergeGuards`).
2. Waits for identity (`useAuth().initialized`) — shows a transient loading
   state so authorized users never see a flash of denial.
3. Evaluates (`evaluateAccess`), checking **authentication → roles →
   permissions** in order:
   - `unauthenticated` (session dropped in-page) → `/auth/session-expired`.
   - `forbidden` (role/permission denied) → `/unauthorized` (**Forbidden page**).
   - `ok` → renders the route.

### c. Query layer — session expiry on API calls

`src/router.tsx` already redirects to `/auth/session-expired` when any query or
mutation fails auth (`isSessionExpired`), guarded against redirect storms. So
expiry is caught both on navigation (a) and on data fetches (c).

---

## 4. Pages

| Page                       | Route                   | Meaning                                                       |
| -------------------------- | ----------------------- | ------------------------------------------------------------- |
| Sign-in (**Unauthorized**) | `/auth`                 | Not authenticated; `?redirect` returns you after login        |
| **Forbidden**              | `/unauthorized`         | Authenticated but your role/permissions don't allow this page |
| **Session expired**        | `/auth/session-expired` | A previously valid session became invalid                     |

> Naming note: the existing `/unauthorized` page reads as _access denied_ — it is
> the **Forbidden (403)** page. Unauthenticated (401) users are sent to sign-in
> (`/auth`). No UI was redesigned; these pages already existed.

---

## 5. Guard matrix (as declared)

Baseline: everything under `/_authenticated` requires authentication. Group
layouts guard their whole subtree; leaves inherit and can tighten.

| Route (subtree)            | Guard                                                     |
| -------------------------- | --------------------------------------------------------- |
| `/_authenticated/*`        | `authRequired: true`                                      |
| `app/hr/*`                 | `permissions: [employees.read]`                           |
| `app/projects/*`           | `permissions: [projects.read]`                            |
| `app/sprints/*`            | `permissions: [projects.read]`                            |
| `app/tasks/*`              | `permissions: [tasks.read]`                               |
| `app/dependencies/*`       | `permissions: [projects.read]`                            |
| `app/dependencies/manager` | + `roles: [owner, admin, hr, project_manager, team_lead]` |
| `app/analytics/*`          | `permissions: [analytics.view]`                           |
| `app/analytics/executive`  | + `permissions: [dashboard.executive.view]`               |
| `app/analytics/hr`         | + `roles: [owner, admin, hr]`                             |
| `app/executive`            | `permissions: [dashboard.executive.view]` (owner)         |
| `app/integrations`         | `permissions: [integrations.manage]`                      |
| `app/manager`              | `roles: [owner, admin, hr, project_manager, team_lead]`   |

Routes without an explicit guard (e.g. `app` home, check-in, midday, EOD,
notifications) inherit only the `authRequired` baseline — any signed-in user may
access them. Permission keys and the role → permission matrix live in
`src/features/auth/permissions.ts` (`ROLE_PERMISSIONS`).

---

## 6. Adding / changing a guard

1. Add `staticData: routeGuard({ … })` to the route (or its group layout for a
   whole section).
2. Choose `roles` (any-of alternatives) and/or `permissions` (all-of
   requirements) from the RBAC catalog.
3. Verify against `ROLE_PERMISSIONS` that the intended roles actually hold the
   permission — `route-guard.test.ts` covers the evaluator; extend it for new
   policies.

No component changes are needed — the gate enforces every route uniformly.

---

## 7. Files

| File                                                | Role                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/features/auth/route-guard.ts`                  | `RouteGuard` type, `staticData` augmentation, `mergeGuards`, `evaluateAccess`, `routeGuard()` |
| `src/features/auth/components/route-guard-gate.tsx` | Client gate: merges guards, evaluates, redirects                                              |
| `src/routes/_authenticated/route.tsx`               | Auth `beforeLoad` (Unauthorized / Session Expired) + mounts the gate                          |
| `src/routes/unauthorized.tsx`                       | Forbidden (403) page                                                                          |
| `src/routes/auth/session-expired.tsx`               | Session-expired page                                                                          |
| `src/router.tsx`                                    | Query-layer session-expiry redirect                                                           |
| `src/features/auth/route-guard.test.ts`             | Unit tests for merge + evaluate                                                               |
