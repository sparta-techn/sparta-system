# SpartaFlow — HR Implementation Plan

> **Planning document only. No code or migration is written here; the application
> is not modified.** This plan turns the mock-backed HR module into a real,
> Supabase-backed feature, module by module, following the patterns already
> established by the live `auth` + `attendance` features and the target schema in
> `docs/DATABASE_DESIGN.md`.
>
> Snapshot date: 2026-06-30.

---

## 0. Current state (analysis)

| Layer | Today |
| --- | --- |
| **HR UI** | 12 routes under `routes/_authenticated/app/hr.*` (`index`, `employees.index`, `employees.$id`, `organization`, `invitations`, `leave`, `documents`, `onboarding`, `offboarding`, `announcements`, `audit`). Components in `features/hr/components/*`. |
| **HR data** | 100% mock. `features/hr/mock-data.ts` exports typed seed arrays (`employees`, `teams`, `invitations`, …) + derived helpers (`hrKpis`, `upcomingBirthdays`). **No `api.ts`, `store.ts`, or `queries.ts`** — components import the seed arrays directly. |
| **Backend that already exists** | Tables `profiles` ✅, `user_roles` ✅, `departments` ✅, `teams` ✅ (live, RLS-enabled). Enums `app_role` ✅, `employee_status` ✅. Helpers `has_role` / `has_any_role` / `current_user_roles` ✅. Triggers `handle_new_user`, `handle_user_email_confirmed`, `tg_set_updated_at` ✅. |
| **Service / repo layer** | `AuthService` (profiles CRUD + roles) ✅, `EmployeeRepository` (directory over `profiles`) ✅. No Department/Team/Role/Position/Permission services yet. |
| **Backend planned, not built** | `employment` 🆕, `role_permissions` 🆕, `permission_key` enum 🆕 (see `DATABASE_DESIGN.md §4–5`). Positions, Employment Types, Manager reporting line have **no** backing yet. |

### Key reconciliation gaps (mock ↔ real)

These mismatches must be resolved as part of the work (details per module + §11):

1. **Department** is a string union in mock-data (`"Engineering" | …`) but a **UUID table** in the DB. → Seed `departments`, map by `slug`.
2. **Team** is a free string on `HrEmployee.team`; real is `profiles.team_id` (UUID FK). → Map to `team_id`.
3. **Role**: mock `EmployeeRole` has `"manager"`; the real `app_role` enum has `"project_manager"` (no `"manager"`). → Map `manager → project_manager`; mock has no `viewer`.
4. **Job title** is free text (`profiles.job_title`); this plan promotes it to a **Positions** table with an optional FK.
5. **Employment type** is a free string (`"Full-time" | "Part-time" | "Contractor"`); this plan promotes it to an **Employment Types** table.
6. **Manager** is `HrEmployee.managerId` (free id); real reporting line lands on `employment.manager_id` (FK → `profiles`).

---

## 1. Conventions every module must follow

Inherited from `CLAUDE.md`, `docs/ARCHITECTURE.md`, and `docs/DATABASE_DESIGN.md`:

- **Architecture layering** (top → bottom): UI route/component → feature `queries.ts` (TanStack Query `queryOptions` + key factory) → **Repository** (`src/repositories/*.repository.ts`, domain aggregates) → **Service** (`src/services/*`, `extends BaseService`, one table/RPC) → Supabase client. Components never call Supabase directly.
- **Database**: `uuid` PKs (`gen_random_uuid()`), `created_at`/`updated_at` (trigger `tg_set_updated_at`), **RLS enabled on every table** in the same migration that creates it, grants to `authenticated`/`service_role` only (never `anon`), soft-delete via `archived_at`/`deleted_at` for user content, regenerate `integrations/supabase/types.ts` after each migration.
- **RBAC**: DB is source of truth. Reuse `has_any_role(...)`. HR-writable tables gate on `['hr','super_admin','owner']`; role/permission writes gate on `['super_admin','owner']` (matches existing `roles_admin_write`).
- **Validation**: `zod` schemas at every mutation boundary (mirrors `features/auth/validation.ts`); shared schemas live in `features/hr/validation.ts`.
- **UI**: **all existing HR screens are kept** — only their data source changes from mock arrays to query hooks. Reuse `ui/*` primitives and `components/states` (loading/empty/error). No new global state library.
- **Audit**: HR mutations (role grant/revoke, status change, invite, dept/team move, document upload) call the planned `audit_events` log (`DATABASE_DESIGN.md §18`).

