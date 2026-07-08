# SpartaFlow — Security

> Production security posture, the controls in place, and the changes made in the
> hardening pass. Companion to `docs/PRODUCTION_AUDIT.md` (findings) and
> `docs/ARCHITECTURE.md` (as-built).
>
> **Related:** `docs/SECURITY_TARGET_SPEC.md` is the _aspirational_ security
> architecture (MFA, httpOnly cookies, DOMPurify, Vault, gitleaks, etc.). This
> document describes the security posture **as actually built today** and the
> hardening applied in this pass — where the two differ, this file is the source
> of truth for current reality.
>
> **Scope of this pass:** fix production security issues only — no feature
> redesign. All changes are additive and backward-compatible; `tsc`, ESLint, and
> the full test suite (157 tests) pass.

---

## 0. Summary of changes in this pass

| Area               | Change                                                         | Where                                                              |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| XSS                | Centralized URL sanitizer; markdown links now share it         | `src/lib/security/url.ts`, `features/ai/components/link-safety.ts` |
| Open redirect      | Post-login `redirect` is coerced to a same-origin path         | `src/lib/security/redirect.ts`, `routes/auth/index.tsx`            |
| HTTP headers / CSP | Security headers + CSP (Report-Only) on every response         | `src/lib/security/headers.ts`, `src/server.ts`                     |
| API validation     | Optional `zod` write-validation hook on the service base class | `src/lib/security/validate.ts`, `services/core/base-service.ts`    |
| Secure storage     | AI keys can no longer be read by client code in production     | `features/ai-settings/secure-store.ts`                             |
| Rate limiting      | Token-bucket limiter + presets, ready to wire                  | `src/lib/security/rate-limit.ts`                                   |
| Env / secrets      | `.env` git-ignored; `.env.example` added (previous pass)       | `.gitignore`, `.env.example`                                       |

New security primitives live under **`src/lib/security/`** (barrel: `@/lib/security`)
and are unit-tested (`*.test.ts`).

---

## 1. Authentication

**Provider:** Supabase Auth (email + password). Session persisted in
`localStorage`, `autoRefreshToken` on.

**Controls in place**

- `AuthProvider` subscribes to `onAuthStateChange` before reading the session;
  identity (profile + roles) refetched only on user-id change.
- Route gate `_authenticated/route.tsx` `beforeLoad` calls
  `supabase.auth.getUser()` (server-validated) and redirects unauthenticated users
  to `/auth?redirect=…`.
- Server functions authenticate via a Bearer token: the client middleware
  `attachSupabaseAuth` attaches the session `access_token`; the server middleware
  `requireSupabaseAuth` validates it with `auth.getClaims`, rejects non-JWT/
  malformed tokens, and injects an RLS-scoped client + `userId` into context.
- Input validation on all auth forms via `zod` + `zodResolver`
  (`features/auth/validation.ts`): email schema, **strong password policy**
  (≥10 chars, upper/lower/digit/symbol), confirm-match on reset/invite.
- Auth pages carry `robots: noindex,nofollow`.

**Hardened this pass**

- **Open-redirect fixed.** The `redirect` search param was passed straight to
  `navigate()`. It is now normalized by `toSafeInternalPath()` — only same-origin
  _paths_ survive; absolute, protocol-relative (`//evil`), and backslash-tricked
  targets fall back to `/app`. See §9.

**Recommended next**

- Enable Supabase leaked-password protection (HIBP) and email confirmation in the
  Supabase Auth settings (server-side toggle).
- Wire rate limiting on sign-in and password reset (§11).
- MFA / SSO from the target spec remain future work.

---

## 2. Authorization

- **Route-level:** the pathless `_authenticated` layout blocks all `/app/*` routes
  for unauthenticated users at `beforeLoad` (runs before any loader/data fetch).
- **Server-function-level:** `requireSupabaseAuth` is the authorization choke point
  for privileged server RPCs — it refuses requests without a valid Bearer JWT.
- **Data-level:** ultimate authorization is **RLS** in Postgres (§4). The service
  layer uses a user-scoped client so row visibility is enforced by the database,
  not the app.

