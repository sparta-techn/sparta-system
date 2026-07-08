# RBAC — Role-Based Access Control

_As-built. Last updated: 2026-07-02._

SpartaFlow uses **enterprise RBAC**: users hold one or more **roles**, roles map
to granular **permissions** (`domain.action`), and permissions gate what a user
can see and do. The database is the authoritative enforcement layer via RLS; the
frontend mirrors the same model to gate the UI.

> Roles are stored in a dedicated `user_roles` table — **never** on the profile.
> Roles are additive: a user may hold several (e.g. `team_lead` + `employee`) and
> their permissions are the **union**.

---

## Enforcement layers

Authorization is defended in depth. From authoritative to advisory:

1. **Postgres RLS (authoritative).** Every table has row-level security. Policies
   are role-based (`public.has_role`, `public.has_any_role`) and can also check
   permissions via `public.has_permission(uid, key)`, which resolves
   `user_roles → role_permissions → permissions`. A request that slips past the
   UI still cannot read/write rows it isn't entitled to.
2. **Permission catalog + matrix (source of truth for capabilities).** The
   `permissions` and `role_permissions` tables define _what each role can do_.
   Mirrored in TypeScript by `src/features/auth/permissions.ts`.
3. **UI gating (advisory).** Components call `useAuth().hasPermission(...)` /
   `hasRole(...)` to hide or disable actions. This is UX, not security.

> **Rule of thumb:** never rely on the UI check alone. If an action touches data,
> there must be an RLS policy (or a `SECURITY DEFINER` function) enforcing it.

---

## Roles

Seven canonical enterprise roles, highest privilege first. Roles live in the
Postgres `app_role` enum and are assigned via `user_roles`.

| Role                | Key               | Rank | Purpose                                                                                                                                                 |
| ------------------- | ----------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**           | `owner`           |  100 | Company owner. Everything, plus owner-exclusive company management and the executive dashboard. Read-only on attendance by design.                      |
| **Admin**           | `admin`           |   90 | Full platform administrator: user/role administration, settings, integrations, all operational modules. Not company ownership or the executive cockpit. |
| **HR**              | `hr`              |   70 | People operations: employee lifecycle, org structure, attendance administration, report review.                                                         |
| **Project Manager** | `project_manager` |   60 | Owns delivery: projects, tasks, sprints, report/attendance review, analytics.                                                                           |
| **Team Lead**       | `team_lead`       |   50 | Runs a team: task management + assignment, report/attendance review.                                                                                    |
| **Employee**        | `employee`        |   30 | Individual contributor: own work, own tasks, submit reports.                                                                                            |
| **Intern**          | `intern`          |   20 | Most limited active contributor: read + submit own reports; no task edits.                                                                              |

> **Legacy:** `viewer` (rank 10) is **deprecated** and read-only. Postgres cannot
> drop an enum value, so it remains in `app_role` for compatibility but is not
> part of the canonical enterprise set. Do not assign it to new users.

Labels and ranks: `src/features/auth/types.ts` (`ROLE_LABELS`, `ROLE_RANK`,
`ENTERPRISE_ROLES`).

---

## Permission catalog

Granular `domain.action` keys, grouped by category. Full definitions (with UI
copy) in `PERMISSION_CATALOG` in `src/features/auth/permissions.ts`; seeded into
the `permissions` table by
`supabase/migrations/20260703120100_rbac_granular_permissions.sql`.

| Category         | Permissions                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **employees**    | `employees.read`, `employees.create`, `employees.update`, `employees.delete`, `employees.invite` |
| **organization** | `organization.manage`                                                                            |
| **projects**     | `projects.read`, `projects.create`, `projects.edit`, `projects.archive`, `projects.delete`       |
| **tasks**        | `tasks.read`, `tasks.create`, `tasks.edit`, `tasks.assign`, `tasks.delete`                       |
| **sprints**      | `sprints.manage`                                                                                 |
| **attendance**   | `attendance.read`, `attendance.review`, `attendance.manage`                                      |
| **reports**      | `reports.submit`, `reports.read`, `reports.review`                                               |
| **analytics**    | `analytics.view`, `dashboard.executive.view`                                                     |
| **access**       | `roles.assign`, `permissions.manage`                                                             |
| **settings**     | `settings.manage`, `integrations.manage`, `company.manage`                                       |

