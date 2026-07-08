# Supabase Architecture — SpartaFlow Hub

How SpartaFlow uses the Supabase platform end-to-end: project layout, clients, network topology, environments, and operational practices.

## 1. Platform Components in Use

| Component                | Purpose                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Postgres                 | System of record for all domain data.                                                                                               |
| Auth (GoTrue)            | Authentication, sessions, password policy, MFA.                                                                                     |
| Storage                  | Avatars, announcement assets, documents, exports.                                                                                   |
| Realtime                 | Live updates for dependencies, notifications, announcements, manager dashboards.                                                    |
| Edge Functions           | Webhook receivers (ClickUp/Slack/GitHub), scheduled jobs, AI calls, admin-only maintenance. Not used for ordinary app reads/writes. |
| Vault                    | Encrypted storage of integration credentials and signing keys.                                                                      |
| pg_cron                  | In-DB scheduling for nightly rollups, attendance close, retention purges.                                                           |
| pg_net                   | Outbound HTTP from DB (notification dispatcher, webhook delivery).                                                                  |
| Logflare / Logs Explorer | Centralized logs for Postgres, Auth, Edge Functions.                                                                                |

## 2. Client Strategy

Three clients, never confused:

| Client                                                  | Where it runs                              | Key                       | RLS             |
| ------------------------------------------------------- | ------------------------------------------ | ------------------------- | --------------- |
| Browser (`@/integrations/supabase/client`)              | React components, realtime subscriptions   | publishable               | applies         |
| Authenticated server (`requireSupabaseAuth` middleware) | `createServerFn` handlers                  | publishable + user bearer | applies as user |
| Server publishable                                      | Public read-only server fns                | publishable               | applies as anon |
| Admin (`supabaseAdmin`)                                 | Verified webhooks, maintenance, Auth Admin | service role              | bypassed        |

Rules:

- `supabaseAdmin` is imported inside handlers, never at module top-level of client-reachable files.
- Never use service role for ordinary Data API reads.
- Public route loaders only call public server fns (no `requireSupabaseAuth`).

## 3. Project Layout

One Supabase project per environment:

- `spartaflow-dev` — disposable, seeded daily.
- `spartaflow-staging` — schema-frozen mirror of prod; integration sandboxes.
- `spartaflow-prod` — production.

Each project has its own:

- Database (separate Postgres instance).
- Auth user pool (no cross-env users).
- Storage buckets.
- Vault keys.
- Edge Function deployments.

## 4. Schema Organization

| Schema       | Use                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------- |
| `auth`       | Supabase-managed. Read-only from app via `auth.uid()`.                                        |
| `storage`    | Supabase-managed. RLS via storage policies.                                                   |
| `public`     | Application tables, views, functions. RLS on every table.                                     |
| `private`    | Internal helpers, materialized views, dispatcher queues. No GRANTs to `anon`/`authenticated`. |
| `audit`      | `audit_logs` and append-only tables. Insert-only grants.                                      |
| `extensions` | `pgcrypto`, `pg_net`, `pg_cron`, `pg_trgm`, `unaccent`, `pgjwt`, `pgaudit` (optional).        |

## 5. Migrations & Change Management

- Source of truth: `supabase/migrations/*.sql`, timestamped, forward-only.
- Each migration: schema change → GRANTs → RLS enable → policies → indexes → triggers.
- Rollback strategy: forward fix migrations, never destructive rollbacks in prod.
- Seed data (roles, permissions, working_rules defaults) in idempotent `supabase/seed.sql`.
- CI runs `supabase db reset` + `pgTAP` policy tests on every PR.
- Production migrations require two-person approval and run in a maintenance window or behind a feature flag.

## 6. Auth Topology

- Providers enabled: Email/Password, Google OAuth.
- Invitations issued via Auth Admin API from an Edge Function (`POST /admin/invite`), creates a `profiles` row with `status='invited'`.
- MFA (TOTP) required for `owner`, `super_admin`, `hr`.
- Session: httpOnly cookie set by server client. Browser keeps a publishable-key session for realtime.
- Email templates customized in Auth → Email Templates (invite, recovery, magic link).

Full details: `AuthFlow.md`.

## 7. Realtime Topology

- Postgres logical replication publishes a narrow set of tables to Realtime (see `Realtime.md`).
- Channels are namespaced per user/team to avoid fan-out storms.
- All Realtime payloads pass RLS — clients only receive rows they are allowed to read.

## 8. Storage Topology

