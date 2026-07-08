# Authentication

SpartaFlow Hub is an **invite-only internal platform**. There is no public signup form. Identity is provisioned by HR or an administrator; the employee accepts an invitation, sets a password, verifies their email, and lands on the app.

## Stack

- **Supabase Auth** (email + password). MFA, Google Workspace SSO, and Microsoft Entra ID are deferred.
- **TanStack Start** (TanStack Router + React Start) on Vite. The repo is TanStack Start, not Next.js — every Supabase Auth call is identical to the Next.js flow.
- **React Hook Form + Zod** for client validation.
- **TanStack Query** is wired at the root for downstream data fetching.

## Server config (Supabase)

- `disable_signup = true` — `supabase.auth.signUp()` returns an error. Accounts can only be created by an admin via the Auth Admin API (e.g. `auth.admin.inviteUserByEmail`).
- `auto_confirm_email = false` — confirmation is required before profile flips to `active`.
- `password_hibp_enabled = true` — passwords are checked against Have-I-Been-Pwned.

## Routes (frontend)

| Route                     | Public | Purpose                                                                                                                              |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `/`                       | yes    | Marketing-style landing → sign-in (auto-redirects signed-in users to `/app`).                                                        |
| `/auth`                   | yes    | Email + password sign-in. Accepts `?redirect=` and `?reason=expired                                                                  | unauthorized`. |
| `/auth/forgot-password`   | yes    | Request a reset link. Always shows the "check your inbox" state — does not reveal whether the account exists.                        |
| `/auth/reset-password`    | yes    | Recovery session lands here. Sets new password, signs the user out, and routes them back to sign-in.                                 |
| `/auth/accept-invitation` | yes    | Invitation link lands here. Sets `full_name`, password, and activates the account.                                                   |
| `/auth/verify-email`      | yes    | Shows whether the current user's email is verified.                                                                                  |
| `/auth/session-expired`   | yes    | "Sign in again" landing surface.                                                                                                     |
| `/unauthorized`           | yes    | Permission denial screen.                                                                                                            |
| `/_authenticated/*`       | no     | Pathless layout. Server-side `ssr: false` + client `beforeLoad` calls `supabase.auth.getUser()` and redirects to `/auth` if missing. |
| `/_authenticated/app`     | no     | First protected page — shows identity, profile, roles.                                                                               |

## Frontend modules

```
src/features/auth/
  types.ts                          # AppRole, Profile, AuthState, ROLE_LABELS, ROLE_RANK
  permissions.ts                    # role → permission matrix (UI gates only)
  validation.ts                     # Zod schemas + passwordStrength helper
  errors.ts                         # mapAuthError() — friendly, non-leaky messages
  auth-service.ts                   # supabase auth wrappers (signIn, signOut, reset, etc.)
  auth-context.tsx                  # <AuthProvider> + useAuth() hook
  components/
    auth-layout.tsx                 # branded two-pane layout for auth pages
    password-strength.tsx           # live strength meter
```

`AuthProvider` is mounted once in `src/routes/__root.tsx` inside the QueryClientProvider and ThemeProvider.

## Lifecycle

```text
ADMIN invite ──► auth.users row (status=invited)
        │            │
        │            ▼
        │     handle_new_user trigger
        │            │
        │            ▼
        │     profiles row created (status=invited)
        │            │
        │            ▼
EMPLOYEE clicks invite email
        │            │
        │            ▼
        │     /auth/accept-invitation
        │     - sets full_name (user_metadata)
        │     - updateUser({ password })
        │            │
        │            ▼
        │     Supabase marks email_confirmed_at
        │            │
        │            ▼
        │     handle_user_email_confirmed trigger
        │     → profiles.status = active
        │            │
        │            ▼
        │     /app  (protected layout grants access)
```

## Session management

- The browser client stores the session in `localStorage` and auto-refreshes the access token. Tabs share state automatically because `localStorage` writes raise `storage` events that the Supabase JS client listens for.
- `AuthProvider` subscribes once via `supabase.auth.onAuthStateChange` and only refetches the profile/roles when the user **id** changes — not on every `TOKEN_REFRESHED` tick.
- A user-triggered sign-out clears `user`, `profile`, and `roles` in the provider and then navigates to `/auth`.
- A session that expires while the user is on a protected route triggers the `_authenticated` `beforeLoad` redirect to `/auth?reason=expired` on the next navigation.

## Error handling

`mapAuthError()` converts Supabase / network errors into user-facing copy and avoids revealing account existence on `forgot-password`. Toasts use `sonner`; inline form errors use the `Alert` component.

## Security checklist

- ✅ No client-side admin operations. Invitations require service-role and are admin-only.
- ✅ Roles live in `public.user_roles`, never on `profiles` — privilege-escalation safe.
- ✅ Every public-schema table has `GRANT` + `ENABLE RLS` + scoped policies in the same migration.
- ✅ `SECURITY DEFINER` helpers (`has_role`, `has_any_role`) are `REVOKE`d from `anon`/`authenticated`; they remain usable from inside RLS policies because policy evaluation runs as the function definer.
- ✅ `password_hibp_enabled = true` blocks pwned passwords; client-side `strongPasswordSchema` rejects weak ones up front.
- ✅ Auth pages set `robots: noindex,nofollow`.
- ✅ Tokens stay in `localStorage` (managed by `supabase-js`); we never write secrets to `localStorage` ourselves.
- ✅ XSS: no `dangerouslySetInnerHTML`; all user input is rendered as text.

## Future

- MFA (TOTP) — Supabase supports it natively; only Owner / Super Admin / HR should be forced into enrollment.
- Google Workspace + Microsoft Entra ID SSO via `lovable.auth.signInWithOAuth("google" | "azure")`.
- Hard session timeout enforced by a client-side idle timer (sign out + redirect to `/auth/session-expired`).
