# SpartaFlow — Invitation System

> Onboards new members: an **Owner / Admin / HR** creates an employee and sends
> an invitation; the invitee opens a secure link, sets a password, completes
> their profile and accepts the company policies.
>
> The **admin side** (create / send / resend / cancel, configurable expiry) is
> **mock-backed** — a localStorage-backed reactive store that mirrors the future
> Supabase repository surface. The **invitee's accept flow** runs against the
> **live Supabase Auth** session (it's part of the one live module — see
> [`AUTH_IMPLEMENTATION.md`](./AUTH_IMPLEMENTATION.md)).

---

## 1. Scope

| Capability                        | Actor              | Status                                      |
| --------------------------------- | ------------------ | ------------------------------------------- |
| Create Employee + Send Invitation | Owner / Admin / HR | **Mock** — `invitations-store`              |
| Resend Invitation                 | Owner / Admin / HR | **Mock** — refreshes window + token         |
| Cancel Invitation                 | Owner / Admin / HR | **Mock** — revokes the link                 |
| Configurable expiry period        | Owner / Admin / HR | **Mock** — default + per-invite override    |
| Auto-expire after the window      | System             | **Derived** at read time — no cron          |
| Receive email with setup link     | Invitee            | Delivered by Supabase Auth invite email     |
| Set password                      | Invitee            | **Live** — Supabase `updateUser`            |
| Complete profile                  | Invitee            | **Live** — name + job title → user metadata |
| Accept company policies           | Invitee            | **Live** — required checkbox → metadata     |

---

## 2. Lifecycle

```
                 ┌──────────────────────────────────────────────┐
                 │            Owner / Admin / HR                 │
                 └──────────────────────────────────────────────┘
   createInvitation()          resendInvitation()      cancelInvitation()
         │                            │                       │
         ▼                            ▼                       ▼
     ┌────────┐   window elapses  ┌─────────┐            ┌───────────┐
     │pending │ ────────────────► │ expired │            │ cancelled │
     └────────┘                   └─────────┘            └───────────┘
         │  ▲                          │
         │  └───── resend ─────────────┘
         │
         │  invitee completes setup  (acceptInvitation)
         ▼
     ┌──────────┐
     │ accepted │
     └──────────┘
```

- **`pending → expired`** is _derived_, not stored. `effectiveStatus()` reports
  a pending invite as `expired` once `expiresAt` is in the past, so no
  background job is needed. `resendInvitation` sets a fresh window and returns
  it to `pending`.
- **`cancel`** and **`accept`** are terminal writes to the stored status.
- **Resend** mints a **new token**, invalidating the previous link.

---

## 3. Data model

`HrInvitation` (`src/features/hr/mock-data.ts`) — shaped to mirror a future
Supabase `invitations` table:

| Field         | Type               | Notes                                               |
| ------------- | ------------------ | --------------------------------------------------- |
| `id`          | `string`           | `inv_…`                                             |
| `email`       | `string`           | Normalised to lower-case on create                  |
| `name?`       | `string`           | Prefilled name, captured at "Create Employee" time  |
| `role`        | `EmployeeRole`     | `employee` \| `team_lead` \| `manager` \| `hr` \| … |
| `department`  | `Department`       |                                                     |
| `invitedBy`   | `string`           | Actor who sent it                                   |
| `invitedAt`   | ISO string         | (Re)send timestamp                                  |
| `expiresAt`   | ISO string         | `invitedAt + expiryDays`                            |
| `status`      | `InvitationStatus` | `pending` \| `accepted` \| `expired` \| `cancelled` |
| `token?`      | `string`           | Opaque token in the setup link; rotated on resend   |
| `resentAt?`   | ISO string         | Last resend                                         |
| `acceptedAt?` | ISO string         | Set when the invitee completes setup                |

`InvitationSettings` — `{ expiryDays: number }`. The configurable default,
persisted in the store. Selectable windows: **`EXPIRY_OPTIONS = [3, 7, 14, 30]`**
days.

---

## 4. Store API

