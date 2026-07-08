# SpartaFlow — Production Gap Analysis

> **Type:** Engineering audit & production-readiness roadmap.
> **Method:** Static, read-only inspection of the codebase (src, supabase, docs, CI/CD,
> Docker, config). No source code was modified. Findings are evidence-based with
> `file:line` citations; anything not confirmable from static inspection is marked
> **Not Verified**.
> **Audit date:** 2026-07-05.
> **Snapshot size:** 782 TS/TSX files, ~78,310 LOC in `src/`, 13 SQL migrations
> (38 tables, 18 functions, 36 triggers, 106 RLS policies), 162 docs, 29 test files.

---

# Executive Summary

SpartaFlow is best described as a **production-grade skeleton wrapped around a
prototype-grade product**. The engineering _infrastructure_ is unusually mature for
the stage: a real layered data backbone (`BaseService` → services → repositories),
server-side authorization via Postgres RLS, a structured logging framework, multi-layer
error boundaries, a comprehensive 6-workflow CI/CD pipeline (gated deploy + auto-rollback

- CodeQL/Trivy/Gitleaks scanning), a production-ready multi-stage Docker setup, and clean
  TypeScript discipline (0 real `any`, 0 `@ts-ignore`, green typecheck).

However, the **product itself is largely not persisted**. Only **2 of ~15 feature
modules — Authentication and Attendance — are backed by the live Supabase backend.**
The remaining product surface (Tasks, Kanban, Sprints, Time Tracking, Dependencies,
Analytics, Dashboards, Admin, AI, Audit) runs on **`localStorage`-backed in-memory mock
stores** (`useSyncExternalStore` facades seeded from `mock-data.ts`). Confirmed by the
team's own `docs/BACKEND_MIGRATION_PLAN.md` and by static analysis: **181 feature/route
files import a local `store.ts`/`mock-data`, while only 7 touch the repository layer.**

There is important nuance: the **database schema is ahead of the UI wiring** in several
domains. Migrations already define real tables for projects, HR, notifications, approvals,
daily reports, and dependencies — but the UI is not wired to them, and there are **no
tables at all for the richest mock modules** (`tasks`, `sprints`, `time_logs`, `comments`).
Meanwhile the **entire AI provider layer is stubbed** (6 `TODO` "call the API" markers),
**audit logging is a `localStorage` mock** (not durable), and several security controls
(rate limiting, CSP enforcement, external log sinks) are **built but not wired**.

**Bottom line:** the hard part that teams usually skip (architecture, auth, RLS, DevOps)
is done well; the "easy" part that makes it a real product (persisting each feature to
the backend) is the bulk of the remaining work.

---

# Overall Production Score

## **55 / 100** — "Not production-ready; strong foundation, incomplete product."

| Band                                                                | Meaning                                    |
| ------------------------------------------------------------------- | ------------------------------------------ |
| Foundation (arch, auth, RLS, DevOps, error handling)                | **85–90** — genuinely production-grade     |
| Product completeness (feature persistence)                          | **35** — mostly mock                       |
| Operational hardening (observability, rate-limit, secrets, testing) | **55–60** — built but unwired / logic-only |

The score is dragged down by the fact that, measured against a _true production_ bar, a
platform where core workflows (tasks/sprints/time) don't survive a page reload across
devices cannot ship. The foundation is what keeps it from scoring lower.

---

# Category Scores

| #   | Category             | Score | Verdict |
| --- | -------------------- | ----- | ------- |
| 1   | Project Architecture | 78    | WARNING |
| 2   | Authentication       | 85    | PASS    |
| 3   | Authorization (RBAC) | 88    | PASS    |
| 4   | Database             | 82    | PASS    |
| 5   | Row Level Security   | 74    | WARNING |
| 6   | API Layer            | 72    | WARNING |
| 7   | State Management     | 70    | WARNING |
| 8   | UI                   | 80    | PASS    |
| 9   | Performance          | 60    | WARNING |
| 10  | Security             | 68    | WARNING |
| 11  | Error Handling       | 88    | PASS    |
| 12  | Logging              | 62    | WARNING |
| 13  | Testing              | 55    | WARNING |
| 14  | Documentation        | 65    | WARNING |
| 15  | DevOps               | 88    | PASS    |
| 16  | Production Readiness | 35    | FAIL    |
| 17  | Code Quality         | 82    | PASS    |
| 18  | Scalability          | 55    | WARNING |

_(19 Technical Debt and 20 Missing Features are cross-cutting and scored via their own
sections below.)_

---

# Critical Blockers

These prevent production launch outright.

### C1 — Core product modules are `localStorage` mocks, not persisted

