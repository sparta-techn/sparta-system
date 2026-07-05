# SpartaFlow — Admin Console

> A single **owner-only** console that composes the platform's administrative
> surfaces — Users, Roles, Permissions, Departments, Teams, Invitations, Audit
> Logs — and adds three platform controls: **System Settings**, **Feature
> Flags**, and **Maintenance Mode**. It reuses existing feature components (no UI
> redesign) behind one section switcher styled like the HR/Analytics subnav.

---

## 1. Access

- **Route:** `/app/admin` — `src/routes/_authenticated/app/admin.tsx`.
- **Owner only**, enforced declaratively by the route-guard system:
  `staticData: routeGuard({ roles: ["owner"] })`. Non-owners are redirected to
  `/unauthorized`. See [`ROUTE_GUARDS.md`](./ROUTE_GUARDS.md).
- A sidebar link ("Admin Console") appears in the Team group (guarded on click,
  like Executive/Manager).

---

## 2. Sections

The console (`src/features/admin/components/admin-console.tsx`) switches between
sections client-side (no nested routes). Each reuses an existing surface or a
thin admin panel:

| Section | Component | Source |
| --- | --- | --- |
| Overview | `AdminOverview` | New — KPI tiles (users, pending invites, depts, teams, flags, audit count) + maintenance status |
| Users | `EmployeeDirectory` | Reused — `features/hr` (create/edit/lifecycle, see [`EMPLOYEE_MANAGEMENT.md`](./EMPLOYEE_MANAGEMENT.md)) |
| Roles | `RolesPanel` | New — enterprise roles, rank, permission counts (`ROLE_PERMISSIONS`) |
| Permissions | `PermissionsPanel` | New — read-only role × permission matrix from `PERMISSION_CATALOG` |
| Departments | `DepartmentsPanel` | New — read-only, from `hrQueries` |
| Teams | `TeamsPanel` | New — read-only, from `hrQueries` |
| Invitations | `InvitationsManager` | Reused — `features/hr` (see [`INVITATIONS.md`](./INVITATIONS.md)) |
| Audit logs | `AuditLogView` | Reused — `features/audit` (see [`AUDIT_LOGS.md`](./AUDIT_LOGS.md)) |
| System settings | `SystemSettingsPanel` | New — see §3 |
| Feature flags | `FeatureFlagsPanel` | New — see §4 |
| Maintenance | `MaintenancePanel` | New — see §5 |

Roles / Permissions / Departments / Teams are **read-only** here — they mirror
the RBAC catalog and HR data. Editing lives in the HR workspace and the RBAC
source of truth (`features/auth/permissions.ts`).

---

## 3. System Settings

`SystemSettings` (company name, support email, default timezone, session-timeout
minutes, allow-signups, enforce-2FA). Edited in the panel; saved via
`updateSettings()`. **Every changed field records a `settings_changed` audit
event** with its old→new value.

## 4. Feature Flags

A keyed list of `FeatureFlag`s (label, description, `enabled`). `setFeatureFlag`
toggles one and audits the change. Read them anywhere with
`isFeatureEnabled(key)` (unknown keys default to enabled) to gate a feature.
Defaults: `ai_assistant`, `sprint_planning`, `time_tracking`, `integrations`,
`executive_dashboard`, `kanban_v2` (off).

## 5. Maintenance Mode

`MaintenanceState` (`enabled`, `message`, `startedAt`, `plannedEndAt`).
`setMaintenance()` toggles it, stamps `startedAt`, and audits. When enabled, a
**`MaintenanceBanner`** renders app-wide in the `AppShell` above page content,
showing the message (and planned end, if set).

---

## 6. Store

`src/features/admin/system-store.ts` — one `useSyncExternalStore` +
`localStorage` store (key `spartaflow:admin:system:v1`) backing all three
platform controls. Same pattern as the other feature stores; mirrors a future
`system_settings` / `feature_flags` Supabase surface.

- **Reads / hooks:** `useSystemSettings`, `useFeatureFlags`, `useMaintenance`,
  `isFeatureEnabled`, and non-hook getters for the banner.
- **Writes (all audit):** `updateSettings`, `setFeatureFlag`, `setMaintenance`.
- `__resetSystem()` — test/support helper.

Because every write funnels through `recordAudit`, platform changes show up in
the Audit Logs section automatically.

---

## 7. Files

| File | Role |
| --- | --- |
| `src/routes/_authenticated/app/admin.tsx` | Owner-guarded route |
| `src/features/admin/components/admin-console.tsx` | Section switcher + composition |
| `src/features/admin/components/admin-overview.tsx` | Overview tiles |
| `src/features/admin/components/roles-panel.tsx` · `permissions-panel.tsx` | RBAC views |
| `src/features/admin/components/departments-panel.tsx` · `teams-panel.tsx` | Org views |
| `src/features/admin/components/system-settings-panel.tsx` · `feature-flags-panel.tsx` · `maintenance-panel.tsx` | Platform controls |
| `src/features/admin/components/maintenance-banner.tsx` | App-wide banner (AppShell) |
| `src/features/admin/system-store.ts` · `types.ts` | Store + types |
| `src/features/admin/system-store.test.ts` | Unit tests |

---

## 8. Going live (checklist)

- [ ] `system_settings` (singleton row) and `feature_flags` tables, owner-write
      RLS; point the store's reads/writes at an `AdminService` / repository.
- [ ] Gate the route on a dedicated `settings.manage` / owner check server-side,
      not just the client guard.
- [ ] Make Roles/Permissions **editable** (write `role_permissions`) behind
      `permissions.manage`; the matrix view is already the read model.
- [ ] Enforce Feature Flags and Maintenance Mode server-side (middleware / RLS)
      so they gate real access, not just the UI.
- [ ] Surface Maintenance Mode to unauthenticated visitors (login screen banner)
      in addition to the in-app banner.