**Note / gap (tracked in the audit, not a regression):** some role-sensitive pages
(owner/HR dashboards) are gated by authentication but not yet by _role_ at the
route level. Enforcement is still correct because RLS blocks the underlying data;
add route-level role gates as defense-in-depth (`hasRole`/`hasPermission` from
`useAuth()` or a `beforeLoad` role check).

---

## 3. Role-Based Access Control (RBAC)

Two-tier, **database as source of truth**:

- **Authoritative (DB/RLS):** `app_role` enum (`owner`, `super_admin`, `hr`,
  `project_manager`, `team_lead`, `employee`, `viewer`) stored in `user_roles`;
  SQL helpers `has_role` / `has_any_role` drive policies.
- **UI-gating only (frontend):** `features/auth/permissions.ts` maps roles →
  coarse `Permission` keys and attendance/report review rules. Precomputed in
  `AuthProvider`; consumed via `hasRole`/`hasPermission`. These helpers are
  unit-tested as the business-rule contract.

**Principle:** the frontend matrix is a _mirror of RLS intent_ and must never be
the only enforcement point. Keep `permissions.ts` in lockstep with policy as new
tables land; consider a generated assertion so the two cannot silently drift.

---

## 4. Row Level Security (RLS)

- **RLS is enabled on every application table** (35/35 tables across
  `supabase/migrations/`). A table with RLS on and no matching policy denies all
  access by default (fail-closed).
- No overly-permissive (`USING (true)` / `WITH CHECK (true)`) policies were found.
- Policies are role-aware via `has_role`/`has_any_role` (e.g. dept/team/profile
  writes restricted to `hr`/`super_admin`/`owner`; role writes to
  `super_admin`/`owner`; attendance review/admin split so owners are read-only).

**Operational rules**

- The **service-role key bypasses RLS** and is server-only (§5). Never use it for
  user-driven reads/writes — use the user-scoped client so RLS applies.
- After every migration, regenerate `integrations/supabase/types.ts` from the live
  schema (the service layer currently relaxes types for not-yet-generated tables;
  see audit H-1).
- When adding a table: enable RLS **and** add explicit policies in the same
  migration; never ship a table reachable by the anon/publishable key without
  policies intended for it.

---

## 5. Environment variables & secrets

**Model**

- **Client (browser bundle):** only `VITE_`-prefixed, _publishable_ values
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). These are inlined at
  build time and are public by design.
- **Server-only:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the
  **`SUPABASE_SERVICE_ROLE_KEY`** (full RLS bypass). Read via `process.env`.
- **Optional server flags:** `ENFORCE_CSP=true` to enforce CSP (§10);
  `NODE_ENV=production` toggles HSTS/frame-deny.

**Controls in place**

- `client.server.ts` (service-role admin client) reads only `process.env`, sets
  `persistSession:false`, and is dynamically imported inside server handlers so it
  never enters the client bundle.
- `.env` / `.env.*` are **git-ignored**; `.env.example` documents every variable
  and warns that the service-role key must never be `VITE_`-prefixed or committed.

**Rules**

- Never place a secret in a `VITE_` variable.
- Never import `client.server.ts` from a route/component or `*.functions.ts`
  module (those ship to the client).
- Rotate keys immediately if a secret was ever committed or synced.

---

## 6. API validation

**Before:** the generic service layer (`BaseService`) forwarded caller input
straight to Supabase — no schema validation (audit H-2). Auth/forms already
validated with `zod`.

**Hardened this pass**

- Added `validate()` / `tryValidate()` + a typed `ValidationError`
  (`src/lib/security/validate.ts`).
- `BaseService` gained optional `insertSchema` / `updateSchema` hooks. When a
  service declares them, `create` / `createMany` / `update` / `upsert` validate
  input **before** it reaches the database and throw `ValidationError` (with
  field-level issues) on bad input. Services that don't declare a schema are
  unchanged — opt-in, zero breakage.

**How to adopt (per service):**

