# SpartaFlow — HR Backend Layer

> The class-based **service + repository** layer for the HR domain, sitting on
> top of the HR tables created in
> `supabase/migrations/2026063012*_hr_*.sql`. Covers CRUD for **Departments,
> Teams, Positions, and Employees**.
>
> **The frontend is unchanged.** This layer is additive — `features/hr` still
> renders from its mock store. Wiring the UI to these repositories is a later,
> deliberate step.

---

## 1. Where it sits

```
UI / hooks / TanStack Query
        │  call
        ▼
@/repositories/hr      ← domain API (this layer): aggregates + intention-revealing verbs
        │  use
        ▼
@/services/hr          ← CRUD + domain methods over one table each (extends BaseService)
        │  use
        ▼
@/integrations/supabase  ← the single Supabase client (RLS-enforced)
```

- **Services** extend the shared `BaseService<Row, Insert, Update>` (`@/services/core`),
  inheriting `list` / `paginate` / `getById` / `getByIdOrThrow` / `create` /
  `createMany` / `update` / `upsert` / `remove` / `count`, and add domain methods.
- **Repositories** wrap a service (constructor-injected, defaulting to the shared
  singleton), expose the domain surface, and add cross-row aggregates.
- Errors normalize to `ServiceError` (`err.code`, e.g. `not_found`) from the
  service layer — handle them the same way as the rest of the app.

---

## 2. Files

```
src/services/hr/
  types.ts                 Row / Insert / Update shapes (snake_case = DB columns)
  departments.service.ts   DepartmentsService → public.departments
  teams.service.ts         TeamsService       → public.teams
  positions.service.ts     PositionsService   → public.positions
  employees.service.ts     EmployeesService   → public.employees
  index.ts                 Barrel — import from "@/services/hr"

src/repositories/hr/
  department.repository.ts  DepartmentRepository → DepartmentsService
  team.repository.ts        TeamRepository       → TeamsService
  position.repository.ts    PositionRepository   → PositionsService
  employee.repository.ts    EmployeeRepository   → EmployeesService
  index.ts                  Barrel — import from "@/repositories/hr"
```

The four services are also re-exported from the root `@/services` barrel. The HR
repositories are **only** exported from `@/repositories/hr` (see §6).

---

## 3. Types (`@/services/hr`)

DB-shaped, snake_case (so `BaseService` filter/`orderBy` keys map straight to
PostgREST columns):

| Type | Notes |
| --- | --- |
| `Department` / `DepartmentInsert` / `DepartmentUpdate` | `name`, `slug` required on insert; `description`, `lead_id` optional; `archived_at` on update. |
| `Team` / `TeamInsert` / `TeamUpdate` | adds `department_id`. |
| `Position` / `PositionInsert` / `PositionUpdate` | `title`, `slug`; `department_id`, `level`, `is_active`. |
| `Employee` / `EmployeeInsert` / `EmployeeUpdate` | `user_id` required (1:1 with `profiles`); `manager_id` self-ref; `status` is `EmployeeStatus`. |
| `EmployeeStatus` | re-exported from `@/features/auth/types` (`active`/`invited`/`suspended`/`offboarded`). |

Insert types omit server-managed columns (`id`, `created_at`, `updated_at`,
`created_by`/`updated_by` — the DB defaults `created_by` to `auth.uid()`).

---

## 4. CRUD surface

Every service inherits the `BaseService` verbs; the table lists the **added**
domain methods. Repositories expose the same surface plus the aggregates noted.

### Departments — `departmentRepository` → `DepartmentsService`

| Method | Purpose |
| --- | --- |
| `list` / `getById` / `getByIdOrThrow` | Reads (inherited). |
| `listActive()` | Non-archived (`archived_at IS NULL`). |
| `getBySlug(slug)` | Lookup by unique slug. |
| `listByLead(leadId)` | Departments a person heads. |
| `create` / `update` / `remove` | Writes. |
| `setLead(id, leadId\|null)` | Assign / clear department head. |
| `archive(id)` / `restore(id)` | Soft-archive lifecycle. |

### Teams — `teamRepository` → `TeamsService`