### Shared additions (used by multiple modules)

- **Enum** `permission_key` 🆕 (`DATABASE_DESIGN.md §Enums`).
- **Helper RPC** `has_permission(uid, permission_key)` 🆕 (SECURITY DEFINER, `STABLE`, `search_path=public`, execute revoked from `anon`).
- **Feature data folder** (new): `features/hr/{api.ts, queries.ts, validation.ts, types.ts}` — currently absent; `mock-data.ts` is retired into SQL seed fixtures once each module is wired.
- **Service registration**: each new service is exported from `src/services/index.ts`; each new repository from `src/repositories/index.ts`.

---

## 2. Module: Employees

The canonical person record. Maps onto **`profiles` ✅** plus the new
**`employment` 🆕** extension — **not** a parallel `employees` table (the mock
`HrEmployee` is split across these two).

**Database tables**
- `profiles` ✅ (exists): identity/directory fields (`email`, `full_name`, `display_name`, `avatar_url`, `job_title`, `department_id`, `team_id`, `status`, `timezone`, `locale`, `last_seen_at`).
- `employment` 🆕 (`DATABASE_DESIGN.md §5`): `profile_id` PK → `profiles(id)` CASCADE, `employee_code` UNIQUE, `manager_id` → `profiles(id)` SET NULL, `employment_type_id` 🆕 → `employment_types(id)` (see §7), `position_id` 🆕 → `positions(id)` SET NULL (see §4), `hire_date`, `birth_date`, `end_date`, `work_location`, `work_mode` (`remote`/`hybrid`), `phone`, timestamps. Indexes: `(manager_id)`, `(hire_date)`, `(birth_date)`.
- Promote `employee_status` usage; offboarding satellites (`onboarding_tasks`, `offboarding_tasks`, `documents`, `invitations`, `leave_*`) tracked separately (`BACKEND_MIGRATION_PLAN §4`), out of this plan's core scope.

**APIs** (`features/hr/api.ts` — Supabase calls behind the service)
- Read: `listEmployees(filters)`, `getEmployee(id)` (profile + employment join), `getDirectory(params)`, `getEmployeesByManager(id)`.
- Write: `createEmployment(profileId, payload)`, `updateEmployment(profileId, patch)`, `setEmployeeStatus(id, status)`, `assignDepartment/Team(id, …)`, invite via existing auth admin invite flow.

**Services**
- Extend existing `AuthService` (owns `profiles`) for directory reads/writes (already has `list`, `getById`, `update`, `getRoles`).
- New `EmploymentService extends BaseService<Employment, EmploymentInsert, EmploymentUpdate>` (`table = "employment"`, `entity = "Employment"`) for the HR extension row.

**Repositories**
- Extend existing **`EmployeeRepository`** (already delegates to `AuthService`; has `list`, `getByEmail`, `listByDepartment`, `listByTeam`, `listByStatus`, `setStatus`, `getRoles`). Add aggregate `getEmployeeProfile(id)` = profile + employment + roles + manager, composing `AuthService` + `EmploymentService`.

**UI screens** (existing, keep)
- `hr.employees.index.tsx` (directory grid/table — `employee-directory.tsx`), `hr.employees.$id.tsx` (profile — `employee-profile.tsx`), `hr.index.tsx` KPIs (`hr-kpi-grid.tsx`, `dashboard-widgets.tsx`), `invite-employee-dialog.tsx`. Swap mock imports → `useQuery(hrQueries.employees(...))`.

**Validation** (`features/hr/validation.ts`, `zod`)
- `employmentSchema`: `employee_code` (regex `^EMP-\d{3,}$`), `hire_date` ≤ today, `birth_date` < hire_date, `end_date` ≥ hire_date (nullable), `work_mode` enum, `manager_id` ≠ self. `employeeStatusSchema` = `employee_status` enum. Email reuse `emailSchema` from auth.

