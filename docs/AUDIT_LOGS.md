# SpartaFlow — Audit Logs

> A tamper-evident, append-only record of **security-sensitive activity**: who
> did what, when, and what changed. Distinct from the HR-scoped activity list
> (`features/hr` `auditLog`) and the project/task `activity_feed` — this is the
> cross-cutting *security* audit.
>
> The store is a reactive, `localStorage`-backed sink mirroring a future
> append-only Supabase `audit_logs` table + `AuditService`; swapping it for
> server persistence does not touch the emitters or the viewer.

---

## 1. Tracked events

| Action | Category | Emitted from |
| --- | --- | --- |
| `login` | auth | `auth-service.signInWithPassword` (success) |
| `logout` | auth | `auth-service.signOut` |
| `failed_login` | auth | `auth-service.signInWithPassword` (error) |
| `role_changed` | access | Employee actions menu → Assign role |
| `permission_changed` | access | Role → permission matrix editor (future UI); seeded example |
| `employee_created` | employee | Employee form dialog → Create |
| `employee_deleted` | employee | Employee actions menu → Delete (soft delete) |
| `project_deleted` | project | `projects/store.archiveProject` (retire/delete) |
| `settings_changed` | settings | Invitation expiry, AI provider settings |

`permission_changed` has no live UI yet (there is no role→permission matrix
editor); the action, category, and a seeded example exist so it renders and is
ready to wire the day that editor lands.

---

## 2. Stored fields

Each `AuditEvent` (`src/features/audit/types.ts`) captures exactly the required
columns:

| Field | Column | Notes |
| --- | --- | --- |
| **Who** | `actor` + `actorId` | Display name/email + user id. `actorId` is `null` for pre-auth events (failed login). |
| **When** | `at` | ISO timestamp. |
| **What** | `action` (+ `category`) | The tracked action. |
| **Old value** | `oldValue` | Value before the change (nullable). |
| **New value** | `newValue` | Value after the change (nullable). |
| **IP (future)** | `ip` | Reserved — always `null` client-side; filled server-side later. |
| **Device (future)** | `device` | Reserved — same. |
| — | `target` / `targetType` | The object acted upon (employee name, project, "Invitation settings", …). |
| — | `meta` | Free-form structured context. |

> **Why IP/Device are reserved.** A browser cannot see its own public IP
> reliably and a spoofable `navigator.userAgent` is not trustworthy for a
> security log. These must be captured **server-side** from the request context
> (edge function / RLS trigger), so the columns exist now and stay `null` until
> that phase.

---

## 3. Recording an event

```ts
import { recordAudit } from "@/features/audit/audit-store";

recordAudit({
  action: "role_changed",
  target: employee.name,
  targetType: "employee",
  oldValue: employee.role,   // "employee"
  newValue: nextRole,        // "team_lead"
});
```

- **Actor defaults** to the signed-in user. `auth-context` calls
  `setCurrentActor()` on identity load, so emitters don't pass `who` — except
  pre-auth events (failed login) which override `actor`/`actorId`.
- **Best-effort & non-throwing.** `recordAudit` is wrapped so a logging failure
  can never break the action that triggered it (a login, a deletion, …).
- **Append-only & bounded.** Newest-first; the client keeps the last
  `MAX_EVENTS` (500). The real server store is unbounded and immutable.

---

## 4. Viewing

- **Route:** `/app/audit` — `src/routes/_authenticated/app/audit.tsx`.
- **Access:** owner / admin only, enforced declaratively by the route-guard
  system (`staticData: routeGuard({ roles: ["owner", "admin"] })`) — see
  [`ROUTE_GUARDS.md`](./ROUTE_GUARDS.md). A link appears in the sidebar's Team
  group (guarded on click, like Executive/Manager).
- **UI:** `src/features/audit/components/audit-log-view.tsx` — a table (When /
  Who / Action / Target / Change) with search + category + action filters.
  Sensitive actions (failed login, role/permission changes, deletions) render
  with a destructive badge; the Change column shows `old → new`.

---

## 5. Files

| File | Role |
| --- | --- |
| `src/features/audit/types.ts` | `AuditEvent`, `AuditAction`, category/label maps, sensitive-action set |
| `src/features/audit/audit-store.ts` | Reactive sink: `recordAudit`, `setCurrentActor`, `useAuditLog`, `filterAudit` |
| `src/features/audit/seed.ts` | Deterministic seed events |
| `src/features/audit/components/audit-log-view.tsx` | The viewer |
| `src/routes/_authenticated/app/audit.tsx` | Guarded route (owner/admin) |
| `src/features/audit/audit-store.test.ts` | Unit tests |

Emitters live at the action sites: `features/auth/auth-service.ts` &
`auth-context.tsx` (auth + actor), `features/hr/components/employee-*`
(role/create/delete), `features/projects/store.ts` (project retire),
`features/hr/invitations-store.ts` & `features/ai-settings/store.ts` (settings).

---

## 6. Going live (checklist)

- [ ] Append-only `audit_logs` table (immutable; INSERT-only RLS), columns
      mirroring `AuditEvent` incl. `ip inet` and `device text`.
- [ ] `AuditService` (`BaseService`, insert-only) + an `auditRepository`; point
      `recordAudit` at it (fire-and-forget, still non-throwing).
- [ ] Capture **IP** and **device** server-side (edge function / DB trigger from
      the request context) — the reserved columns become populated.
- [ ] Emit auth events from a Supabase auth hook / webhook rather than the
      client, so `login`/`logout`/`failed_login` are recorded authoritatively.
- [ ] Add retention + export (CSV) and a permission (`audit.read`) gating the
      viewer instead of the interim owner/admin role check.
