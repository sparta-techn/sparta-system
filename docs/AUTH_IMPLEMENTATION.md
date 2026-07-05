# SpartaFlow — Authentication Implementation

> The **Authentication module is the only module backed by a live backend.**
> Login, logout and session handling run against **Supabase Auth**. Every other
> feature (HR, Projects, Tasks, Sprints, Attendance UI data, Analytics, …) still
> reads its in-memory `mock-data.ts` and is **untouched**.

---

## 1. Scope

| Concern | Status |
| --- | --- |
| Login (email + password) | **Live** — Supabase Auth |
| Logout | **Live** — Supabase Auth |
| Session bootstrap & persistence | **Live** — Supabase Auth (`localStorage`) |
| Session refresh / expiry | **Live** — Supabase auto-refresh + `onAuthStateChange` |
| Route protection | **Live** — `getUser()` guard on `_authenticated` |
| Password reset / update | **Live** — Supabase Auth email flow |
| Profile & roles (RBAC) | **Live** reads from `profiles` / `user_roles` |
| All other feature data | **Mock** — unchanged `mock-data.ts` per feature |

**No UI was changed.** The login form, layouts, password screens and route tree
are exactly as they were; only the data path underneath them is real.

---

## 2. Pieces and how they connect

```
routes/auth/index.tsx        Login form  ──► signInWithPassword()
routes/_authenticated/route  Route guard ──► supabase.auth.getUser()
features/auth/auth-context   AuthProvider ─► onAuthStateChange + getSession
features/auth/auth-service   signIn / signOut / reset / updatePassword / profile / roles
        │
        ▼
integrations/supabase/client.ts   The single Supabase client (real)
        ▼
              Supabase Auth + Postgres (profiles, user_roles)
```

### `integrations/supabase/client.ts`
The real `@supabase/supabase-js` client (lazy, proxied singleton). Configured for
browser sessions:

```ts
auth: {
  storage: localStorage,   // session persists across reloads
  persistSession: true,
  autoRefreshToken: true,  // access tokens refreshed transparently
}
```

Reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env`). The
publishable key is the only key shipped to the client; no service key is exposed.

### `features/auth/auth-service.ts` — credential & identity calls
Thin, single-purpose wrappers over Supabase. This is where login/logout/session
verbs live:

| Function | Supabase call |
| --- | --- |
| `signInWithPassword(email, pw)` | `auth.signInWithPassword` |
| `signOut()` | `auth.signOut` |
| `requestPasswordReset(email)` | `auth.resetPasswordForEmail` (→ `/auth/reset-password`) |
| `updatePassword(pw, metadata?)` | `auth.updateUser` |
| `fetchProfile(userId)` | `from("profiles").select(...)` |
| `fetchRoles(userId)` | `from("user_roles").select("role")` |

### `features/auth/auth-context.tsx` — session state for the app
`AuthProvider` (mounted in `routes/__root.tsx`) owns the live session:

1. **Subscribe first, then read.** Registers `onAuthStateChange` before calling
   `getSession()`, so no transition is missed during bootstrap.
2. **Identity load.** When the user id actually changes, it loads
   `profile` + `roles` in parallel (deferred out of the auth callback to avoid
   the Supabase deadlock on re-entrant calls).
3. **SIGNED_OUT** clears profile/roles immediately.
4. Exposes `{ user, profile, roles, loading, initialized, isAuthenticated,
   hasRole, hasAnyRole, hasPermission, hasAnyPermission, refresh, signOut }` via
   `useAuth()`.

Permissions are derived from roles through `features/auth/permissions.ts`
(`permissionsForRoles`), giving RBAC checks to any component.

### Route protection — `routes/_authenticated/route.tsx`
A pathless layout guarding everything under `_authenticated/`. `beforeLoad` calls
`supabase.auth.getUser()`; on no user / error it redirects to `/auth` with the
intended `redirect` preserved. SSR is disabled here because the session lives in
`localStorage`.

### Server RPC token attachment — `integrations/supabase/auth-attacher.ts`
Registered as a global `functionMiddleware` in `src/start.ts`. Attaches the
current `access_token` as a bearer header to server-function RPCs so the session
flows through to the server side.

---

## 3. The three required flows

### Login
1. `routes/auth/index.tsx` validates input with `loginSchema` (Zod).
2. Calls `signInWithPassword(email, password)` → Supabase establishes a session
   and writes it to `localStorage`.
3. `onAuthStateChange` fires `SIGNED_IN`; `AuthProvider` loads profile + roles.
4. The form's `useEffect` sees `isAuthenticated` and navigates to
   `redirect ?? "/app"`. Errors are surfaced via `mapAuthError`.

### Logout
1. Any consumer calls `useAuth().signOut()`.
2. That calls `auth-service.signOut()` → `supabase.auth.signOut()`, clearing the
   stored session, then resets local `user/profile/roles`.
3. `onAuthStateChange` fires `SIGNED_OUT`; the guard redirects subsequent
   protected navigations back to `/auth`.

### Session handling
- **Bootstrap:** `getSession()` on app start restores an existing session.
- **Persistence:** `persistSession + localStorage` survives reloads.
- **Refresh:** `autoRefreshToken` renews access tokens silently.
- **Expiry / invalid:** the `_authenticated` guard's `getUser()` check redirects
  to `/auth` (the `?reason=expired` and `session-expired` screens already exist
  in the UI and are unchanged).

---

## 4. What was explicitly NOT touched

- **No UI changes.** Forms, layouts (`app-shell`, `topbar`, `app-sidebar`),
  password and session screens are unchanged.
- **No other feature modified.** All `features/*/mock-data.ts` remain the data
  source for HR, Projects, Tasks, Sprints, Dependencies, Analytics, EOD, Midday,
  Notifications, Time-tracking, etc.
- **No new state library, no new keys exposed.**

---

## 5. Configuration

`.env` must define (already present):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Backend expectations (Supabase project):
- Email/password auth enabled.
- `profiles` row per user (`id` = auth user id) and a `user_roles` table
  (`user_id`, `role`) for RBAC — both protected by RLS.
- Redirect URL `/<origin>/auth/reset-password` allow-listed for recovery emails.

---

## 6. Verification

- `npx tsc --noEmit` — no auth / supabase type errors.
- No `mock`, `fake`, `stub`, or hardcoded-credential references remain anywhere
  under `features/auth`, `integrations/supabase`, or `lib/supabase`.
- The login form, route guard, and `AuthProvider` all reference the real
  `supabase` client — there is no bypass path.