**Relationships**
- `profiles 1:1 employment` · `employment.manager_id → profiles` (self-referential reporting) · `profiles → departments` / `teams` · `profiles 1:N user_roles` · `employment → positions` / `employment_types`.

---

## 3. Module: Departments

**Database tables**
- `departments` ✅ (exists): `id`, `name` UNIQUE, `slug` UNIQUE, timestamps. 🔁 Optional additions: `lead_id uuid → profiles(id) SET NULL` (department head), `description text`, `archived_at`.

**APIs**
- `listDepartments()`, `getDepartment(id)`, `createDepartment(payload)`, `updateDepartment(id, patch)`, `archiveDepartment(id)`, `getDepartmentHeadcount()` (via view).

**Services**
- New `DepartmentService extends BaseService<Department, DepartmentInsert, DepartmentUpdate>` (`table = "departments"`). Add `listWithCounts()` reading a `department_stats` view (headcount, team count).

**Repositories**
- New `DepartmentRepository` → `DepartmentService`. Aggregate `getWithTeams(id)` = department + its teams + headcount (composes `TeamService`).

**UI screens** (existing, keep)
- `hr.organization.tsx` (`organization-structure.tsx` — dept → team → people tree). Add inline create/edit dialog reusing `ui/dialog`. KPIs on `hr.index`.

**Validation**
- `departmentSchema`: `name` 2–60 chars unique, `slug` kebab-case auto-derived from name (`^[a-z0-9-]+$`), `lead_id` must be an existing active employee. Block delete/archive when teams or profiles still reference it (FK is `SET NULL`, but warn in UI).

**Relationships**
- `departments 1:N teams` · `departments 1:N profiles` · `departments 1:N projects` (FK exists in target schema) · `departments 1:1 profiles (lead_id)`.

---

## 4. Module: Positions

New concept. Today `profiles.job_title` is free text and `TITLES_BY_DEPT` is a
mock constant. Promote to a structured catalog so titles are consistent and
filterable.

**Database tables**
- `positions` 🆕: `id` PK, `title` text NOT NULL, `slug` UNIQUE, `department_id uuid → departments(id) SET NULL` (a position belongs to a department), `level text` (e.g. `junior`/`mid`/`senior`/`staff`/`lead`), `description text`, `archived_at`, timestamps. UNIQUE `(department_id, title)`. Index `(department_id)`.
- Link: add `position_id uuid → positions(id) SET NULL` to `employment` (§2). `profiles.job_title` kept as denormalized display string (set from the position title) for cheap directory reads.

**APIs**
- `listPositions(filters)`, `listPositionsByDepartment(deptId)`, `getPosition(id)`, `createPosition`, `updatePosition`, `archivePosition`.

**Services**
- New `PositionService extends BaseService<Position, PositionInsert, PositionUpdate>` (`table = "positions"`). `listByDepartment(deptId)`.

**Repositories**
- New `PositionRepository` → `PositionService`. Aggregate `listWithHeadcount()` (positions + count of employments referencing each).

**UI screens**
- New panel under `hr.organization.tsx` ("Positions" tab) reusing `ui/table` + create dialog. Position selector wired into `invite-employee-dialog.tsx` and `employee-profile.tsx` (replaces free-text job title). No new route required.

**Validation**
- `positionSchema`: `title` 2–80 chars, unique within department, `level` enum, `department_id` exists. Prevent archive while employments reference it (warn; FK `SET NULL`).

**Relationships**
- `departments 1:N positions` · `positions 1:N employment` (an employee holds one position).

---

## 5. Module: Roles

Authorization roles. Maps onto **`user_roles` ✅** and the **`app_role` enum ✅**
(both live). This is assignment of existing roles, not free creation.

**Database tables**
- `user_roles` ✅ (exists): `id`, `user_id → auth.users CASCADE`, `role app_role`, `granted_by → auth.users SET NULL`, `granted_at`, UNIQUE `(user_id, role)`.
- `app_role` enum ✅: `owner, super_admin, hr, project_manager, team_lead, employee, viewer`.

