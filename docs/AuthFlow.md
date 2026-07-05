# Auth Flow

```text
                       ┌──────────────────────────┐
                       │ HR / Admin invites user  │
                       │  (Auth Admin API)        │
                       └──────────────┬───────────┘
                                      │ creates auth.users row
                                      ▼
                       ┌──────────────────────────┐
                       │ on_auth_user_created     │
                       │ trigger                  │
                       │  → profiles (invited)    │
                       │  → user_roles (employee) │
                       └──────────────┬───────────┘
                                      │ invite email
                                      ▼
                       ┌──────────────────────────┐
                       │ /auth/accept-invitation  │
                       │  - set full_name         │
                       │  - updateUser(password)  │
                       └──────────────┬───────────┘
                                      │ email_confirmed_at set
                                      ▼
                       ┌──────────────────────────┐
                       │ on_auth_user_confirmed   │
                       │ trigger                  │
                       │  → profiles.status=active│
                       └──────────────┬───────────┘
                                      │
                                      ▼
                                    /app  (gated)
```

## Sign-in
```text
/auth ── signInWithPassword ──► supabase.auth ──► session in localStorage
                                          │
                                          ▼
                     AuthProvider onAuthStateChange
                                          │
                                          ▼
                  fetchProfile() + fetchRoles()  (RLS-scoped)
                                          │
                                          ▼
                   navigate( ?redirect= ?? "/app" )
```

## Forgot / reset
```text
/auth/forgot-password
  ── resetPasswordForEmail(redirectTo=/auth/reset-password)
                                          │
                                          ▼
                        email link establishes recovery session
                                          │
                                          ▼
/auth/reset-password
  ── updateUser({ password })  ── signOut()  ── /auth
```
Failure to reveal account existence: `/auth/forgot-password` always shows the success screen even on `user_not_found`.

## Protected navigation
```text
visit /app/anything
   │
   ▼ TanStack beforeLoad on _authenticated layout (ssr:false)
   │
   ├── supabase.auth.getUser() success ─► render Outlet
   │
   └── no session ─► redirect("/auth", { redirect: href })
```

## Session expiry
- Background: `supabase-js` auto-refreshes the access token via the refresh token. Multi-tab is handled by `localStorage` events.
- On hard expiry (refresh token rejected): next navigation triggers `beforeLoad` → `redirect("/auth")`. Optional UX: surface `/auth/session-expired` first via an idle timer.

## Sign-out
```text
useAuth().signOut()
   │
   ├── supabase.auth.signOut()           // clears localStorage session
   ├── AuthProvider clears user/profile/roles
   └── navigate("/auth", replace:true)
```

## Threat model summary
| Threat                                   | Mitigation |
| ---------------------------------------- | ---------- |
| Public self-signup                       | `disable_signup=true` on the auth project. |
| Account enumeration via "forgot password"| Always show "check your inbox". |
| Privilege escalation through profile edit| Roles live in a separate table; `profiles` cannot grant access. |
| Compromised HR account assigning Owner   | Only Owner / Super Admin can write `user_roles`. |
| Password reuse / weak passwords          | Client `strongPasswordSchema` + HIBP server check. |
| Stolen reset link replay                 | Single-use, time-limited Supabase recovery token. |
| Open redirects post-login                | `redirect` search param consumed locally (TanStack types), no `window.location.href = ext_url`. |
| XSS                                      | No `dangerouslySetInnerHTML`; all rendered content escaped by React. |