- Buckets: `avatars`, `announcement-assets`, `documents`, `attachments`, `exports`, `company-assets`. Details in `StorageArchitecture.md`.
- Uploads go through a signed-URL Edge Function that validates MIME (magic bytes), size, and runs antivirus where applicable.
- A row in `public.attachments` is created for every uploaded object so RLS-aware queries can list/filter without touching `storage.objects` directly.

## 9. Edge Functions

Used only for:

- Inbound webhooks (ClickUp, Slack, GitHub) — verify signature, persist `integration_events`, enqueue work.
- AI gateway calls (summaries, anomaly detection) — keep API key server-side.
- Scheduled maintenance triggered by pg_cron via pg_net.
- Auth Admin operations (invite, role grant, password reset force).

App-internal logic stays in TanStack `createServerFn`.

## 10. Scheduled Jobs (pg_cron)

| Job                        | Schedule       | Purpose                                              |
| -------------------------- | -------------- | ---------------------------------------------------- |
| `close_open_attendance`    | hourly         | Auto-close attendance still open past end of day.    |
| `refresh_company_health`   | every 15 min   | Refresh `mv_company_health_daily`.                   |
| `refresh_user_perf_weekly` | daily 02:00    | Refresh weekly user performance.                     |
| `dispatch_outbox`          | every minute   | Pull from `domain_event_outbox`, deliver via pg_net. |
| `purge_old_notifications`  | daily 03:00    | Archive >90d, hard delete archived >180d.            |
| `purge_integration_events` | daily 03:30    | Delete >30d.                                         |
| `rotate_session_table`     | daily          | Delete revoked sessions older than 30d.              |
| `daily_summary_emails`     | weekdays 08:30 | Manager digests via Edge Function.                   |

## 11. Environments

| Env     | Domain                   | DB              | Auth users        | Integrations   |
| ------- | ------------------------ | --------------- | ----------------- | -------------- |
| Dev     | `dev.spartaflow.app`     | dev project     | seeded test users | sandbox tokens |
| Staging | `staging.spartaflow.app` | staging project | invite-only QA    | sandbox tokens |
| Prod    | `app.spartaflow.app`     | prod project    | real users        | real tokens    |

Each environment has its own Supabase project, Vercel project, Sentry project, and integration apps. No cross-env reads or shared secrets.

## 12. Environment Variables

Browser:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_ENV` (`dev|staging|prod`)
- `VITE_SENTRY_DSN`

Server (TanStack server fns + Edge Functions):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` _(server-only)_
- `SUPABASE_JWT_SECRET`
- `WEBHOOK_SECRET_CLICKUP`, `WEBHOOK_SECRET_SLACK`, `WEBHOOK_SECRET_GITHUB`
- `RESEND_API_KEY`
- `LOVABLE_API_KEY` (AI Gateway)
- `SLACK_BOT_TOKEN`, `CLICKUP_TOKEN` (encrypted in Vault for production; env only in dev)
- `SENTRY_DSN_SERVER`
- `APP_BASE_URL`

Never put service role or signing secrets in `VITE_*`.

## 13. Observability

- Logflare for Postgres + Edge Function logs.
- Sentry (frontend + server fns + Edge Functions) — same `correlation_id` propagated end-to-end.
- Custom metrics emitted to a `metrics` Edge Function (counter, histogram) backed by Logflare queries.
- Dashboards: error rate, P95 server-fn latency, slow query top-10, RLS denied counts, Realtime backlog.

## 14. Disaster Recovery Hooks

- Daily PITR snapshots (Supabase managed) + weekly logical dumps to off-platform cold storage.
- Documented restore drill quarterly (see `BackupStrategy.md`).
- Storage buckets versioned; deletes soft for 30 days.

## 15. Security Posture

- RLS on every public-schema table.
- Auth providers locked to email + Google.
- Vault for integration secrets; rotation quarterly.
- Network restrictions: production DB direct access via Supabase only; service-role key never in browser bundles; CI uses short-lived service-account tokens.
- Audit log immutable; SECURITY DEFINER functions own privileged operations.

See `Security.md` (architecture) and `RLSPolicies.md` (data layer).

## 16. Risks Specific to Supabase

- Realtime fan-out: large company-wide announcements can cause WS spikes — mitigated with batched channel topics.
- RLS regressions during migrations: covered by pgTAP policy tests in CI.
- Service-role misuse: lint rule + code review forbids `client.server` import in client-reachable files at module top-level.
- pg_cron drift between environments: jobs defined in migration files, not via dashboard.
