# Employee Management

Covers the full employee lifecycle: invite → onboard → manage → offboard → archive.

## Directory (`/app/hr/employees`)
- Search by name, email, or job title.
- Filters: department, employment status.
- Saved filters: All employees, Active engineers, On leave, Recently invited.
- Sort: name, department, joined date.
- Pagination: 10 per page.
- Row action menu: Open profile · Change department · Assign manager · Assign role · Reset password · Deactivate / Reactivate.
- Primary CTA: **Invite** — opens `InviteEmployeeDialog` (email + department + role).

## Profile (`/app/hr/employees/$id`)
Tabbed surface with 10 tabs:

| Tab | Purpose |
|---|---|
| Overview | Employment, reporting line, direct reports |
| Attendance | 30-day issue list |
| Work sessions | Placeholder for future integration |
| Reports | Placeholder for check-in / midday / EOD history |
| Dependencies | Placeholder for cross-team blockers |
| Leave | Balances + request history |
| Documents | Contracts, NDAs, certificates with upload |
| Activity | Audit timeline scoped to this employee |
| Permissions | Current role + capability summary |
| Devices | Active browser/device sessions |

Header actions are always visible: Change department, Assign manager, Reset password, Deactivate / Reactivate.

## Invitations (`/app/hr/invitations`)
Four tabs: Pending, Accepted, Expired, Cancelled. Row actions:
- **Resend** — available on Pending and Expired.
- **Cancel** — available on Pending.
- `InvitationStatusBadge` provides consistent semantic colouring.

## Audit (`/app/hr/audit`)
Read-only log of management actions filtered by category (employee, role, department, invitation, leave, document). Searches across actor, target, and details.

## Reusable primitives
- `EmployeeAvatar` — initials avatar with HSL gradient seeded by `avatarHue`.
- `EmploymentStatusBadge`, `RoleBadge`, `LeaveStatusBadge`, `LeaveTypeBadge`, `InvitationStatusBadge` — colour-mapped tokens for the entire module.
- `EmptyState` — used for all "no data" surfaces.

## Backend integration points
All read paths today resolve to `src/features/hr/mock-data.ts`. When wiring Supabase:
- Replace `employees`, `invitations`, `leaveRequests`, `documents`, `auditLog` with query hooks.
- The component interfaces (`HrEmployee`, `HrInvitation`, etc.) match the planned database columns so swap-in is one import change per surface.
- All mutating actions currently call `toast.*` placeholders; replace with `useMutation` + supabase RPC.