---

## Role → permission matrix

`✓` = granted. Source of truth: `ROLE_PERMISSIONS` in
`src/features/auth/permissions.ts` (mirrored in SQL).

| Permission                 | Owner | Admin | HR  | PM  | Lead | Empl | Intern | Viewer¹ |
| -------------------------- | :---: | :---: | :-: | :-: | :--: | :--: | :----: | :-----: |
| `employees.read`           |   ✓   |   ✓   |  ✓  |  ✓  |  ✓   |  ✓   |   ✓    |    ✓    |
| `employees.create`         |   ✓   |   ✓   |  ✓  |     |      |      |        |         |
| `employees.update`         |   ✓   |   ✓   |  ✓  |     |      |      |        |         |
| `employees.delete`         |   ✓   |   ✓   |     |     |      |      |        |         |
| `employees.invite`         |   ✓   |   ✓   |  ✓  |     |      |      |        |         |
| `organization.manage`      |   ✓   |   ✓   |  ✓  |     |      |      |        |         |
| `projects.read`            |   ✓   |   ✓   |     |  ✓  |  ✓   |  ✓   |   ✓    |    ✓    |
| `projects.create`          |   ✓   |   ✓   |     |  ✓  |      |      |        |         |
| `projects.edit`            |   ✓   |   ✓   |     |  ✓  |      |      |        |         |
| `projects.archive`         |   ✓   |   ✓   |     |  ✓  |      |      |        |         |
| `projects.delete`          |   ✓   |   ✓   |     |     |      |      |        |         |
| `tasks.read`               |   ✓   |   ✓   |     |  ✓  |  ✓   |  ✓   |   ✓    |    ✓    |
| `tasks.create`             |   ✓   |   ✓   |     |  ✓  |  ✓   |      |        |         |
| `tasks.edit`               |   ✓   |   ✓   |     |  ✓  |  ✓   |  ✓   |        |         |
| `tasks.assign`             |   ✓   |   ✓   |     |  ✓  |  ✓   |      |        |         |
| `tasks.delete`             |   ✓   |   ✓   |     |  ✓  |      |      |        |         |
| `sprints.manage`           |   ✓   |   ✓   |     |  ✓  |      |      |        |         |
| `attendance.read`          |   ✓   |   ✓   |  ✓  |  ✓  |  ✓   |  ✓   |   ✓    |    ✓    |
| `attendance.review`        |   ✓   |   ✓   |  ✓  |  ✓  |  ✓   |      |        |         |
| `attendance.manage`        |       |   ✓   |  ✓  |     |      |      |        |         |
| `reports.submit`           |   ✓   |   ✓   |     |  ✓  |  ✓   |  ✓   |   ✓    |         |
| `reports.read`             |   ✓   |   ✓   |  ✓  |  ✓  |  ✓   |      |        |    ✓    |
| `reports.review`           |   ✓   |   ✓   |  ✓  |  ✓  |  ✓   |      |        |         |
| `analytics.view`           |   ✓   |   ✓   |  ✓  |  ✓  |      |      |        |         |
| `dashboard.executive.view` |   ✓   |       |     |     |      |      |        |         |
| `roles.assign`             |   ✓   |   ✓   |     |     |      |      |        |         |
| `permissions.manage`       |   ✓   |   ✓   |     |     |      |      |        |         |
| `settings.manage`          |   ✓   |   ✓   |     |     |      |      |        |         |
| `integrations.manage`      |   ✓   |   ✓   |     |     |      |      |        |         |
| `company.manage`           |   ✓   |       |     |     |      |      |        |         |

¹ `viewer` is a deprecated legacy role (read-only).

**Two deliberate asymmetries:**

- **Owners are read-only on attendance.** Owner holds every permission _except_
  `attendance.manage`; only Admin and HR may edit others' attendance records.
  This mirrors the long-standing attendance business rule
  (`isAttendanceReadOnly`) and is unit-tested.
- **The executive dashboard is owner-only.** `dashboard.executive.view` and
  `company.manage` are the two owner-exclusive capabilities Admin does not get.

There is **no implicit inheritance**: a role's capabilities are exactly the rows
granted to it in `role_permissions`. Higher-ranked roles simply happen to be
granted more. This keeps audits straightforward.