`src/features/hr/invitations-store.ts` — a `useSyncExternalStore` +
`localStorage` reactive facade (same pattern as `features/tasks/store.ts`).
Persistence key: `spartaflow:hr:invitations:v1`.

**Reads**

- `listInvitations()` — all, newest first, with expiry derived.
- `groupInvitations()` — bucketed by derived status (the manager's tabs).
- `getInvitation(id)`, `getSettings()`, `effectiveStatus(inv, now?)`.
- Hooks: `useInvitations()`, `useInvitationSettings()`.

**Writes**

- `createInvitation({ email, name?, role, department, expiryDays?, invitedBy? })`
  — creates the employee + invitation; `expiryDays` overrides the default.
- `resendInvitation(id)` — new window (current default) + new token → `pending`.
- `cancelInvitation(id)` — → `cancelled`.
- `acceptInvitation(id)` — → `accepted` (no-op unless currently pending).
- `updateSettings({ expiryDays })` — change the default window.
- `__resetInvitations()` — test/support helper; restores seeds.

> When persistence lands, replace the store internals with repository/service
> calls (`src/repositories` → `src/services`) per the architecture rules; the
> components below do not change.

---

## 5. UI

| Surface                                                            | File                                                    | Route                     |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------- |
| Invitations manager (tabs, resend, cancel, default-expiry control) | `src/features/hr/components/invitations-manager.tsx`    | `/app/hr/invitations`     |
| Invite dialog (name, email, department, role, per-invite expiry)   | `src/features/hr/components/invite-employee-dialog.tsx` | —                         |
| Status / role badges                                               | `src/features/hr/components/badges.tsx`                 | —                         |
| Invitee accept page                                                | `src/routes/auth/accept-invitation.tsx`                 | `/auth/accept-invitation` |

All UI reuses the shared primitives (`Button`, `Card`, `Dialog`, `Table`,
`Tabs`, `Select`, `Checkbox`, `Badge`) per the UI rules — no new components.

**Admin actions**

- **Invite employee** → dialog → `createInvitation`.
- **Resend** (on `pending`/`expired` rows) → `resendInvitation`.
- **Cancel** (on `pending` rows) → `cancelInvitation`.
- **Expire after** select in the header → `updateSettings` (default window).

**Invitee accept flow** (`/auth/accept-invitation`)

1. Route validates the Supabase session from the invite link; an invalid or
   expired link shows the "Invitation invalid" state.
2. **Set password** — `strongPasswordSchema` + strength meter.
3. **Complete profile** — full name (prefilled from invite metadata) and an
   optional job title.
4. **Accept company policies** — a **required** checkbox (Terms, Privacy, Code
   of Conduct); enforced by `acceptInvitationSchema.acceptPolicies`.
5. On submit, `updatePassword(password, { full_name, job_title?,
policies_accepted, policies_accepted_at })` writes the password and profile /
   consent to the auth user's metadata, then redirects to `/app`.

Validation lives in `src/features/auth/validation.ts` (`acceptInvitationSchema`).

---

## 6. Security notes

- **RBAC** — creating and managing invitations is an Owner / Admin / HR action;
  gate the manager route with the existing role guards when wiring the live
  backend.
- **Token rotation** — resending mints a fresh token so old links stop working;
  cancelling revokes access before acceptance.
- **Policy consent** — acceptance is required and timestamped
  (`policies_accepted_at`) for audit.
- **Audit** — invitation events map to the `invitation` audit category
  (`HrAuditEvent`); emit audit entries from the repository layer once live.

---

## 7. Going live (checklist)

- [ ] `invitations` table (+ RLS) mirroring `HrInvitation`; UUID ids.
- [ ] Repository `invitationRepository` over an `InvitationsService`
      (`BaseService`) for create / resend / cancel / accept.
- [ ] Edge function to send the Supabase Auth invite email on create/resend.
- [ ] Sync the accepted metadata (`full_name`, `job_title`,
      `policies_accepted_at`) into the `profiles` / `employee_profiles` rows and
      flip the employee `status` from `invited` → `active`.
- [ ] Emit audit events (`invitation` category) from the repository.
- [ ] Swap `invitations-store` reads for `hrQueries`-style `queryOptions`.