**APIs**
- `listUserRoles(userId)`, `listUsersByRole(role)`, `grantRole(userId, role)`, `revokeRole(userId, role)`, `setRoles(userId, roles[])` (diff grant/revoke in one call). All write paths also append to `audit_events` (`role_grant`/`role_revoke`).

**Services**
- New `RoleService` (composes `user_roles`). Because `user_roles` writes are gated to `super_admin`/`owner` by RLS, expose `grant`/`revoke`/`listByUser`/`listByRole`. Could `extends BaseService<UserRole>` for reads + custom grant/revoke methods.
- Reuse existing `AuthService.getRoles(userId)`.

**Repositories**
- New `RoleRepository` → `RoleService`. Aggregate `getRoleMatrix()` (all employees × roles, for the admin grid). Reuse `EmployeeRepository.getRoles`.

**UI screens**
- Role column/badges in `employee-directory.tsx` and `badges.tsx` (exists). Role-change control on `employee-profile.tsx` (gated by `hasPermission("roles:write")`). New "Roles & Access" tab on `hr.organization.tsx` or a sub-route. Audit surfaced in `hr.audit.tsx` (`audit-log-view.tsx`).

**Validation**
- `roleAssignmentSchema`: `role ∈ app_role`; UI only offers roles the actor outranks (`ROLE_RANK` from `auth/types.ts`); cannot revoke the last `owner`; map legacy mock `"manager" → "project_manager"` on import. Enforcement is RLS; zod is UI guard.

**Relationships**
- `auth.users / profiles 1:N user_roles` · `app_role 1:N user_roles` · `app_role 1:N role_permissions` (§6).

---

## 6. Module: Permissions

Moves the frontend `permissions.ts` matrix into the DB as the single source of
truth so UI gating and RLS derive from one table (`DATABASE_DESIGN.md §4`).

**Database tables**
- `role_permissions` 🆕: composite PK `(role app_role, permission permission_key)`. Index `(role)`.
- `permission_key` enum 🆕: at minimum the current keys `users:read, users:write, roles:write, hr:access, owner:access, reports:read, reports:write` (extensible: `projects:write, tasks:write`).
- Helper `has_permission(uid, permission_key)` 🆕 SECURITY DEFINER — `EXISTS(user_roles JOIN role_permissions …)`.
- **Seed** exactly mirrors `features/auth/permissions.ts` so behavior is unchanged: owner → all; super_admin → all except `owner:access`; hr → `users:read/write, hr:access, reports:read`; project_manager/team_lead → `users:read, reports:read/write`; employee → `users:read, reports:write`; viewer → `users:read, reports:read`.

**APIs**
- `listPermissions()`, `listPermissionsByRole(role)`, `setRolePermissions(role, permission[])` (owner/super_admin only). Read-mostly.

**Services**
- New `PermissionService extends BaseService<RolePermission>` (`table = "role_permissions"`). `listByRole(role)`, `replaceForRole(role, perms[])`.

**Repositories**
- New `PermissionRepository` → `PermissionService`. Aggregate `getMatrix()` = full role × permission grid (drives both an admin UI and a parity check against `permissions.ts`).

**UI screens**
- New read-only "Permissions matrix" panel on `hr.organization.tsx` / access settings (role × permission checkbox grid, editable only for owner/super_admin). Most consumers keep using `useAuth().hasPermission(...)` unchanged — the provider can later source the matrix from this table.

**Validation**
- `rolePermissionsSchema`: `role ∈ app_role`, `permission ∈ permission_key`; reject removing `owner:access` from `owner`; **CI/test parity assertion** that the seeded table equals `ROLE_PERMISSIONS` in `permissions.ts` (closes the documented drift risk).

**Relationships**
- `app_role 1:N role_permissions` · `role_permissions N:1 permission_key` · consumed by `has_permission` used in RLS + `AuthProvider`.

---

## 7. Module: Employment Types