```ts
class ProjectsService extends BaseService<Project, ProjectInsert, ProjectUpdate> {
  protected readonly table = "projects";
  protected readonly entity = "Project";
  protected readonly insertSchema = projectInsertSchema; // zod
  protected readonly updateSchema = projectUpdateSchema; // zod
}
```

**Recommended next:** define insert/update schemas for each domain entity
(derive from the feature `types.ts`) and set them on the service. Validation is
defense-in-depth _in front of_ RLS + DB constraints, not a replacement.

---

## 7. Input sanitization

- **Trust boundary:** treat everything from the user, the AI assistant, and the
  DB as untrusted when it becomes a URL, HTML, or navigation target.
- **URLs:** `safeUrl()` (`src/lib/security/url.ts`) is the single allow-list —
  `http(s)`, `mailto`, `tel`, relative and in-page links only; strips control
  characters first (defeats `java\tscript:` obfuscation); rejects `javascript:`,
  `data:`, `vbscript:`, `file:`, and unknown schemes.
- **Form input:** validated/coerced by `zod` (auth today; service schemas via §6).
- React escapes text by default; we do **not** use `dangerouslySetInnerHTML` for
  user/AI content (the markdown renderer builds React nodes — §8).

---

## 8. XSS protection

**Controls in place**

- No `dangerouslySetInnerHTML` on untrusted content. The AI markdown renderer
  (`features/ai/components/markdown.tsx`) builds React elements only.
- The two `dangerouslySetInnerHTML` usages in the tree are trusted:
  `components/ui/chart.tsx` (generated CSS variables) — no user data.

**Hardened this pass**

- Markdown link hrefs are sanitized through `safeHref` → `safeUrl`, closing the
  `javascript:`-URL vector (a crafted `[x](javascript:…)` now renders as plain
  text). Sanitization is shared with the rest of the app so the policy can't drift.
- **CSP** (§10) adds a second layer: `object-src 'none'`, `base-uri 'self'`,
  scoped `connect-src`, and `frame-ancestors 'none'`.

**Residual / next**

- CSP `script-src` currently needs `'unsafe-inline'` for SSR hydration. Upgrade to
  a per-request **nonce** to make CSP a strong anti-XSS control, then flip CSP to
  enforcing (§10). The target spec's `<SafeRichText>` + DOMPurify approach is the
  intended path if/when rich HTML (not just markdown) is rendered.

---

## 9. CSRF strategy

**Why the surface is small:** SpartaFlow authenticates with a **Bearer token in
the `Authorization` header**, not an ambient session cookie. The Supabase session
lives in `localStorage` and is attached explicitly by `attachSupabaseAuth`.
Cross-site requests cannot read `localStorage` or forge the `Authorization`
header, so classic cookie-based CSRF does not apply to server functions or
Supabase calls.

**Controls that reinforce this**

- `requireSupabaseAuth` rejects any request without a valid Bearer JWT.
- `Referrer-Policy: strict-origin-when-cross-origin`, CSP `form-action 'self'`,
  and (prod) `X-Frame-Options: DENY` / `frame-ancestors 'none'` reduce
  clickjacking/cross-origin abuse.

**Rules / next**

- Do **not** move auth into cookies without adding CSRF defenses
  (`SameSite=Lax/Strict` + double-submit or `Origin` allow-list checks — the
  approach described in the target spec).
- If any state-changing endpoint is ever exposed via cookies or a simple `GET`,
  add an explicit CSRF token + `Origin`/`Referer` validation. Webhooks must use
  HMAC signature verification (timing-safe compare).

---

## 10. HTTP security headers & Content-Security-Policy

Applied to every response in `src/server.ts` via `securityHeaders()`
(`src/lib/security/headers.ts`), best-effort and without overwriting handler-set
headers.

**Always on**

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Permitted-Cross-Domain-Policies: none`
- `X-DNS-Prefetch-Control: off`
- `Cross-Origin-Opener-Policy: same-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`

**Production only** (`NODE_ENV=production`) — kept off in dev so the Lovable
preview iframe still works:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`

