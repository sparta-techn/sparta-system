# SpartaFlow — Employee Management

> The Owner / HR surface for managing the workforce: create, edit, move, and
> retire employee records from the **directory** and **employee profile**.
>
> The directory + profile read the **live, Supabase-backed** employee list
> (`hrQueries.employees()`). The **management actions** are applied through a
> localStorage-backed reactive **overlay store** that layers edits, status
> changes, soft-deletes, locally-created records, and an audit trail on top of
> that read — so every action is reflected instantly. Each verb maps 1:1 to an
> `employeeRepository` method for the live swap (see §6).

---

## 1. Capabilities

| Action            | Actor      | Effect                                                       |
| ----------------- | ---------- | ------------------------------------------------------------ |
| Create Employee   | Owner / HR | New record added to the directory (distinct from Invite)     |
| Edit Employee     | Owner / HR | Update name, email, title, department, team, role, work mode |
| Change Department | Owner / HR | Move to another department                                   |
| Assign Manager    | Owner / HR | Set / clear the reporting line                               |
| Assign Team       | Owner / HR | Move to another team                                         |
| Assign Role       | Owner / HR | Change RBAC role (owner transfer excluded)                   |
| Reset Password    | Owner / HR | Sends a password-reset email (no record change)              |
| Deactivate        | Owner / HR | Revoke access, keep the record — reversible                  |
| Reactivate        | Owner / HR | Restore a deactivated / suspended employee                   |
| Suspend Account   | Owner / HR | Temporary hold (e.g. security review) — reversible           |
| Soft Delete       | Owner / HR | Remove from the directory; record retained + restorable      |

> **Create Employee vs Invite.** _Create_ makes the record directly (status
> `active`). _Invite_ sends a setup email and tracks acceptance — see
> [`INVITATIONS.md`](./INVITATIONS.md).

---

## 2. Lifecycle & statuses

`EmploymentStatus` (`src/features/hr/mock-data.ts`):
`active` · `on_leave` · `invited` · **`suspended`** · `deactivated` · `offboarding`
(`suspended` was added for account holds).

```
                       ┌─────────── Reactivate ───────────┐
                       │                                   │
   Create ─► active ──┬┴─ Deactivate ─► deactivated ───────┤
                      │                                     │
                      └── Suspend ────► suspended ──────────┘

   any status ── Soft Delete ─► (hidden) ── Restore ─► back to prior status
```

- **Deactivate** and **Suspend** are distinct product states (both revoke
  access; suspend reads as a temporary hold). **Reactivate** returns either to
  `active`.
- **Soft Delete** sets `deletedAt` on the overlay; the record is filtered from
  the directory but reachable via its profile URL and **Restore**.

---

## 3. Data flow

```
  Supabase ──► hrQueries.employees() ──► HrEmployee[]  (base, live read)
                                             │
                    useManagedEmployees(base) │  merges overlay
                                             ▼
        created[]  +  overrides{}  +  soft-delete filter  ──► rendered list
                    (employees-store, localStorage, reactive)
```

- **`useManagedEmployees(base, { includeDeleted? })`** — the merge hook the
  directory, profile and `$id` route consume. Subscribes to the overlay via
  `useSyncExternalStore`, so mutations re-render without touching React Query.
- The `$id` route merges with `includeDeleted: true` so a soft-deleted
  employee's profile stays reachable (with a **Restore** action).

---

## 4. Store API

`src/features/hr/employees-store.ts` — same `useSyncExternalStore` +
`localStorage` pattern as `features/tasks/store.ts` and the invitations store.
Key: `spartaflow:hr:employee-mgmt:v1`.

**Reads** — `mergeEmployees(base, opts)`, `isSoftDeleted(id)`, `auditFor(id)`;
hooks `useManagedEmployees`, `useEmployeeAudit`, `useEmployeesOverlay`.

**Writes** (each records an audit entry) — `createEmployee`, `editEmployee`,
`changeDepartment`, `assignManager`, `assignTeam`, `assignRole`,
`deactivateEmployee`, `reactivateEmployee`, `suspendEmployee`,
`softDeleteEmployee`, `restoreEmployee`, `resetPassword`.
`__resetEmployeeMgmt()` clears local state (test/support).

Every write appends an `EmployeeAuditEntry { action, actor, at, detail }`,
surfaced in the profile's **Activity** tab.

---

## 5. UI

| Surface                                             | File                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Directory (filters, New employee, per-row actions)  | `src/features/hr/components/employee-directory.tsx`                            |
| Profile (header **Manage** menu, Activity timeline) | `src/features/hr/components/employee-profile.tsx`                              |
| Shared actions menu + all lifecycle dialogs         | `src/features/hr/components/employee-actions-menu.tsx`                         |
| Create / Edit form dialog                           | `src/features/hr/components/employee-form-dialog.tsx`                          |
| Assignable roles                                    | `src/features/hr/components/employee-role-options.ts`                          |
| Routes                                              | `src/routes/_authenticated/app/hr.employees.index.tsx`, `hr.employees.$id.tsx` |

`EmployeeActionsMenu` is the single source of truth for the eleven actions,
reused by the directory (icon trigger, per row) and the profile (a **Manage**
button). It owns a reusable Select dialog (department / manager / team / role)
and an `AlertDialog` confirmation (reset / deactivate / suspend / delete /
restore). All primitives are the shared `@/components/ui` ones — no new UI
components, per the UI rules.

---

## 6. Going live (checklist)

The live layer already exists: `EmployeesService`
(`src/services/hr/employees.service.ts`) and the HR `EmployeeRepository`
(`src/repositories/hr/employee.repository.ts`) over `public.employees`
(RLS-gated to `hr` / `admin` / `owner`). To promote the overlay:

| Overlay verb             | Live target                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `createEmployee`         | `employeeRepository.create(insert)`                                  |
| `editEmployee`           | `employeeRepository.update(id, patch)`                               |
| `changeDepartment`       | `employeeRepository.setDepartment(id, departmentId)`                 |
| `assignManager`          | `employeeRepository.assignManager(id, managerId)` (DB cycle-guarded) |
| `assignTeam`             | `employeeRepository.setTeam(id, teamId)`                             |
| `assignRole`             | a `user_roles` write (add a `RolesService`)                          |
| `deactivate` / `suspend` | `employeeRepository.setStatus(id, 'suspended')`                      |
| `reactivate`             | `employeeRepository.setStatus(id, 'active')`                         |
| `resetPassword`          | `supabase.auth.resetPasswordForEmail(email)`                         |
| `softDeleteEmployee`     | add a `deleted_at` column + `setStatus`/soft-delete verb             |

Then have each component mutation call the repository and
`queryClient.invalidateQueries(hrKeys.employees())` instead of the overlay; the
component tree is unchanged. Notes:

- **Status model.** The DB `employee_status` enum is
  `active | invited | suspended | offboarded`. Map product **Deactivate** and
  **Suspend** onto `suspended` (or extend the enum) and **Soft Delete** onto a
  new `deleted_at` column.
- **Roles.** Assigning a role writes `user_roles`, not `employees`; add a
  dedicated service/repository for it.
- **Audit.** Emit audit events (`employee` category) from the repository layer;
  the overlay's audit trail is the interim stand-in.
- **RBAC.** Gate the directory/profile management actions behind the existing
  role guards (Owner / HR).

```

```