| Method | Purpose |
| --- | --- |
| `list` / `getById` / `getByIdOrThrow` | Reads. |
| `listActive()` | Non-archived. |
| `listByDepartment(departmentId)` | Teams in a department. |
| `getBySlug(slug)` | Lookup by slug. |
| `create` / `update` / `remove` | Writes. |
| `setLead` / `archive` / `restore` | Lead + soft-archive lifecycle. |

### Positions — `positionRepository` → `PositionsService`

| Method | Purpose |
| --- | --- |
| `list` / `getById` / `getByIdOrThrow` | Reads. |
| `listActive()` | `is_active = true`. |
| `listByDepartment(departmentId)` | Positions in a department. |
| `getBySlug(slug)` | Lookup by slug. |
| `create` / `update` / `remove` | Writes. |
| `setActive(id, bool)` / `archive(id)` | Activation / soft-archive. |

### Employees — `employeeRepository` → `EmployeesService`

| Method | Purpose |
| --- | --- |
| `list` / `getById` / `getByIdOrThrow` | Reads. |
| `getByUserId(userId)` | Employment record for an auth user / profile id. |
| `getByCode(code)` | Lookup by unique employee code. |
| `listByDepartment` / `listByTeam` / `listByStatus` | Filtered lists. |
| `getDirectReports(managerId)` | Reports for a manager. |
| `getManager(id)` | **Aggregate** — resolves the manager record (2-hop). |
| `create` / `update` / `remove` | Writes. |
| `setStatus(id, status)` | Lifecycle status change. |
| `assignManager(id, managerId\|null)` | Reporting line (cycle-guarded in DB). |
| `setDepartment` / `setTeam` / `setPosition` | Re-org moves (or clear with `null`). |

---

## 5. Usage

```ts
import { departmentRepository, employeeRepository } from "@/repositories/hr";

// Read
const active = await departmentRepository.listActive();
const reports = await employeeRepository.getDirectReports(managerId);

// Write
const eng = await departmentRepository.create({ name: "Engineering", slug: "engineering" });
await employeeRepository.assignManager(empId, managerId);
```

Inside a TanStack Query hook (the intended consumption path):

```ts
import { useQuery } from "@tanstack/react-query";
import { teamRepository } from "@/repositories/hr";

export function useTeams(departmentId: string) {
  return useQuery({
    queryKey: ["hr", "teams", { departmentId }],
    queryFn: () => teamRepository.listByDepartment(departmentId),
  });
}
```

Testing with an injected stub:

```ts
const repo = new DepartmentRepository(fakeDepartmentsService);
```

---

## 6. Conventions & notes

- **Import singletons, not classes.** Classes exist for testing / DI.
- **Repositories are the domain entry point.** Components/hooks call repositories,
  not services or Supabase directly (per CLAUDE.md).
- **Authorization is enforced by RLS**, not here. Reads are directory-scoped;
  writes to all four tables require `hr` / `super_admin` / `owner`. These methods
  surface PostgREST/RLS failures as `ServiceError`.
- **Two `EmployeeRepository`s exist, intentionally:**
  - `@/repositories` → operates on the lightweight **`profiles`** directory (pre-existing).
  - `@/repositories/hr` → operates on the richer **`employees`** employment record (this layer).

  They are **not** merged into one barrel to avoid a name clash; import the HR one
  from `@/repositories/hr`.
- **Soft-archive over delete.** `archive`/`restore` set `archived_at`; `remove`
  is a hard delete, exposed but rarely the right call for org data.
- **`null` filtering** (`listActive`) uses a custom `.is("archived_at", null)`
  query because PostgREST `.eq(col, null)` does not mean `IS NULL`.

---

## 7. Scope

- **In:** services + repositories with CRUD for Departments, Teams, Positions,
  Employees; barrels; root `@/services` registration.
- **Not touched:** the frontend (`features/hr` still renders from its mock
  store), and `employee_profiles` / `employment_types` / `permissions` /
  `role_permissions` (tables exist from the migration; no service requested for
  them yet).
- **Next (not done here):** `features/hr/{queries.ts}` query hooks, then swap each
  HR screen from mock data to these repositories.

*No frontend files were modified. `npx tsc --noEmit` passes with 0 errors.*