---

## Using RBAC

### In the UI (React)

```tsx
import { useAuth } from "@/features/auth/auth-context";

function DeleteProjectButton() {
  const { hasPermission } = useAuth();
  if (!hasPermission("projects.delete")) return null;
  return <Button onClick={remove}>Delete project</Button>;
}
```

`useAuth()` also exposes `hasAnyPermission`, `hasRole`, and `hasAnyRole`. Route
guards follow the same pattern (see
`src/routes/_authenticated/app/executive.tsx`, gated on
`dashboard.executive.view`).

Pure helpers (for non-React code / tests) live in
`src/features/auth/permissions.ts`: `permissionsForRoles(roles)`,
`rolesHavePermission(roles, key)`, plus the attendance/report business-rule
helpers (`canReviewReports`, `canAdministerAttendance`, …).

### In the database (RLS / RPC)

```sql
-- Permission-based check
USING ( public.has_permission(auth.uid(), 'projects.delete') )

-- Role-based check (most existing policies use this form)
USING ( public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]) )
```

### Assigning roles

Roles are rows in `user_roles`. Grant/revoke is gated to `owner` / `admin`
(`roles_admin_write` policy + the `roles.assign` permission). New self-signups
are always provisioned as the least-privileged role by the signup trigger;
elevated roles come only from an admin invite (see `docs/BOOTSTRAP.md`). Every
grant/revoke should be written to the audit trail (`@/lib/logging` `auditLog`).

---

## Data model

| Object                             | Role                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| `app_role` (enum)                  | The role identifiers                                      |
| `user_roles`                       | Which roles a user holds (`user_id`, `role`)              |
| `permissions`                      | The permission catalog (`key`, `category`, `description`) |
| `role_permissions`                 | Role → permission grants (`role`, `permission_id`)        |
| `public.has_role(uid, role)`       | Does the user hold a role?                                |
| `public.has_any_role(uid, role[])` | Does the user hold any of these roles?                    |
| `public.has_permission(uid, key)`  | Does the user (via any role) have a permission?           |

TypeScript mirror: `src/features/auth/types.ts` (`AppRole`, `Permission`) and
`src/features/auth/permissions.ts` (`PERMISSION_CATALOG`, `ROLE_PERMISSIONS`).

---

## Extending RBAC

**Add a permission:**

1. Add the key to the `Permission` union in `src/features/auth/types.ts`.
2. Add a `PERMISSION_CATALOG` entry and grant it to the relevant roles in
   `ROLE_PERMISSIONS` (`src/features/auth/permissions.ts`).
3. Mirror both in a new migration (insert into `permissions`, then
   `role_permissions`).
4. `permissions.test.ts` enforces that the matrix only references catalog keys.

**Add a role:**

1. `ALTER TYPE public.app_role ADD VALUE 'new_role';` (its own migration — a new
   enum value cannot be used in the same transaction it is added).
2. Add it to `AppRole`, `ROLE_LABELS`, `ROLE_RANK`, `ENTERPRISE_ROLES`, and give
   it a `ROLE_PERMISSIONS` entry (TypeScript will flag every exhaustive map until
   you do).
3. Seed its `role_permissions` rows.

---

## Migration history

- `20260703120000_rbac_role_enum.sql` — renamed the legacy `super_admin` role to
  **`admin`** (an enum-label rename, transparent to existing RLS policies and
  stored rows) and added the **`intern`** role.
- `20260703120100_rbac_granular_permissions.sql` — replaced the original coarse
  permission keys (`users:read`, `hr:access`, `owner:access`, …) with the
  granular `domain.action` catalog above and reseeded the role → permission
  matrix.

---

## Not yet implemented (forward-looking)

The current model grants permissions **globally** per role. **Scoped**
permissions — e.g. a Team Lead who may `attendance.review` only for _their_ team,
or a PM scoped to _their_ projects — are approximated today by row-level RLS
(ownership/membership checks in policies) rather than by scoped grants on
`user_roles`. A future `(user_id, role, scope_type, scope_id)` extension to
`user_roles` plus `has_role_in_scope(...)` helpers would make scoping first-class.
Until then, treat the matrix above as global capability and rely on RLS row
predicates for per-row scoping.