**Content-Security-Policy** — shipped as **`Content-Security-Policy-Report-Only`**
by default so it cannot break the app during rollout. Directives:
`default-src 'self'`; `base-uri 'self'`; `object-src 'none'`;
`frame-ancestors 'none'`; `form-action 'self'`;
`script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`;
`img-src 'self' data: blob: https:`; `font-src 'self' data:`;
`connect-src` scoped to the Supabase origin (REST) + `wss://` (Realtime);
`worker-src 'self' blob:`.

**Rollout to enforcing CSP**

1. Deploy with Report-Only (current default); collect violation reports.
2. Add a per-request nonce for SSR inline scripts and drop `'unsafe-inline'` from
   `script-src`.
3. Set `ENFORCE_CSP=true` (server env) to emit an enforcing
   `Content-Security-Policy`. Flip is gated by that env var — no code change.

---

## 11. Rate limiting (preparation)

No throttling exists today. This pass ships the mechanism, ready to wire:

- `RateLimiter` (`src/lib/security/rate-limit.ts`) — a correct **token-bucket**
  limiter with an injectable clock and a pluggable `RateLimitStore`.
- `RATE_LIMIT_PRESETS` — starting limits for `auth`, `passwordReset`, `ai`, and
  generic `write` actions.
- Default `InMemoryRateLimitStore` is **per-instance only**.

**How to wire (server function example):**

```ts
const authLimiter = new RateLimiter(RATE_LIMIT_PRESETS.auth);
const { allowed, retryAfter } = authLimiter.check(`${ip}:signin`);
if (!allowed)
  throw new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
  });
```

**Before production behind multiple instances/edge regions:** replace the
in-memory store with a shared one (a Supabase table + atomic RPC, Upstash/Redis,
or Cloudflare KV/Durable Object) so counters are global. Wire it on: sign-in,
password reset / invitation emails, AI generation, and write-heavy mutations.
Supabase Auth also has its own built-in rate limits — configure them too.

---

## 12. Secure storage

- **Session tokens:** Supabase session in `localStorage` (XSS-readable — mitigated
  by the XSS controls in §7–§8 and CSP). Standard for a Supabase SPA. (The target
  spec's httpOnly-cookie model is stricter and remains future work.)
- **AI provider API keys:** `features/ai-settings/secure-store.ts` is a **local-dev
  stand-in** — `localStorage` with light obfuscation, never a real secret store.

**Hardened this pass**

- `getApiKey()` now **returns `null` in production builds** (`import.meta.env.PROD`)
  and logs a one-time warning. Raw third-party keys can no longer be handed to
  client code in prod even after the provider adapters are implemented. Masked
  previews and "is set" status still work (they use an internal reader), so the
  settings UI is unaffected.

**Required before shipping any real AI provider:** store provider secrets
server-side (Supabase Edge Function secrets / server env) and call the vendor from
an authenticated server function — never from the browser. See
`docs/AI_ARCHITECTURE.md`.

---

## 13. Verification

```bash
npm run typecheck   # tsc --noEmit — passes
npm run lint        # eslint — passes
npm run test        # vitest — 157 passing (incl. url, redirect, rate-limit, headers, link-safety)
```

New security tests: `src/lib/security/{url,redirect,rate-limit,headers}.test.ts`
and `features/ai/components/link-safety.test.ts`.

---

## 14. Known gaps (deferred — need larger work, tracked in the audit)

- **Most features are mock-backed (`localStorage`)** — not multi-user or
  server-authoritative (audit C-1). Real RLS enforcement only applies to features
  wired to Supabase (auth, attendance).
- **Service layer relaxes DB types** (`db = supabase as unknown as …`) — regenerate
  `types.ts` and remove the cast (audit H-1).
- **CSP is Report-Only** pending nonce-based `script-src` (§10).
- **Rate limiting** is scaffolded but not yet wired to endpoints or a shared store
  (§11).
- **Route-level role gates** not yet added for role-sensitive pages (§2).
- **MFA, SSO, httpOnly-cookie sessions, audit logging, storage AV-scan** — all
  described in `docs/SECURITY_TARGET_SPEC.md`, none built yet.

---

_Update this document whenever an auth/RLS/validation control changes. Security
controls are only as good as their last review._
