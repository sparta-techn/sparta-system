# RBAC Implementation

Role-based access control is enforced at **two independent layers**:

1. **Database (authoritative)** — Postgres RLS using `has_role` / `has_any_role` security-definer helpers. RLS is the source of truth.
2. **Frontend (UI affordance)** — `useAuth()` exposes `hasRole`, `hasAnyRole`, `hasPermission`, `hasAnyPermission` for hiding nav items and gating routes. The frontend MUST NOT be the only line of defense for any sensitive action.

## Roles

| Role            | Stored as         | Notes                                       |
| --------------- | ----------------- | ------------------------------------------- |
| Owner           | `owner`           | Founders / executives. Full access.         |
| Super Admin     | `super_admin`     | Platform administrators.                    |
| HR              | `hr`              | Manage users, departments, teams, time-off. |
| Project Manager | `project_manager` | Cross-team coordination.                    |
| Team Lead       | `team_lead`       | Manage their team's dependencies / reports. |
| Employee        | `employee`        | Default role on signup.                     |
| Viewer          | `viewer`          | Read-only stakeholder.                      |

Roles are **additive** — a single user can hold multiple roles via multiple rows in `user_roles`.

## Storage

```sql
CREATE TYPE public.app_role AS ENUM (
  'owner','super_admin','hr','project_manager','team_lead','employee','viewer'
);

CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
```

> Roles are **never** stored on `profiles`. A client with `UPDATE` rights on a profile must not be able to escalate privileges.

## Database helpers

```sql
public.has_role(uuid, app_role) RETURNS boolean    -- SECURITY DEFINER, STABLE
public.has_any_role(uuid, app_role[]) RETURNS boolean
public.current_user_roles() RETURNS SETOF app_role  -- usable from the client via RPC
```

Both `has_role` and `has_any_role` are **revoked** from `anon` and `authenticated` so they can only be called from inside RLS policies. Policy evaluation runs as the function definer, so this works.

## RLS policies (current scope)

```sql
-- Profiles
profile_read_directory   FOR SELECT  → any signed-in user, excluding offboarded
profile_self_update      FOR UPDATE  → id = auth.uid()
profile_admin_update     FOR UPDATE  → has_any_role(uid, ['hr','super_admin','owner'])

-- Departments / teams
dept_read_authenticated  FOR SELECT  → all signed-in
dept_admin_write         FOR ALL     → has_any_role(uid, ['hr','super_admin','owner'])
(team_* mirror the same shape)

-- Roles
roles_self_read          FOR SELECT  → user_id = auth.uid() OR admin
roles_admin_write        FOR ALL     → has_any_role(uid, ['super_admin','owner'])
```

HR can manage profiles, departments and teams, but **only Super Admin / Owner can assign or revoke roles**. This prevents an HR account compromise from minting a new Owner.

## Frontend permission matrix

`src/features/auth/permissions.ts` flattens roles into permission keys used by the UI:

| Permission      | Roles holding it                                           |
| --------------- | ---------------------------------------------------------- |
| `users:read`    | every role                                                 |
| `users:write`   | hr, super_admin, owner                                     |
| `roles:write`   | super_admin, owner                                         |
| `hr:access`     | hr, super_admin, owner                                     |
| `owner:access`  | owner                                                      |
| `reports:read`  | hr, project_manager, team_lead, viewer, super_admin, owner |
| `reports:write` | employee, project_manager, team_lead, super_admin, owner   |

## Route gating

```tsx
// src/routes/_authenticated/route.tsx — owns auth gate (ssr:false + getUser)
// src/routes/_authenticated/_hr/route.tsx (example)
export const Route = createFileRoute("/_authenticated/_hr")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.hasAnyRole(["hr", "super_admin", "owner"])) {
      throw redirect({ to: "/unauthorized", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
```

Inside already-gated pages, use `useAuth().hasPermission(...)` only to hide UI affordances. Any sensitive backend call must rely on RLS — never on the frontend check alone.

## Audit & rotation

- Every role grant records `granted_by` and `granted_at`.
- Add HR/Super-Admin role assignments to the audit log when that module ships.
- Rotate Owner / Super Admin roles on offboarding; the `profile.status = offboarded` change is independent of role revocation — do both.
