# Routing Architecture — SpartaFlow Hub

Routes are organized into **public**, **authenticated**, and **role-gated** groups. Access is enforced at three layers: Next.js middleware, route segment guards, and Supabase RLS. UI hiding is never the only protection.

---

## Route Groups

```text
/                              → redirect (signed-in → /dashboard, else /auth/sign-in)
/auth/*                        → public
/(app)/*                       → authenticated
/(app)/hr/*                    → HR + Owner + Super Admin
/(app)/admin/*                 → Super Admin + Owner
/(app)/owner/*                 → Owner
/api/webhooks/*                → public, signature-verified
/api/internal/*                → server-to-server only
```

---

## Public Routes

| Path | Purpose |
|---|---|
| `/auth/sign-in` | Email/password + Google SSO. |
| `/auth/sign-up` | Optional; usually invite-only. |
| `/auth/forgot-password` | Send reset email. |
| `/auth/reset-password` | Set new password from email link. |
| `/auth/mfa` | MFA challenge step. |
| `/auth/callback` | OAuth callback. |
| `/legal/privacy`, `/legal/terms` | Static. |
| `/health` | Health check (no auth). |

Guard: must be signed-out **or** session-incomplete (MFA pending). Signed-in users are redirected to `/dashboard`.

---

## Authenticated Routes (All Roles)

| Path | Purpose |
|---|---|
| `/dashboard` | Personal landing. |
| `/attendance` | Today's attendance + history. |
| `/workflow/morning` | Morning check-in. |
| `/workflow/midday` | Midday status. |
| `/workflow/end-of-day` | EOD report. |
| `/dependencies` | My dependencies (incoming + outgoing). |
| `/dependencies/[id]` | Detail. |
| `/announcements` | List + detail. |
| `/notifications` | Notification center. |
| `/directory` | Employee directory. |
| `/directory/[userId]` | Employee profile. |
| `/leaves` | My leaves. |
| `/settings/*` | Profile, preferences, MFA, sessions. |

Guard: authenticated session, MFA satisfied if required.

---

## Manager Routes (Team Lead, PM)

| Path | Roles |
|---|---|
| `/team/[teamId]` | Team Lead of that team, PM, HR, Owner. |
| `/team/[teamId]/dependencies` | same |
| `/team/[teamId]/reports` | same |
| `/department/[deptId]` | PM, HR, Owner |
| `/department/[deptId]/board` | same |
| `/reports/projects/[projectId]` | PM of project, Owner |

Guard: `hasRole('team_lead'|'pm') AND scopeMatches(teamId|deptId|projectId)`.

---

## HR Routes

| Path |
|---|
| `/hr/overview` |
| `/hr/attendance` |
| `/hr/leaves` |
| `/hr/announcements` |
| `/hr/onboarding` |
| `/hr/directory` |
| `/hr/exports` |

Guard: `hasAnyRole(['hr','owner','super_admin'])`.

---

## Owner Routes

| Path |
|---|
| `/owner/health` |
| `/owner/departments` |
| `/owner/risks` |
| `/owner/digest` |

Guard: `hasRole('owner')`.

---

## Admin Routes

| Path |
|---|
| `/admin/organization` |
| `/admin/departments` |
| `/admin/teams` |
| `/admin/roles` |
| `/admin/working-rules` |
| `/admin/feature-flags` |
| `/admin/integrations` |
| `/admin/audit-logs` |

Guard: `hasAnyRole(['super_admin','owner'])`.

---

## API Routes

| Path | Auth |
|---|---|
| `/api/webhooks/clickup` | HMAC signature. |
| `/api/webhooks/github` | HMAC signature. |
| `/api/webhooks/slack` | Slack signing secret. |
| `/api/internal/notify-dispatch` | Service token (Edge Function caller). |
| `/api/internal/reports-rollup` | Service token. |
| `/api/health` | Public. |

---

## Guard Architecture

Three enforcement layers, all must pass:

1. **Next.js Middleware** (`middleware.ts`)
   - Validates Supabase session cookie.
   - Resolves role + scopes from JWT claims.
   - Redirects unauthenticated users to `/auth/sign-in?next=...`.
   - Rejects routes outside the user's role matrix with `403`.

2. **Route Segment Guards** (per layout)
   - `(app)/layout.tsx` — requires session, loads profile + permissions into context.
   - `(app)/hr/layout.tsx`, `(app)/owner/layout.tsx`, `(app)/admin/layout.tsx` — assert role.
   - Dynamic segments (`/team/[teamId]`) call a server helper `assertCanAccessTeam(teamId)` that checks scope.

3. **RLS Policies** — the last line of defense; even a bypassed UI cannot read another team's data.

---

## Redirect & Deep-Link Rules

- Unauthenticated visit → `/auth/sign-in?next=<path>`. After sign-in, redirect to `next` (sanitized to same-origin paths only).
- MFA pending → `/auth/mfa?next=<path>`.
- Insufficient role → `/403` with a "Request access" CTA (creates a request to HR/Admin).
- Soft-deleted user → forced sign-out + `/auth/sign-in?reason=account_disabled`.

---

## Route Map Source of Truth

A single typed `routeMap` lives in `shared/config/routes.ts` and is used by:
- Sidebar / Topbar navigation.
- Breadcrumbs.
- RBAC matrix (`role → routes`).
- E2E test selectors.

Hard-coded paths in components are forbidden by ESLint.