Tasks, Kanban, Sprints, Time Tracking, Dependencies, Analytics, Dashboards, Manager,
Admin, AI, and Audit are backed by in-memory/`localStorage` stores, not the backend.

- Evidence: `src/features/tasks/store.ts:1-8` ("localStorage-backed reactive facade …
  Replace internals with server fns once persistence lands"); `src/features/dependencies/store.ts:2`
  ("Local mock store"); 13 `store.ts` + 17 `mock-data.ts` files; **181 feature/route files
  import local stores vs 7 touching `@/repositories`**.
- Impact: data does not persist across devices, sessions, or users; no multi-user
  collaboration; no server enforcement of RLS on this data. **Not shippable.**

### C2 — No backend tables exist for Tasks, Sprints, Time Tracking, or Comments

The richest mock modules have **no schema at all**. `grep "create table.*tasks"` →
none. Absent: `tasks`, `epics`(\*present but unused by UI), `sprints`, `time_logs`,
`comments`. Migrations cover projects/HR/attendance/reports/notifications/approvals only.

- Impact: C1 cannot be resolved by "wiring" alone — net-new schema + services +
  repositories + query hooks must be built for these domains.

### C3 — AI subsystem provider layer is entirely stubbed

- Evidence: `src/ai/providers/{openai,anthropic,gemini}-provider.ts` — 6 `TODO` markers,
  each an unimplemented "call the … API server-side". The AI Assistant is non-functional
  against real providers.
- Impact: the advertised "AI Assistant" feature does nothing in production.

### C4 — Audit logging is not durable

- Evidence: `src/features/audit/audit-store.ts` is a `localStorage` mock (capped at 500
  events, `audit-store.ts:24-26`), explicitly "Mirrors a future append-only Supabase
  `audit_logs` table." It **is** actually called at 19 real sites (login/logout, employee
  CRUD, projects, admin, invitations) — but records live only in the browser.
- Impact: fails CLAUDE.md's "Audit important actions" requirement; not tamper-proof,
  not server-side, lost on cache clear. A compliance/security blocker for an HR/company OS.

---

# High Priority Issues

### H1 — RLS integrity holes let users falsify their own data

Access-control is sound (no wide-open tables), but _integrity_ is not:

- **Self-writable attendance metrics.** `attendance`, `attendance_sessions`,
  `break_sessions`, `daily_status_updates` expose `*_insert_self`/`*_update_self` policies
  with no column restriction (`20260630130000_attendance_daily_reports.sql:114-119,271-282`).
  An employee can directly set `status='on_time'`, `late_minutes=0`, `worked_seconds=99999`.
  Contrast the correct `work_sessions` design (writes blocked; forced through validated
  `SECURITY DEFINER` functions).
- **Reviewer full-row update on `daily_reports`.** `daily_reports_reviewer_update` grants
  `FOR UPDATE` over _all_ columns to anyone passing `can_review_reports()` (includes
  `team_lead`/`project_manager`) — a lead can rewrite any employee's report body.
- **Unrestricted self-update on `profiles`.** `profile_self_update` allows updating any own
  column incl. `status`, `department_id`, `team_id`, `job_title` (role is safe — separate table).

### H2 — Rate limiting is built but wired to nothing

