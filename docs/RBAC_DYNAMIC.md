# Dynamic Roles & Permissions — Phases 1–2

_As-built. Last updated: 2026-09-05._

The successor to the fixed `app_role` enum + `has_any_role()` pattern documented
in [RBAC.md](RBAC.md). Admins define their own roles; each role is composed from
a developer-owned catalog of `(module, action, scope)` permissions.

- **Phase 1** — schema + the `has_permission()` engine.
- **Phase 2** — the role-management API and UI (this document's second half).
- **Phase 3** — migrating existing RLS policies onto the engine. Not started.

> **The engine still gates nothing outside its own UI.** No existing RLS policy
> calls it and no `has_any_role()` check has been replaced. `has_any_role()` and
> the legacy `has_permission(uuid, text)` remain the live authorization path for
> the whole application. Verified after Phase 2: `pg_policies` referencing
> `rbac_*` or the 5-arg `has_permission` = **0**, and the `public` schema still
> holds exactly **130** non-`rbac_` policies, unchanged.

|         | Migration                                      | Tests                                                 |
| ------- | ---------------------------------------------- | ----------------------------------------------------- |
| Phase 1 | `20260905120000_rbac_dynamic_roles_phase1.sql` | `supabase/tests/rbac_phase1_test.sql` (49 assertions) |
| Phase 2 | `20260905130000_rbac_role_management_api.sql`  | `supabase/tests/rbac_phase2_test.sql` (39 assertions) |

---

## Why the tables are named `rbac_*`

`permissions`, `role_permissions` and `user_roles` **already exist** with
incompatible shapes — flat `TEXT` permission keys, and junctions keyed by the
`app_role` ENUM rather than a `role_id`. 122 policy references plus
`src/features/auth/permissions.ts` depend on them.

Phase 1 is additive, so the dynamic system lives alongside under an `rbac_`
prefix. A later phase drops the legacy tables and may rename these onto the
bare names.

Likewise `has_permission` is now **overloaded**. Postgres resolves the two by
arity, so both can coexist:

| Signature                                      | Model                                  | Status                  |
| ---------------------------------------------- | -------------------------------------- | ----------------------- |
| `has_permission(uuid, text)`                   | legacy flat key, e.g. `'reports.read'` | live, backs current RLS |
| `has_permission(uuid, text, text, text, uuid)` | dynamic `module/action/scope`          | Phase 1, not yet wired  |

---

## Schema

```
rbac_permissions        (module, action, scope) — developer-seeded catalog
      ▲
      │ permission_id  ON DELETE RESTRICT
rbac_role_permissions
      │ role_id        ON DELETE CASCADE
      ▼
rbac_roles              (name, description, is_protected)
      ▲
      │ role_id        ON DELETE RESTRICT
rbac_user_roles         (user_id, role_id)  — many roles per user
      │ user_id        ON DELETE CASCADE
      ▼
   auth.users
```

**`ON DELETE` rationale** (the project convention is `RESTRICT` for HR-adjacent
data; applied wherever losing a row would silently destroy information):

- `rbac_user_roles.role_id → RESTRICT` — deleting an assigned role would
  silently strip people's access. Admins must unassign first.
- `rbac_role_permissions.permission_id → RESTRICT` — a catalog row can never be
  removed while a role still grants it.
- `rbac_role_permissions.role_id → CASCADE` — grants are _owned_ by the role,
  and roles are explicitly user-deletable. Protected roles are blocked from
  deletion by trigger, so Owner's grants can never cascade away.
- `rbac_user_roles.user_id → CASCADE` — matches the legacy `user_roles` table.

### The catalog is developer-owned, and that is enforced

`rbac_permissions` represents _what the codebase knows how to check_, not
arbitrary strings. `authenticated` holds `SELECT` and nothing else, and no write
policy exists — only migrations and `service_role` can seed it. Two `CHECK`
constraints back this up: `scope IN ('own','team','all')` and a
`^[a-z][a-z0-9_]*$` slug format on `module` / `action`.

---

## Scope lattice

`has_permission(p_user_id, p_module, p_action, p_scope, p_resource_owner_id)`
returns true when **any** of the user's roles grants `module`+`action` at a
stored scope that _covers_ the requested scope. Grants union across all roles.

| Stored scope | Satisfies request    | Condition                                             |
| ------------ | -------------------- | ----------------------------------------------------- |
| `all`        | `own`, `team`, `all` | always; `p_resource_owner_id` is irrelevant           |
| `team`       | `own`, `team`        | `rbac_is_team_member(p_user_id, p_resource_owner_id)` |
| `own`        | `own`                | `p_resource_owner_id = p_user_id` (and not NULL)      |

A user is always "on their own team", which makes `team` a strict superset of
`own`.

An unrecognised `p_scope` **raises** `invalid_parameter_value` rather than
quietly denying — these literals come from our own policies, never from user
input, so a typo should fail loudly. A NULL `p_user_id`/`p_module`/`p_action`
returns false.

`current_user_has_permission(module, action, scope, owner)` is a thin
`auth.uid()` wrapper for use in policies and PostgREST RPC.

---

## How "team" is determined

There is **no `team_members` junction table**. Team and reporting structure live
on `public.employees` (migration `20260630120100`):

| Column                                | Meaning                                            |
| ------------------------------------- | -------------------------------------------------- |
| `employees.user_id → profiles.id`     | identity link (`profiles.id` _is_ `auth.users.id`) |
| `employees.team_id → teams.id`        | team membership                                    |
| `employees.manager_id → employees.id` | self-FK reporting line                             |

`rbac_is_team_member(requester, owner)` returns true when **any** of:

1. `requester = owner` (your own records)
2. both resolve to employees rows sharing a **non-NULL `team_id`**
3. `owner.manager_id = requester.id` — a **direct report**, even across teams

Deliberately excluded, available if we widen later:

- the **transitive** `manager_id` subtree (only direct reports count today)
- `teams.lead_id` / `departments.lead_id` leadership without a manager link
- `profiles.team_id` — a denormalised duplicate of `employees.team_id`; the
  `employees` row is treated as the source of truth

Employee `status` is **not** filtered, so a manager keeps team-scoped access to
an offboarded report's records.

---

## Protected roles

One protected role is seeded: **Owner** (`is_protected = true`), granted every
permission in the catalog. Four triggers enforce this in the database, so the
guarantees hold against psql, the `service_role` key and the Supabase table
editor alike — not just the application:

| #   | Trigger                                                 | Guarantee                                                                                                                                                                |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `rbac_roles_block_protected_delete`                     | a protected role can never be `DELETE`d                                                                                                                                  |
| 2   | `rbac_roles_block_protected_update`                     | its `is_protected` flag and `name` can never change (else #1 is bypassed by un-protecting first). `description` stays editable                                           |
| 3   | `rbac_role_permissions_block_protected_{delete,update}` | its grants can never be revoked or repointed                                                                                                                             |
| 4   | `rbac_permissions_grant_to_protected`                   | every **newly catalogued** permission is auto-granted to every protected role, so the "Owner has everything" invariant cannot rot as later migrations extend the catalog |

The migration ends with a post-condition `DO` block that aborts the whole
migration if Owner's grant count ≠ the catalog count.

**Limit of the mechanism:** a Postgres `SUPERUSER` or the table owner can
`ALTER TABLE … DISABLE TRIGGER`. That is true of any trigger-based guard and sits
outside the Supabase `authenticated` / `service_role` threat model.

---

## Seeded catalog

123 permissions across 17 modules. See the migration for the authoritative list.

| Module          | Actions (scopes)                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `hr`            | view (own/team/all), create (all), edit (own/team/all), delete (all), invite (all), export (team/all)               |
| `organization`  | view, create, edit, delete — all `all`                                                                              |
| `attendance`    | view (own/team/all), create (own/all), edit (own/team/all), approve (team/all), export (own/team/all)               |
| `reports`       | view (own/team/all), create (own), edit (own/team/all), delete (own/all), approve (team/all), export (own/team/all) |
| `payroll`       | view (own/team/all), create/edit/delete/approve (all), export (own/team/all)                                        |
| `projects`      | view (own/team/all), create (all), edit (own/team/all), archive (own/team/all), delete (all), export (team/all)     |
| `tasks`         | view/create/edit/delete (own/team/all), assign (team/all)                                                           |
| `sprints`       | view/create/edit/delete (team/all)                                                                                  |
| `approvals`     | view (own/team/all), create (own), approve (team/all)                                                               |
| `clients`       | view, create, edit, delete — all `all`                                                                              |
| `rewards`       | view (own/team/all), create (team/all), approve (all)                                                               |
| `analytics`     | view (own/team/all), export (team/all)                                                                              |
| `roles`         | view, create, edit, delete, assign — all `all`                                                                      |
| `settings`      | view, edit — `all`                                                                                                  |
| `integrations`  | view, edit — `all`                                                                                                  |
| `notifications` | view (own/all), create (team/all)                                                                                   |
| `audit`         | view, export — `all`                                                                                                |

`sprints` has **no backing table yet** — it is carried over from the legacy
`sprints.manage` key so route guards keep a home.

---

## Running the tests

```bash
supabase start
docker exec supabase_db_<project_ref> psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /path/to/supabase/tests/rbac_phase1_test.sql
docker exec supabase_db_<project_ref> psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /path/to/supabase/tests/rbac_phase2_test.sql
```

Both scripts create their fixtures inside a transaction and `ROLLBACK` — nothing
survives the run.

Phase 1's 49 assertions cover the team resolver, every cell of the scope lattice,
multi-role union, input validation, all four protected-role triggers, and the
`ON DELETE` semantics. Phase 2's 39 assertions run under a **faked JWT identity**
(`request.jwt.claims`, exactly as PostgREST sets it) so the `has_permission()`
gating on each RPC is genuinely executed rather than bypassed by superuser.

---

# Phase 2 — role management API & UI

## Bootstrap

The Phase 2 migration assigns the dynamic **Owner** role to every user holding
the legacy `owner` app_role. Without it nobody satisfies
`has_permission(…, 'roles', …)` and the management UI is unreachable by its own
administrators. This seeds identity rows only — no policy changes, no legacy
grants removed.

## The RPC surface

Every read and write is a `SECURITY DEFINER` function that re-checks
`has_permission(auth.uid(), 'roles', <action>, 'all')` **inside Postgres**.
Authorization therefore does not depend on the client: editing the form payload
or calling PostgREST directly hits the same gate.

| RPC                                        | Requires                 | Notes                                       |
| ------------------------------------------ | ------------------------ | ------------------------------------------- |
| `rbac_my_permissions()`                    | authenticated            | your own access; backs the client-side gate |
| `rbac_role_summaries()`                    | `roles.view`             | roles list + counts, **one round trip**     |
| `rbac_role_permission_ids(role)`           | `roles.view`             | editor checkbox state                       |
| `rbac_effective_permissions(user)`         | `roles.view` (own: none) | unioned access, annotated by granting role  |
| `rbac_user_roles_for(user)`                | `roles.view` (own: none) | a user's assignments                        |
| `rbac_role_grant_impact(role)`             | `roles.view`             | lockout blast radius                        |
| `rbac_create_role(name, desc)`             | `roles.create`           | `is_protected` is never client-settable     |
| `rbac_update_role(id, name, desc)`         | `roles.edit`             | protected: description only                 |
| `rbac_replace_role_permissions(id, ids[])` | `roles.edit`             | atomic full-set swap; rejects protected     |
| `rbac_delete_role(id)`                     | `roles.delete`           | clears junction rows; rejects protected     |
| `rbac_assign_role` / `rbac_unassign_role`  | `roles.assign`           | multiple roles per user                     |

## Save atomicity

`rbac_replace_role_permissions` deletes every existing grant and inserts the new
set. A PL/pgSQL function body **is a single transaction**, so both statements
commit or neither does — a failed save can never leave a role holding a partial
permission set. Unknown permission ids are rejected before any write, and the
test suite asserts that a rejected save leaves the previous set byte-for-byte
intact.

## The counts are not N+1

Two queries carry the whole UI:

```sql
-- rbac_role_summaries(): both counts from PRE-AGGREGATED subqueries, joined once
SELECT r.*, COALESCE(pc.n,0), COALESCE(uc.n,0)
  FROM rbac_roles r
  LEFT JOIN (SELECT role_id, count(*) n FROM rbac_role_permissions GROUP BY role_id) pc ON …
  LEFT JOIN (SELECT role_id, count(*) n FROM rbac_user_roles       GROUP BY role_id) uc ON …

-- rbac_effective_permissions(): one grouped join, not one query per role
SELECT p.module, p.action, p.scope, array_agg(DISTINCT r.name ORDER BY r.name)
  FROM rbac_user_roles ur
  JOIN rbac_roles r ON … JOIN rbac_role_permissions rp ON … JOIN rbac_permissions p ON …
 WHERE ur.user_id = p_user_id
 GROUP BY p.module, p.action, p.scope
```

## Protected role — the four layers

The Owner role is unreachable at every level, each independently sufficient:

1. **UI** — no delete button and no enabled save button is rendered; the picker
   is disabled; the name field is locked.
2. **RPC** — `rbac_replace_role_permissions`, `rbac_delete_role` and a rename via
   `rbac_update_role` all raise `insufficient_privilege` before touching a row.
   Even an _empty_ or _identical_ permission payload is rejected.
3. **Trigger** — the Phase 1 triggers reject the underlying DELETE/UPDATE.
4. **Invariant** — a new catalog row is auto-granted to every protected role, so
   "Owner has everything" cannot rot.

Layers 2–4 hold for `service_role`, verified by test.

## Lockout safeguard

`rbac_role_grant_impact(role)` reports, per permission, how many of the role's
users would lose it **entirely** — i.e. hold it through this role and no other.
Owner-role holders never appear, since Owner grants the whole catalog. The UI
turns that into a soft warning in the editor (on the pending removal set) and in
the delete dialog (over every grant). It never blocks; deleting a role with users
additionally requires typing the role name.

---

## Phase 3 — what comes next (not done)

1. Point the `rbac_*` table policies at `has_permission('roles', …, 'all')`
   instead of the `has_any_role()` bootstrap gate they still use.
2. Seed non-protected roles mirroring the current enum (Admin, HR, Project
   Manager, Team Lead, Employee, Intern) and backfill `rbac_user_roles` from
   `user_roles`.
3. Migrate RLS policies table by table from `has_any_role()` to
   `has_permission()`, choosing an explicit scope per policy.
4. Make sidebar visibility permission-aware — `nav-config.ts` still keys the
   Roles item off the legacy `owner`/`admin` enum, so a non-leadership user
   granted role management can reach `/app/roles` by URL but sees no link.
5. Replace `src/features/auth/permissions.ts`'s static matrix with a query, and
   retire the drift tests that pin it to the legacy SQL seed.
6. Drop the legacy `permissions` / `role_permissions` / `user_roles` tables, the
   `app_role` enum, `has_any_role()` and the 2-arg `has_permission()`.
