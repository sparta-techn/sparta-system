# Security Architecture — SpartaFlow Hub

Security is built in at every layer. The architecture assumes **zero trust** between layers — RLS is the last line of defense, not the only one.

---

## 1. Authentication

- Supabase Auth: Email/Password + Google SSO.
- Passwords hashed by Supabase (bcrypt). Minimum length 12, leaked-password (HIBP) check enabled.
- MFA (TOTP) available to all; **required** for Owner, HR, Super Admin.
- Session: httpOnly, Secure, SameSite=Lax cookie set by Supabase server client; **no JWTs in `localStorage`** for protected access.
- Server validates the session on every request with `supabase.auth.getUser()`, which re-validates with Auth (not just `getSession()`).
- Sign-in lockout after N failed attempts (Supabase rate-limit).

---

## 2. Authorization

- **Roles:** stored in `user_roles` (never on `profiles`). See `RBAC.md`.
- **Permissions:** checked at three layers: middleware, server handler, RLS.
- `assertPermission(ctx, code)` helper at the top of every server action.
- Sensitive actions require re-authentication (re-enter password) — role assignment, integration token rotation, leave overrides.

---

## 3. Session Management

- Default session lifetime: 12 h idle, sliding refresh.
- Forced sign-out on: role change, password change, suspicious IP change, manual revoke from `/settings/sessions`.
- A `sessions` table tracks active sessions for UI; revoking deletes the underlying Supabase refresh token.

---

## 4. CSRF

- Server actions and API routes verify the `Origin` header against an allow-list.
- Cookies use `SameSite=Lax` (Strict for sign-in cookie).
- Mutations require either a same-origin request or a signed Bearer header.
- Webhooks bypass CSRF but require signature verification (HMAC).

---

## 5. XSS

- React escapes by default; `dangerouslySetInnerHTML` is forbidden by ESLint outside an allow-listed `<SafeRichText>` component.
- `<SafeRichText>` sanitizes via `DOMPurify` with a strict allow-list (announcements, reports).
- Content Security Policy (CSP) set via middleware:
  - `default-src 'self'`
  - `img-src 'self' data: https://*.supabase.co https://lh3.googleusercontent.com`
  - `script-src 'self' 'nonce-<random>'`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co`
- `nonce`-based script tags; no `unsafe-inline`.
- HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin.

---

## 6. SQL Injection

- All DB access goes through the Supabase client (parameterized).
- No string concatenation into SQL anywhere. Raw SQL only in migrations and audited Edge Functions.
- RLS prevents data exfiltration even if a malicious query escaped a layer.

---

## 7. RLS Strategy

- RLS **enabled on every public-schema table** with explicit GRANTs.
- Policies expressed via SECURITY DEFINER helpers (`has_role`, `manages_team`, `is_in_team`) to avoid recursive lookups.
- No `TO anon` policies for user-owned data.
- Public read-only data (rare) uses narrow `TO anon` SELECT with column projection.
- RLS policies have a test suite that simulates each role and asserts allow/deny.

---

## 8. Rate Limiting

- Per-user and per-IP rate limits at middleware level (Upstash Redis or Supabase ratelimit table).
- Stricter limits on: sign-in, password reset, MFA, integration token creation, export endpoints.
- Webhook endpoints rate-limited per provider.

---

## 9. Secrets Management

- All secrets in Supabase Vault (server) and Vercel encrypted env (frontend build).
- **No secrets in the repo**, ever — verified by `gitleaks` in CI.
- Service-role key only used in Edge Functions, never in client or RSC.
- Integration tokens encrypted at rest using a Vault-stored data key (envelope encryption).
- Quarterly rotation policy; rotation events logged to audit log.

---

## 10. Environment Variables

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Publishable. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (Edge Functions) | Never bundled to client. |
| `SUPABASE_JWT_SECRET` | server only | Token verification in middleware. |
| `RESEND_API_KEY`, `SLACK_*`, `CLICKUP_*` | server only | Per-integration. |
| `SENTRY_DSN` | client + server | Public DSN is fine. |

ESLint rule forbids referencing non-`NEXT_PUBLIC_` env vars in client bundles.

---

## 11. Storage Access

- Buckets:
  - `avatars` — public-read, owner-write, 2 MB max, image MIME only.
  - `announcements` — auth-read (audience-scoped), HR/Owner write, 10 MB max.
  - `reports` — private; signed URLs for owner + managers; 25 MB max.
- Uploads always go through a signed-URL Edge Function that validates MIME (magic bytes), size, and AV scan.
- Storage policies mirror app-level RBAC.

---

## 12. Data Protection

- All traffic TLS 1.2+.
- PII categorized: identifiers, attendance, performance signals. Access logged.
- Encryption at rest provided by Supabase; sensitive integration tokens additionally encrypted at app layer.
- GDPR: data export per user available; right to erasure handled via offboarding pipeline (soft delete + PII redaction + log of deletion).

---

## 13. Audit Logging

- All sensitive actions write to `audit_logs`:
  - Sign-in / sign-out
  - Role grant/revoke
  - Attendance override
  - Leave approval/rejection
  - Announcement publish to company
  - Integration connect/disconnect/rotate
  - Configuration changes
- Logs are immutable (insert-only; update/delete grants revoked).

---

## 14. Dependency Hygiene

- Dependabot/Renovate enabled.
- Weekly `npm audit` and `bun audit` in CI.
- Pinned versions; lockfile committed.
- No deprecated packages.

---

## 15. Operational Security

- CI/CD with required code review, status checks, branch protection.
- Two-person rule for production deploys.
- Pre-prod environments isolated from production data.
- Incident response runbook with severity levels, owners, comms templates.
- Quarterly access review.
- Annual penetration test once in production.

---

## 16. Threats Considered

| Threat | Mitigation |
|---|---|
| Account takeover | MFA, leaked password check, lockout, IP anomaly logging. |
| Privilege escalation | Roles in separate table; SECURITY DEFINER helpers; audit. |
| Cross-team data leak | RLS scoped by team/department; integration tests. |
| Token theft | httpOnly cookies, short-lived JWTs, refresh rotation. |
| Webhook spoofing | HMAC signature verification, timing-safe comparison. |
| Supply chain attack | Lockfile, audit, dependency review, SRI for third-party scripts. |
| Insider misuse | Audit log, two-person rule for sensitive ops, least privilege. |
| Data loss | Daily backups, restore tests quarterly, RPO ≤ 1 h. |