New concept. Today employment type is a free string union
(`"Full-time" | "Part-time" | "Contractor"`). Promote to a small reference table
so it is consistent, extensible, and FK-enforced.

**Database tables**
- `employment_types` 🆕: `id` PK, `name` text UNIQUE (`Full-time`, `Part-time`, `Contractor`, `Intern`), `slug` UNIQUE, `is_active boolean DEFAULT true`, `description text`, timestamps.
- Link: `employment.employment_type_id uuid → employment_types(id)` (§2). (Alternative considered: a Postgres enum. Rejected — a table allows admin-managed additions without a migration, matching the "managers can configure" intent.)
- **Seed**: the three mock values + `Intern`.

**APIs**
- `listEmploymentTypes()`, `createEmploymentType`, `updateEmploymentType`, `deactivateEmploymentType`.

**Services**
- New `EmploymentTypeService extends BaseService<EmploymentType>` (`table = "employment_types"`).

**Repositories**
- New `EmploymentTypeRepository` → `EmploymentTypeService`. `listActive()`.

**UI screens**
- Reference-data panel in HR settings / `hr.organization.tsx`; selector wired into `invite-employee-dialog.tsx` and `employee-profile.tsx`. Filter chip on `employee-directory.tsx`.

**Validation**
- `employmentTypeSchema`: `name` 2–40 chars unique; cannot deactivate a type still referenced by active employments (warn). Slug auto-derived.

**Relationships**
- `employment_types 1:N employment`.

---

## 8. Module: Teams

**Database tables**
- `teams` ✅ (exists): `id`, `department_id → departments SET NULL`, `name`, `slug` UNIQUE, timestamps. 🔁 Add `lead_id uuid → profiles(id) SET NULL` (team lead — mock `HrTeam.leadId`), `description text`, `archived_at`.
- Membership uses existing `profiles.team_id` (one primary team per person). `memberCount` is **derived** (view), never stored (mock stores it; drop on migration).

**APIs**
- `listTeams(filters)`, `listTeamsByDepartment(deptId)`, `getTeam(id)`, `createTeam`, `updateTeam`, `archiveTeam`, `setTeamLead(id, leadId)`, `listTeamMembers(id)`, `getTeamHeadcount()`.

**Services**
- New `TeamService extends BaseService<Team, TeamInsert, TeamUpdate>` (`table = "teams"`). `listByDepartment(deptId)`, `listMembers(teamId)` (profiles where `team_id = id`).

**Repositories**
- New `TeamRepository` → `TeamService`. Aggregate `getWithMembers(id)` = team + lead profile + members + count (composes `AuthService`/`EmployeeRepository`).

**UI screens** (existing, keep)
- `hr.organization.tsx` (`organization-structure.tsx`) team nodes; team filter on `employee-directory.tsx`; team badge on `employee-profile.tsx`. Add team create/edit dialog.

**Validation**
- `teamSchema`: `name` 2–60 chars (unique within department), `slug` kebab-case unique, `department_id` exists, `lead_id` is an active employee (ideally in the same department). Reassign members before archiving (warn).

**Relationships**
- `departments 1:N teams` · `teams 1:N profiles (team_id)` · `teams 1:1 profiles (lead_id)`.

---

## 9. Module: Managers

**Not a separate entity** — a reporting relationship over employees plus the
existing leadership FKs. Surfaced through views and repository aggregates.

**Database tables**
- `employment.manager_id → profiles(id) SET NULL` 🆕 (primary reporting line; mock `HrEmployee.managerId`). Index `(manager_id)`.
- Leadership FKs reused: `teams.lead_id` (§8), `departments.lead_id` (§3), `projects.manager_id` (target schema).
- Optional view `org_chart` 🆕: recursive CTE over `employment(profile_id, manager_id)` exposing depth/path for the reporting tree (guard against cycles).

**APIs**
- `getManagerChain(employeeId)` (upward), `getDirectReports(managerId)`, `getReportingTree(rootId)` (downward), `setManager(employeeId, managerId)`, `listManagers()` (distinct `manager_id`s / users with `project_manager`/`team_lead` role).

