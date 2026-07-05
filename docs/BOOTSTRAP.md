# Bootstrap

_As-built. Last updated: 2026-07-02._

The **bootstrap** is the one-time provisioning that turns an empty SpartaFlow
database into a usable platform. It creates the first owner, the company, a
default workspace, default departments, and the default roles / permissions
matrix — then **disables public self-registration** so the platform becomes
invite-only.

It is **idempotent**: running it against an already-bootstrapped database makes
no changes.

---

## What it creates

When the database has not yet been bootstrapped, `runBootstrap` provisions:

| # | Resource            | Where it lands                                   |
|---|---------------------|--------------------------------------------------|
| 1 | **Owner account**   | `auth.users` + `public.profiles` + `public.user_roles` (`owner`) |
| 2 | **Company**         | `public.companies` (identity: name, slug, timezone, primary owner) |
| 3 | **Default workspace** | `public.workspaces` (`is_default = true`, linked to the company) |
| 4 | **Default departments** | `public.departments` (Engineering, Product, Design, Operations, People, Marketing, Sales, Finance) |
| 5 | **Default roles**   | the `public.app_role` enum values (owner → viewer) |
| 6 | **Default permissions** | `public.permissions` catalog + `public.role_permissions` matrix |

Then it flips the platform singleton `public.system_settings`:

- `is_bootstrapped = true`
- `public_registration_enabled = false` (unless you opt out — see below)
- `company_id`, `bootstrapped_at`, `bootstrapped_by` are recorded.

The run is written to the audit log as `platform.bootstrap`.

---

## Prerequisites

1. **Apply the migrations** (in `supabase/migrations/`), including
   `20260702120000_bootstrap_org_registration.sql`, which creates the
   `companies`, `workspaces`, and `system_settings` tables and the registration
   gate. Bootstrap will fail if these tables don't exist yet.
2. **Service-role credentials** in the environment (never in the browser
   bundle):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

   Bootstrap creates auth users and writes rows that RLS deliberately forbids
   from an unauthenticated context, so it must run server-side with the service
   role.

---

## Running it

Bootstrap is exposed as a CLI (bun auto-loads `.env`):

```bash
# Provision the platform
OWNER_EMAIL="owner@yourco.com" \
OWNER_PASSWORD="a-strong-password" \
OWNER_NAME="Ada Lovelace" \
COMPANY_NAME="Your Co" \
bun run bootstrap

# Inspect current state without changing anything
bun run bootstrap:status
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service-role key (RLS bypass, server-only) |
| `OWNER_EMAIL` | ✅ | — | Initial owner's email (auto-confirmed) |
| `OWNER_PASSWORD` | ✅ | — | Initial owner's password |
| `OWNER_NAME` | — | local-part of email | Owner display / full name |
| `COMPANY_NAME` | — | `SpartaFlow` | Company name |
| `COMPANY_SLUG` | — | slug of company name | Company slug (unique) |
| `COMPANY_TIMEZONE` | — | `Africa/Cairo` | Company timezone |
| `WORKSPACE_NAME` | — | `General` | Default workspace name |
| `WORKSPACE_SLUG` | — | `<company>-<workspace>` | Default workspace slug (unique) |
| `BOOTSTRAP_KEEP_PUBLIC_REGISTRATION` | — | unset | Set to `true` to leave public signup **enabled** after bootstrap |

---

## Disabling public registration

After bootstrap, `system_settings.public_registration_enabled` is set to
`false`. This is enforced **at the database layer**, not just the UI:

- `public.handle_new_user()` (the `auth.users` insert trigger) raises
  `insufficient_privilege` when the platform is bootstrapped, public
  registration is disabled, and the new user was **not** created via an admin
  invite (`auth.users.invited_at IS NULL`).
- Admin invites (`supabase.auth.admin.inviteUserByEmail`) set `invited_at`
  server-side, so invited users always pass the gate.
- The same trigger was hardened so a self-signup can **never** self-assign a
  role via `user_metadata.role`; an invited `role` is only honored when the row
  was created by an admin invite.

To re-open public registration later (programmatically):

```ts
import { systemSettingsService } from "@/services";
await systemSettingsService.setPublicRegistration(true);
```

> **Platform-level complement:** you may additionally disable signups in the
> Supabase dashboard / `config.toml` (`[auth] enable_signup = false`). The
> application-level gate above is the authoritative control within SpartaFlow
> and works regardless of that setting.

---

## How it's wired (code map)

| Layer | File | Role |
|---|---|---|
| Migration | `supabase/migrations/20260702120000_bootstrap_org_registration.sql` | Creates `companies`, `workspaces`, `system_settings`; status helpers `is_bootstrapped()` / `public_registration_enabled()`; hardens `handle_new_user()` |
| Orchestrator (server-only) | `src/repositories/bootstrap/bootstrap.server.ts` | `runBootstrap()` and `getBootstrapStatus()`, using the service-role admin client |
| Seed constants | `src/repositories/bootstrap/constants.ts` | Default departments, permissions, role→permission matrix, roles |
| Contracts | `src/repositories/bootstrap/types.ts` | `BootstrapInput`, `BootstrapStatus`, `BootstrapResult` |
| Services | `src/services/organization/` | `companiesService`, `workspacesService`, `systemSettingsService` (the app-facing read/write API over the new tables) |
| CLI | `scripts/bootstrap.ts` (`bun run bootstrap`) | Operator entrypoint |

`bootstrap.server.ts` is **server-only** and must be imported explicitly from a
server entrypoint — it is intentionally not re-exported from
`src/repositories/bootstrap/index.ts`, which stays safe for client imports
(types + constants only).

---

## Idempotency & recovery

- `getBootstrapStatus()` is checked first; a bootstrapped platform is a no-op.
- Every seed write is an upsert on a natural key (owner by email, departments by
  `slug`, permissions by `key`, the role matrix by `(role, permission_id)`), and
  the company / default workspace are looked up before insert. A partial failure
  (which leaves `is_bootstrapped = false`) can therefore be recovered simply by
  re-running the command.