`src/lib/security/rate-limit.ts` is a complete token-bucket limiter applied at **zero
endpoints** (only referenced in tests). Auth, password-reset, and AI paths are unthrottled
at the app layer (Supabase's own limits still apply). In-memory store also won't coordinate
across instances.

### H3 — Unbounded list reads (scalability)

BaseService supports pagination, but domain list verbs call `this.list()` without a limit:
**~50 `.select(` calls, only 3 `.range(` and 3 `.limit(1)`.** On `activity_feed`,
`notifications`, or future `tasks` this fetches every row. Evidence:
`src/services/core/base-service.ts:77-80` (ranges only when limit is set).

### H4 — HR invitation _issuance_ is a mock

`src/features/hr/invitations-store.ts:2` is `localStorage`-backed with a hardcoded actor
("Amelia Rivera"). The _acceptance_ side (`routes/auth/accept-invitation.tsx`) is real, so
the two halves are disconnected — a "sent" invite never creates a Supabase user. Needs a
secured server function (service-role) to create auth user + profile + role atomically.

### H5 — No README / developer entry point

No README anywhere (root or `docs/`). `.dockerignore` even references a non-existent
`README.md`. 162 docs exist but a newcomer has no starting point.

### H6 — External observability sinks not wired

`src/lib/logging/adapters/{sentry,logtail,otel}.ts` are "PREPARED, NOT WIRED"
(`sentry.ts:2`; no `@sentry/*` dependency). In production, logs go to console only — no
error aggregation, no alerting.

### H7 — No test coverage measurement; tests are logic-only

254/254 tests pass, but `@vitest/coverage-v8` is absent, there is no coverage script/CI
gate, and only 1 component + 2 integration + 2 e2e tests exist. Repositories, services'
Supabase I/O, and ~318 of 319 UI components are untested.

---

# Medium Priority Issues

- **M1 — Architecture layer violations.** UI/hooks reach Supabase directly, contravening
  `component → repository → service → Supabase`: `features/attendance/hooks/use-today-session.ts:4`,
  `features/attendance/components/team-today-grid.tsx:15`, `features/attendance/api.ts`
  (raw `.from()` at 30/47/57/115/147, no repository), `features/hr/api.ts:16` (uses `db`
  from `@/services/core`, raw `.from("employees")`). 12 direct-client import sites total.
- **M2 — AI provider API keys in browser `localStorage` with XOR "obfuscation."**
  `src/features/ai-settings/secure-store.ts:9-46` — not encryption, XSS-readable. Self-
  documented as a dev-only stand-in; prod keys belong server-side.
- **M3 — CSP ships Report-Only and allows `'unsafe-inline'` scripts.**
  `src/lib/security/headers.ts:44-47,75`; `.env.example` sets `ENFORCE_CSP=false`.
  Enforcement is opt-in; `script-src 'self' 'unsafe-inline'` weakens XSS defense.
- **M4 — No input validation in the data layer.** zod is imported in only 5 files; in the
  data layer only `base-service.ts` runs opt-in `insertSchema`/`updateSchema`. Most services
  persist unvalidated input, under-enforcing CLAUDE.md's "Validate all inputs."
- **M5 — No request timeouts / AbortController in the data layer.** Supabase reads/writes
  have no client-side timeout (AbortSignal only appears in AI/integration ports).
- **M6 — No optimistic updates; sparse cache invalidation.** `onMutate` = 0 occurrences;
  ~5 `invalidateQueries` sites, all in attendance. (Mostly moot until features are live.)
- **M7 — Polymorphic FKs without referential integrity.** `mentions.source_id`,
  `activity_feed.source_id`, `notifications.entity_id`, `dependency_requests.related_task_id`
  are FK-less (target tables not built yet) — orphan rows possible.
- **M8 — No Supabase Storage buckets.** The "Files" module has no DB storage layer; no
  `storage.buckets`/policies anywhere. Task/project/HR attachments cannot be persisted.
- **M9 — Prettier not run: ~1,646 formatting violations.** ESLint reports 1,665 problems,
  1,646 are `prettier/prettier`. Substance is clean; `npm run format` clears ~99%. But CI
  `lint.yml` runs a Prettier check, so the pipeline is currently red on formatting.
- **M10 — Oversized "god" components.** `eod-wizard.tsx` (977), `midday-wizard.tsx` (780),
  `task-detail.tsx` (561); 17 files >400 LOC.
- **M11 — No list virtualization.** No `react-window`/`@tanstack/react-virtual`; long lists
  (tables, kanban, time logs) render fully — violates CLAUDE.md "Virtualize long lists."
- **M12 — 452 KB main vendor chunk, no `manualChunks`.** Routes are auto code-split, but the
  React+Radix(+recharts) vendor bundle is unsplit (`.output/public/assets/index-*.js`).

---

# Low Priority Issues

- **L1 — Unused dependency `date-fns`** (declared, 0 imports in `src`/`tests`).
- **L2 — Duplicate/unused auth wrapper** `src/lib/supabase/auth.ts` ("Not wired") vs live
  `features/auth/auth-service.ts` — drift risk.
- **L3 — Overlapping notifications rules** `features/notifications/rules.ts` (452) vs
  `services/notifications/rules.ts` (381).
- **L4 — `dangerouslySetInnerHTML`** at `src/components/ui/chart.tsx:73` — injects dev-supplied
  CSS vars, not user input (standard shadcn pattern); low risk.
- **L5 — Session tokens in `localStorage`** (`integrations/supabase/client.ts:51`) — standard
  Supabase SPA behavior but XSS-exfiltratable (no httpOnly cookie).
- **L6 — `permissions`/`role_permissions` catalog world-readable** to all authenticated users
  (minor authz-matrix info disclosure).
- **L7 — Unindexed audit FKs** (`created_by`/`updated_by`/`reviewed_by`/`session_id`) — future
  seq-scans on user-deletion joins; not urgent at current scale.
- **L8 — nginx sets no security headers itself** (comes from SSR); static `/assets` and
  `/healthz` bypass them (low impact).
- **L9 — `super_admin`→`admin` enum rename vs literal policy strings.** Installed policies are
  fine (Postgres stores enum OID), but _replaying_ older migrations post-rename would fail on
  `'super_admin'::app_role`. **Not Verified** (depends on replay behavior).
- **L10 — Modest alt-text / skeleton coverage** (2 files with `alt=`; Skeleton used in 6).
- **L11 — 18 `console.*` calls** (mostly infra logging adapters; 3 flagged by ESLint `no-console`).
- **L12 — `Math.random()` for IDs/jitter in non-mock paths** (`notifications/event-bus.ts`,
  `automation-engine.ts`, `integrations/automation/retry-queue.ts`) — acceptable, not cryptographic.

---

# Technical Debt

| ID   | Item                                                 | Priority | Impact                                   | Est. Effort     | Recommended Solution                                                                                                    |
| ---- | ---------------------------------------------------- | -------- | ---------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| TD1  | Mock stores across ~13 modules                       | Critical | No persistence/multi-user                | 8–12 wk         | Adopt the proven `attendance` `api.ts`+`queries.ts` contract per module; reduce `store.ts` to optional optimistic cache |
| TD2  | Missing `tasks/sprints/time_logs/comments` schema    | Critical | Core features can't persist              | 2–3 wk (schema) | Net-new migrations + RLS + `SECURITY DEFINER` verbs, mirror `permissions.ts` intent                                     |
| TD3  | AI provider stubs                                    | Critical | AI Assistant non-functional              | 1–2 wk          | Server-side provider calls via Edge Functions; keys in server secrets                                                   |
| TD4  | Audit log not durable                                | Critical | Compliance/security gap                  | 1 wk            | `audit_logs` table + append-only `AuditService`; swap `recordAudit` internals                                           |
| TD5  | RLS integrity holes (H1)                             | High     | Users falsify attendance/reports/profile | 3–5 d           | Column-scoped policies or route writes through `SECURITY DEFINER` functions                                             |
| TD6  | Rate limiting unwired                                | High     | Auth/AI abuse                            | 2–4 d           | Apply limiter middleware to auth/reset/AI server fns; move to shared store (Redis/DB) for multi-instance                |
| TD7  | Unbounded list reads                                 | High     | Scalability cliff                        | 3–5 d           | Default limit/range on all list verbs; cursor pagination on feeds                                                       |
| TD8  | HR invite issuance mock                              | High     | Onboarding broken                        | 3–5 d           | Secured server fn: create auth user + profile + role atomically                                                         |
| TD9  | No README / onboarding                               | High     | Slows every new dev                      | 1 d             | Write root README (quickstart, env, run, test, deploy)                                                                  |
| TD10 | Observability sinks unwired                          | High     | Blind in prod                            | 2–3 d           | Add `@sentry/*`, call `configureLogging` with adapters, set DSNs via env                                                |
| TD11 | No coverage tooling / thin tests                     | High     | Regressions undetected                   | Ongoing         | Add `@vitest/coverage-v8` + CI gate; grow integration/e2e as features go live                                           |
| TD12 | Layer violations (attendance/hr direct Supabase)     | Medium   | Erodes architecture guarantees           | 3–5 d           | Introduce `attendance`/`hr` repositories; route UI through them                                                         |
| TD13 | No input validation in data layer                    | Medium   | Bad data / injection surface             | 3–5 d           | Declare zod `insertSchema`/`updateSchema` on every service                                                              |
| TD14 | AI keys in localStorage (XOR)                        | Medium   | Key theft via XSS                        | 2–3 d           | Move to server-side secret store; never expose to browser                                                               |
| TD15 | CSP Report-Only + unsafe-inline                      | Medium   | Weak XSS defense                         | 2–4 d           | Nonce-based CSP; flip `ENFORCE_CSP=true`; remove `unsafe-inline`                                                        |
| TD16 | No Storage buckets                                   | Medium   | Files feature impossible                 | 3–5 d           | Provision `task-files`/`project-files`/`hr-documents`/`avatars` + path RLS                                              |
| TD17 | God components (M10)                                 | Medium   | Maintainability                          | 3–5 d           | Decompose wizards into step components                                                                                  |
| TD18 | No virtualization                                    | Medium   | UI jank at scale                         | 2–4 d           | `@tanstack/react-virtual` on tables/kanban/logs                                                                         |
| TD19 | Vendor chunk 452 KB                                  | Medium   | Slow first load                          | 1–2 d           | `manualChunks` split (recharts/radix), lazy-load charts                                                                 |
| TD20 | Prettier not run                                     | Low      | Red CI                                   | <1 d            | `npm run format`                                                                                                        |
| TD21 | Unused deps / dead code (date-fns, dup auth wrapper) | Low      | Clutter                                  | <1 d            | Remove                                                                                                                  |
| TD22 | Timeouts absent in data layer                        | Low      | Hung requests                            | 1–2 d           | AbortController + timeout wrapper in BaseService                                                                        |

---

# Missing Features (before production)

| Domain                                  | Current state                              | Missing for production                                                                                                           |
| --------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**                      | Live                                       | Server-side invitation _issuance_; optional MFA; configurable GoTrue rate limits (**Not Verified**)                              |
| **RBAC**                                | Live (granular, RLS-enforced)              | Column-level write restrictions (H1); admin UI for role/permission assignment (verify)                                           |
| **HR / Company Hub**                    | Schema partial, UI mock                    | Real invite issuance; leave request/approve; documents (+Storage); announcements CRUD; onboarding/offboarding; append-only audit |
| **Attendance**                          | Live                                       | Realtime team board; integrity fix on self-writable metrics                                                                      |
| **Daily Reports** (check-in/midday/EOD) | Repos wired, hybrid                        | `submit_*`/`get_session_reports` RPCs; manager rollup; RLS author-write/manager-read                                             |
| **Projects**                            | Schema live, store hybrid                  | Full CRUD wiring; derived stats as SQL views; clients/templates/milestones                                                       |
| **Tasks**                               | **Mock, no schema**                        | Entire backend: tables, activity log, checklist, watchers, relations, refs, kanban persistence                                   |
| **Kanban**                              | Mock                                       | Persist column config + ordering                                                                                                 |
| **Sprints**                             | **Mock, no schema**                        | `sprints` table; task↔sprint link; burndown view                                                                                 |
| **Time Tracking**                       | **Mock, no schema**                        | `time_logs` + one-active-timer constraint; start/stop RPCs                                                                       |
| **Dependencies**                        | Mock (schema `dependency_requests` exists) | Wire UI to schema; comments/activity                                                                                             |
| **Comments**                            | **Mock, 3 divergent shapes, no schema**    | One polymorphic `comments` table + reactions; retire 3 shapes                                                                    |
| **Files**                               | Mock, no Storage                           | Storage buckets + `attachments` table + signed upload/download                                                                   |
| **Notifications**                       | Store hybrid + realtime                    | Server-side rule evaluation (triggers/Edge Fns); preferences CRUD; delivery channels                                             |
| **Realtime**                            | Partial (publication + hooks exist)        | Wire live delivery for notifications/attendance/comments                                                                         |
| **Analytics**                           | Mock                                       | Aggregate SQL views/functions; saved reports CRUD; build last                                                                    |
| **AI Assistant**                        | **Stubbed**                                | Real provider calls (server-side); key management; context wiring                                                                |
| **Audit Logs**                          | **localStorage mock**                      | Durable append-only table + service                                                                                              |
| **Settings / Workspace**                | Mock                                       | Fold into `company_settings`; owner-only update                                                                                  |
| **Monitoring**                          | Framework present, unwired                 | Wire Sentry/Logtail/OTel; alerting; dashboards                                                                                   |
| **Backup / Recovery**                   | **Not Verified**                           | Confirm Supabase PITR/backups; document restore runbook                                                                          |
| **Security**                            | Strong controls, some unwired              | Wire rate-limit; enforce CSP; server-side AI keys                                                                                |
| **Performance**                         | Basic                                      | Virtualization; pagination; bundle split                                                                                         |

---

# Security Findings

**No Critical findings** — no service_role key in client code or `.env`; no hardcoded
secrets in `src`; no `eval`; strong header set (HSTS, `X-Frame-Options: DENY`,
`frame-ancestors 'none'`, nosniff, COOP, Permissions-Policy — `lib/security/headers.ts:63-84`);
open-redirect hardening with tests (`lib/security/redirect.ts`); env validation forbids
`VITE_SUPABASE_SERVICE_ROLE_KEY` (`lib/env/index.ts:61`); the classic self-signup
role-escalation hole is **closed** (`20260702120000_bootstrap_org_registration.sql:197-207`).

| Sev    | Finding                                                                   | Evidence                                           |
| ------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| High   | RLS integrity holes — users can falsify attendance/reports/profile fields | `20260630130000_*.sql:114-119,271-282,284`         |
| High   | Rate limiting built but applied at 0 endpoints                            | `lib/security/rate-limit.ts` (only in tests)       |
| High   | Durable audit log missing (localStorage only)                             | `features/audit/audit-store.ts`                    |
| Medium | AI keys in localStorage w/ XOR obfuscation                                | `features/ai-settings/secure-store.ts:9-46`        |
| Medium | CSP Report-Only + `'unsafe-inline'` scripts, enforcement opt-in           | `lib/security/headers.ts:44-47,75`; `.env.example` |
| Medium | No input validation in most services (zod opt-in)                         | `services/core/base-service.ts:46-62`              |
| Medium | HR invite issuance is mock (no real user created)                         | `features/hr/invitations-store.ts:2`               |
| Low    | Session tokens in localStorage (no httpOnly cookie)                       | `integrations/supabase/client.ts:51`               |
| Low    | `dangerouslySetInnerHTML` (dev-supplied CSS, not user input)              | `components/ui/chart.tsx:73`                       |
| Low    | Authz-matrix world-readable to authenticated users                        | `permissions`/`role_permissions` RLS               |
| Info   | `.env` on disk (gitignored; anon key only, no service_role)               | `.env`, `.gitignore:2-4`                           |

**Not Verified:** whether the live Supabase project has these migrations/RLS applied;
Supabase Auth dashboard settings (email-confirm, JWT expiry, GoTrue limits); CI/deploy
secret handling in depth.

---

# Performance Findings

- **Route splitting: good** — TanStack router-plugin auto-splits routes into per-route
  chunks (no manual `.lazy` needed; confirmed in `.output/public/assets/`).
- **Memoization: reasonable** — 115 `useMemo`, 46 `useCallback`, 6 `React.memo`.
- **Bundle: WARNING** — 452 KB main vendor chunk, no `manualChunks`; recharts + full Radix
  suite are heavy. No image pipeline concern (SVG icons + woff2 fonts only).
- **Virtualization: FAIL** — none; long lists render fully.
- **Data reads: WARNING** — unbounded selects (H3) will not scale on feed/notification/task
  tables.
- **Caching: adequate** — QueryClient `staleTime 60s`, `gcTime 5m`, `refetchOnWindowFocus:false`
  (`router.tsx:56-70`), but per-query keys/staleTime only adopted in 2 live features.

---

# Scalability Findings

Assessed against employee headcount. The **DB schema scales well** (UUID PKs, ~90 indexes
incl. partial/GIN, sound FKs); the **application read patterns and mock stores do not**.

| Scale               | Verdict             | Notes                                                                                                                                                                                                                    |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **10 employees**    | OK                  | Even mock stores "work" per-device; DB comfortably handles it                                                                                                                                                            |
| **100 employees**   | Conditional         | Requires C1/C2 resolved (real persistence). Unbounded reads still tolerable; in-memory rate-limit OK on single instance                                                                                                  |
| **500 employees**   | At risk             | Unbounded `.select()` on `activity_feed`/`notifications`/`tasks` becomes slow; no virtualization → heavy client render; single-instance in-memory rate-limit/logging insufficient                                        |
| **5,000 employees** | Not supported as-is | Needs cursor pagination + server-side filtering/sorting, list virtualization, materialized analytics views, multi-instance-safe rate-limit (Redis/DB), external observability, connection/pooling review, `manualChunks` |

**Primary bottlenecks:** (1) unbounded list reads (H3/TD7), (2) no virtualization (TD18),
(3) analytics computed client-side over mock data rather than SQL views, (4) in-memory
rate-limit/logging that can't coordinate across instances, (5) unindexed audit FKs (L7).

---

# Estimated Remaining Work

Rough order-of-magnitude for one experienced full-stack engineer (calibrated to the
existing `attendance` reference implementation as the per-module unit of work). Ranges,
not commitments.

| Workstream                                                        | Estimate                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Pre-flight hardening (Phase 0)                                    | 1–1.5 wk                                                                         |
| P0 persistence: Projects + Tasks (Phase 1)                        | 3–4 wk                                                                           |
| P1: Sprints, Time Tracking, Comments, Files (Phase 2)             | 4–6 wk                                                                           |
| P2: Dependencies, Daily Reports, Notifications+Realtime (Phase 3) | 3–5 wk                                                                           |
| P3: Company Hub, Workspace, Analytics (Phase 4)                   | 3–5 wk                                                                           |
| AI subsystem (Phase 5)                                            | 1.5–2.5 wk                                                                       |
| Durable audit + observability + security hardening (Phase 6)      | 2–3 wk                                                                           |
| Testing & scale hardening (Phase 7)                               | 2–4 wk                                                                           |
| **Total**                                                         | **~20–31 engineer-weeks (~5–7.5 months solo; ~2.5–4 months for a 2–3 dev team)** |

---

# Recommended Implementation Order

Sequenced to respect data dependencies (a module can't be correct until its parents are
real). Aligns with — and extends — the team's own `docs/BACKEND_MIGRATION_PLAN.md`.
`P0 Projects → Tasks → { P1 } → { P2 } → { P3 }`, with security/observability/testing
threaded through as guardrails.

---

### Phase 0 — Pre-flight Hardening & Guardrails

- **Objective:** Green the pipeline, close the cheapest security/integrity gaps, and give
  new devs an entry point — before any migration work begins.
- **Tasks:** Run `npm run format` (TD20); write root README (TD9); wire rate limiting to
  auth/reset endpoints (TD6); fix the three RLS integrity holes with column-scoped policies
  (TD5/H1); provision a durable `audit_logs` table + `AuditService` and swap `recordAudit`
  internals (TD4); remove `date-fns` + duplicate auth wrapper (TD21); add `@vitest/coverage-v8`
  - a (non-blocking) coverage report (TD11 start).
- **Dependencies:** None.
- **Complexity:** Low–Medium.
- **Dev time:** 1–1.5 weeks.
- **Risk:** Low.
- **Outcome:** CI passes; audit trail becomes durable; the worst integrity holes closed; a
  documented onboarding path.

### Phase 1 — P0 Core Persistence: Projects & Tasks

- **Objective:** Make the root entities real. `projectId`/`taskId` are referenced by nearly
  everything; nothing downstream can be correct until these persist.
- **Tasks:** Wire Projects UI to the existing schema via a `projects` repository + `api.ts`
  - `queries.ts` (retire `projects/store.ts` internals; derived stats as SQL views). **Build
    net-new Tasks backend** (C2): `tasks` (self-ref `parent_task_id`), `epics`, `task_milestones`,
    `task_checklist_items`, `task_watchers`, `task_relations`, `task_activity` (append-only),
    `saved_filters`, `task_favorites`, `kanban_settings`, a human-ref sequence RPC; full RLS;
    services + repositories + query hooks; wire tasks + kanban UI. Introduce an `attendance`
    repository to fix M1 while touching that area.
- **Dependencies:** Phase 0 (audit table, RLS pattern).
- **Complexity:** High.
- **Dev time:** 3–4 weeks.
- **Risk:** High (highest fan-out; schema mistakes ripple everywhere).
- **Outcome:** The two most-referenced modules persist to Supabase with RLS; the migration
  pattern is proven for the rest of the app.

### Phase 2 — P1 Core Workflows: Sprints, Time Tracking, Comments, Files

- **Objective:** Persist the direct children of Tasks/Projects that see daily use.
- **Tasks:** `sprints` table + burndown view (link via `tasks.sprint_id`); `time_logs` +
  partial-unique "one active timer" index + start/stop RPCs; **unify Comments into one
  polymorphic `comments` + `comment_reactions` table** (retire the 3 divergent shapes) with
  @mention events; provision **Supabase Storage** buckets (`task-files`/`project-files`/
  `hr-documents`/`avatars`) + a unified `attachments` table + signed upload/download (TD16/M8).
- **Dependencies:** Phase 1 (Tasks/Projects).
- **Complexity:** High.
- **Dev time:** 4–6 weeks.
- **Risk:** Medium–High (net-new Storage infra; model unification).
- **Outcome:** Sprint planning, time tracking, threaded comments, and file attachments all
  persist and are shared across users.

### Phase 3 — P2 Daily Ops: Dependencies, Daily Reports, Notifications + Realtime

- **Objective:** Wire the daily-driver workflows and turn domain events into real notifications.
- **Tasks:** Wire Dependencies UI to `dependency_requests` (+ fold comments/activity into
  Phase-2 tables); build `submit_checkin`/`submit_midday_report`/`submit_eod_report`/
  `get_session_reports` RPCs + author-write/manager-read RLS; persist notifications +
  preferences, add **server-side rule evaluation** (DB triggers or Edge Functions) and
  **Supabase Realtime** delivery (publication already exists). Resolve polymorphic-FK
  orphans (M7) now that `tasks`/`comments` exist.
- **Dependencies:** Phases 1–2 (tasks, comments, attendance).
- **Complexity:** Medium–High.
- **Dev time:** 3–5 weeks.
- **Risk:** Medium (event fan-out; realtime infra).
- **Outcome:** Reports, dependencies, and live notifications work end-to-end and multi-user.

### Phase 4 — P3 Org & Insight: Company Hub, Workspace, Analytics

- **Objective:** Complete the admin/HR surface and derive analytics from now-real data.
- **Tasks:** HR — real invite issuance server fn (TD8/H4), leave/documents/announcements/
  onboarding/offboarding CRUD, append-only HR audit. Workspace — fold settings into
  `company_settings` (owner-only). Analytics — build aggregate **SQL views/materialized
  views/functions** over tasks/time/attendance/reports/projects + `saved_reports` CRUD
  (build last; reads everything).
- **Dependencies:** Phases 1–3 (all upstream data must be real).
- **Complexity:** Medium–High.
- **Dev time:** 3–5 weeks.
- **Risk:** Medium.
- **Outcome:** Full HR/admin operations; trustworthy analytics computed server-side.

### Phase 5 — AI Subsystem

- **Objective:** Make the AI Assistant functional and secure.
- **Tasks:** Implement provider calls server-side (Edge Functions) for OpenAI/Anthropic/Gemini
  (C3); move keys to server secrets, retire the localStorage XOR store (TD14/M2); wire the
  context engine to real (now-persisted) data.
- **Dependencies:** Phases 1–4 (needs real data for context); can start provider plumbing
  earlier in parallel.
- **Complexity:** Medium.
- **Dev time:** 1.5–2.5 weeks.
- **Risk:** Medium (external API cost/latency; prompt-injection surface).
- **Outcome:** AI features work against real providers with keys never exposed to the browser.

### Phase 6 — Observability, Secrets & Security Hardening

- **Objective:** Be able to see and defend the system in production.
- **Tasks:** Wire Sentry/Logtail/OTel adapters + alerting (TD10/H6); move rate-limit to a
  multi-instance-safe store (Redis/DB) (TD6); enforce nonce-based CSP, flip `ENFORCE_CSP=true`,
  drop `unsafe-inline` (TD15/M3); add zod validation across services (TD13/M4); add request
  timeouts (TD22); confirm & document Supabase backups/PITR + restore runbook (Backup/Recovery).
- **Dependencies:** Can run largely in parallel from Phase 2 onward; finalize before launch.
- **Complexity:** Medium.
- **Dev time:** 2–3 weeks.
- **Risk:** Low–Medium.
- **Outcome:** Production-grade observability, enforced CSP, coordinated rate limiting,
  validated inputs, verified DR.

### Phase 7 — Testing & Scale Hardening

- **Objective:** Prove correctness and survive real headcount.
- **Tasks:** Enforce coverage gate; grow integration/e2e coverage as each module goes live
  (TD11/H7); add cursor pagination + server-side filter/sort to all list verbs (TD7/H3);
  add list virtualization (TD18/M11); `manualChunks` bundle split + lazy-load charts (TD19/M12);
  decompose god components (TD17/M10); add an RLS↔`permissions.ts` parity test so UI and policy
  can't drift.
- **Dependencies:** Phases 1–4 (test the real features).
- **Complexity:** Medium.
- **Dev time:** 2–4 weeks (partly continuous).
- **Risk:** Low.
- **Outcome:** Regression safety net; the platform scales toward 500–5,000 employees.

---

## Appendix — What is already production-grade (keep, don't rebuild)

- **Architecture backbone:** real `BaseService` (generic CRUD, error-wrapped), 35 services,
  28 repositories, feature-slice layout (`services/core/base-service.ts`).
- **Auth & RBAC:** full email/password lifecycle, session persistence + auto-refresh,
  two-layer route guarding, granular `domain.action` permission matrix mirrored in SQL,
  **server-side RLS enforcement** (not client-spoofable), closed self-signup escalation.
- **Error handling:** `ServiceError` contract + classification + retry-with-backoff, route-
  and subtree-level error boundaries, centralized sonner toasts.
- **Logging framework:** structured, redacting, correlation-stamped, adapter-based (sinks
  just need wiring).
- **DevOps:** 6 CI workflows (lint/test/build/deploy/rollback/security-scan), gated deploy
  with health-check + auto-rollback, CodeQL/Trivy/Gitleaks/dependency-review, production
  multi-stage Docker (non-root, healthcheck) + nginx, strong env validation.
- **Code quality:** `strict` TS, **0 real `any`**, 0 `@ts-ignore`, green typecheck.
- **DB schema (where present):** 38 tables, UUID PKs, ~90 indexes, sound FKs/constraints,
  100% RLS coverage, `SECURITY DEFINER` state-machine functions for attendance.
- **Honest docs:** `docs/DOCUMENTATION_STATUS.md` and `docs/BACKEND_MIGRATION_PLAN.md`
  candidly track what is real vs aspirational — a strong signal of engineering maturity.