**Services**
- No dedicated table → add manager methods to `EmploymentService` (`listDirectReports(managerId)`, `setManager(...)`) and expose the `org_chart` view via a thin read. Reuse `RoleService` to identify role-based managers.

**Repositories**
- Extend **`EmployeeRepository`**: `getDirectReports(id)`, `getManager(id)`, `getReportingTree(id)`. (Mirrors the existing `getByManager`-style helpers.)

**UI screens** (existing, keep)
- Reporting line shown on `employee-profile.tsx` ("Reports to" + "Direct reports"); manager column/filter in `employee-directory.tsx`; org chart in `organization-structure.tsx` (`hr.organization.tsx`); manager picker in `invite-employee-dialog.tsx`. Manager-scoped widgets already exist in the `manager` feature.

**Validation**
- `managerAssignmentSchema`: `manager_id` is an existing active employee, `≠` self, and assignment **must not create a cycle** (walk the chain server-side in the `set_manager` path / a trigger). Optionally require the manager to hold `project_manager`/`team_lead`/elevated role.

**Relationships**
- `employment.manager_id → profiles` (self-referential) · derived `manager 1:N reports` · intersects `teams.lead_id`, `departments.lead_id`, `projects.manager_id`.

---

## 10. Cross-module relationships (summary)

```
auth.users 1—1 profiles 1—1 employment
profiles  *—1 departments        departments 1—* teams
profiles  *—1 teams              departments 1—* positions
profiles  1—* user_roles         positions   1—* employment
app_role  1—* user_roles         employment_types 1—* employment
app_role  1—* role_permissions   employment.manager_id ──┐ (self-ref → profiles)
permission_key 1—* role_permissions                       └─ reporting line
departments.lead_id / teams.lead_id → profiles (leadership)
```

Legend: ✅ exists · 🆕 new · 🔁 extend.
**Exists:** profiles, user_roles, departments, teams, app_role, employee_status,
`has_role`/`has_any_role`/`current_user_roles`.
**New:** employment, positions, employment_types, role_permissions,
`permission_key` enum, `has_permission`, `org_chart` view, `department_stats` /
`team_headcount` views.
**Extend:** teams(+lead_id), departments(+lead_id), profiles(job_title kept
denormalized).

---

## 11. Build order

Each step ships its table(s) **with RLS + policies in the same migration**, then
its service → repository → `queries.ts`, then swaps the matching HR screen off
mock data, then regenerates `integrations/supabase/types.ts`.

1. **Reference data (no behavior change):** `permission_key` enum + `role_permissions` (+ seed mirroring `permissions.ts`, + parity test) · `employment_types` (+ seed) · `positions`. Add `DepartmentService`, `TeamService`, `PermissionService`, `EmploymentTypeService`, `PositionService` + repositories.
2. **Employee core:** `employment` table (+ `manager_id`, `position_id`, `employment_type_id`) · `EmploymentService` · extend `EmployeeRepository`. Backfill from `profiles`.
3. **Org leadership + views:** `teams.lead_id`, `departments.lead_id`; `department_stats`, `team_headcount`, `org_chart` views.
4. **Wire UI:** introduce `features/hr/{api,queries,validation,types}.ts`; convert each screen (`employees.index/$id`, `organization`, KPIs, dialogs) from mock arrays to query hooks via repositories; render through `components/states`.
5. **Audit + RBAC parity:** route HR mutations through `audit_events`; switch `AuthProvider` permission source toward `has_permission` / `role_permissions`; retire `features/hr/mock-data.ts` into SQL seed fixtures.

---

## 12. Out of scope (tracked elsewhere)

HR satellites — `invitations`, `leave_requests`/`leave_balances`, `documents`
(→ unified `attachments`), `announcements`, `onboarding_tasks`,
`offboarding_tasks`, `audit_events` — follow the same patterns and are tracked in
`docs/BACKEND_MIGRATION_PLAN.md §4` and `docs/DATABASE_DESIGN.md §5, §12, §18`.
This plan covers the eight org-structure modules requested: Employees,
Departments, Positions, Roles, Permissions, Employment Types, Teams, Managers.

*No application code or migration was modified by this document.*
