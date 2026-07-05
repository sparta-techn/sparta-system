# Database Schema — SpartaFlow Hub

Production PostgreSQL schema for Supabase. All tables live in `public` unless noted. Every table has explicit GRANTs and RLS enabled (see `RLSPolicies.md`).

## Global conventions

- **Primary key**: `id uuid primary key default gen_random_uuid()` on every table (except pure join tables that use a composite PK).
- **Audit columns** on every business table:
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()` (maintained by trigger)
  - `created_by uuid references auth.users(id) on delete set null`
  - `updated_by uuid references auth.users(id) on delete set null`
- **Soft delete** on user-visible entities: `deleted_at timestamptz`. Indexes are partial `where deleted_at is null`.
- **Tenancy**: `organization_id uuid` reserved on org-scoped tables; single org today, future-proof.
- **Timezones**: all timestamps `timestamptz`, stored UTC.
- **Enums**: defined once in SQL; never hardcoded strings in app code.
- **Foreign keys**: `on delete` chosen explicitly (cascade for dependents, set null for actors, restrict for reference data).
- **Naming**: snake_case tables and columns; tables plural; junction tables `<a>_<b>`.

## Enums

```text
app_role          : owner | super_admin | hr | pm | team_lead | employee | viewer
scope_type        : global | department | team | project | dashboard
attendance_status : on_time | late | absent | excused | remote
leave_type        : vacation | sick | personal | bereavement | unpaid | other
leave_status      : pending | approved | rejected | cancelled
dependency_status : open | acknowledged | in_progress | resolved | escalated | cancelled
priority          : low | normal | high | urgent
notification_severity : info | success | warning | error
audience_type     : company | department | team | user
integration_provider  : clickup | slack | github | figma | google | ai
audit_action      : insert | update | delete | login | logout | role_grant | role_revoke | override | export
```

---

## 1. Identity & Org

### profiles (1:1 with auth.users)
- `id uuid pk references auth.users(id) on delete cascade`
- `display_name text not null`
- `full_name text`
- `avatar_url text`
- `title text` (job title)
- `bio text`
- `timezone text not null default 'UTC'`
- `locale text not null default 'en'`
- `phone text`
- `status text not null default 'active'` — active | invited | suspended | offboarded
- `department_id uuid references departments(id) on delete set null`
- `manager_id uuid references profiles(id) on delete set null`
- `joined_at date`
- audit columns + `deleted_at`
- Indexes: `(department_id)`, `(manager_id)`, `(status) where deleted_at is null`, unique `(lower(display_name))`.

### employee_profiles (HR-private extension)
- `user_id uuid pk references profiles(id) on delete cascade`
- `employee_code text unique not null`
- `employment_type text` — full_time | part_time | contractor
- `contract_start date`, `contract_end date`
- `salary_band text` (HR-only)
- `emergency_contact jsonb`
- `address jsonb`
- audit columns
- RLS: HR / Owner / self read minimal; HR write.

### departments
- `id uuid pk`
- `name text not null unique`
- `slug text not null unique`
- `lead_user_id uuid references profiles(id) on delete set null`
- `parent_department_id uuid references departments(id) on delete set null`
- `is_active boolean not null default true`
- audit + `deleted_at`

### teams
- `id uuid pk`
- `name text not null`
- `slug text not null`
- `department_id uuid not null references departments(id) on delete restrict`
- `lead_user_id uuid references profiles(id) on delete set null`
- `is_active boolean not null default true`
- audit + `deleted_at`
- Unique `(department_id, slug)`.

### team_members
- composite pk `(team_id, user_id)`
- `team_id uuid references teams(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `is_lead boolean not null default false`
- `joined_at timestamptz not null default now()`
- Index `(user_id)`.

### roles (reference, seeded)
- `id app_role pk` — uses the enum
- `description text not null`

### permissions (reference, seeded)
- `code text pk` — e.g. `attendance.read.team`
- `description text not null`
- `category text not null`

### role_permissions
- composite pk `(role, permission_code)`
- `role app_role references roles(id) on delete cascade`
- `permission_code text references permissions(code) on delete cascade`

### user_roles (NEVER store role on profiles)
- `id uuid pk`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role app_role not null`
- `scope_type scope_type not null default 'global'`
- `scope_id uuid` — null when scope_type = global
- `granted_by uuid references auth.users(id) on delete set null`
- `granted_at timestamptz not null default now()`
- `revoked_at timestamptz`
- Unique `(user_id, role, scope_type, coalesce(scope_id,'00000000-0000-0000-0000-000000000000'))` where revoked_at is null.
- Indexes: `(user_id) where revoked_at is null`, `(role, scope_type, scope_id)`.

### projects
- `id uuid pk`
- `name text not null`
- `code text unique not null`
- `description text`
- `pm_user_id uuid references profiles(id) on delete set null`
- `department_id uuid references departments(id) on delete set null`
- `clickup_space_id text`
- `status text not null default 'active'` — active | on_hold | completed | archived
- `started_at date`, `ended_at date`
- audit + `deleted_at`

### project_members
- composite pk `(project_id, user_id)`
- `project_id uuid references projects(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `role_in_project text` — pm | contributor | reviewer
- `joined_at timestamptz not null default now()`

---

## 2. Attendance & Workflow

### attendance
- `id uuid pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `work_date date not null`
- `start_at timestamptz`
- `finish_at timestamptz`
- `status attendance_status not null default 'absent'`
- `late_minutes integer not null default 0`
- `worked_minutes integer` (cached via trigger on close)
- `break_minutes integer not null default 0`
- `notes text`
- `overridden_by uuid references auth.users(id) on delete set null`
- `override_reason text`
- audit + `deleted_at`
- Unique `(user_id, work_date) where deleted_at is null`.
- Indexes: `(work_date)`, `(user_id, work_date desc)`, `(status, work_date)`.

### breaks
- `id uuid pk`
- `attendance_id uuid not null references attendance(id) on delete cascade`
- `user_id uuid not null references profiles(id) on delete cascade`
- `started_at timestamptz not null`
- `ended_at timestamptz`
- `duration_minutes integer` — cached
- `reason text`
- audit
- Index `(attendance_id)`, partial unique "one open break per attendance" `(attendance_id) where ended_at is null`.

### morning_checkins
- `id uuid pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `work_date date not null`
- `focus text not null`
- `planned_tasks jsonb not null default '[]'` — `[{title, clickup_id?}]`
- `planned_dependencies jsonb not null default '[]'`
- `mood smallint check (mood between 1 and 5)`
- `submitted_at timestamptz not null default now()`
- audit
- Unique `(user_id, work_date)`.

### midday_reports
- `id uuid pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `work_date date not null`
- `progress_pct smallint check (progress_pct between 0 and 100)`
- `blockers_summary text`
- `submitted_at timestamptz not null default now()`
- audit
- Unique `(user_id, work_date)`.

### end_day_reports
- `id uuid pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `work_date date not null`
- `completed jsonb not null default '[]'`
- `pending jsonb not null default '[]'`
- `blocked jsonb not null default '[]'`
- `task_outcomes jsonb not null default '[]'`
- `notes text`
- `submitted_at timestamptz not null default now()`
- audit
- Unique `(user_id, work_date)`.

### holidays
- `id uuid pk`
- `date date not null`
- `name text not null`
- `country text`, `department_id uuid references departments(id) on delete cascade`
- `is_company_wide boolean not null default true`
- audit
- Unique `(date, coalesce(department_id,'00000000-0000-0000-0000-000000000000'))`.

### leave_requests
- `id uuid pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `type leave_type not null`
- `start_date date not null`
- `end_date date not null check (end_date >= start_date)`
- `reason text`
- `status leave_status not null default 'pending'`
- `approver_id uuid references profiles(id) on delete set null`
- `decided_at timestamptz`
- `decision_note text`
- audit + `deleted_at`
- Indexes: `(user_id, start_date)`, `(status)`, `(approver_id) where status='pending'`.

### working_rules
- `id uuid pk`
- `scope_type scope_type not null` — global | department
- `scope_id uuid`
- `arrival_start time not null default '09:00'`
- `arrival_end time not null default '10:00'`
- `daily_break_cap_minutes integer not null default 60`
- `workweek smallint[] not null default '{1,2,3,4,5}'`
- `effective_from date not null default current_date`
- audit
- Unique `(scope_type, scope_id, effective_from)`.

---

## 3. Collaboration

### dependencies
- `id uuid pk`
- `title text not null`
- `description text`
- `priority priority not null default 'normal'`
- `requested_by uuid not null references profiles(id) on delete restrict`
- `assignee_user_id uuid references profiles(id) on delete set null`
- `assignee_team_id uuid references teams(id) on delete set null`
- `project_id uuid references projects(id) on delete set null`
- `eod_report_id uuid references end_day_reports(id) on delete set null`
- `clickup_task_id text`
- `status dependency_status not null default 'open'`
- `due_at timestamptz`
- `opened_at timestamptz not null default now()`
- `acknowledged_at timestamptz`
- `resolved_at timestamptz`
- `resolution_note text`
- audit + `deleted_at`
- Check `(assignee_user_id is not null or assignee_team_id is not null)`.
- Check `(assignee_user_id is null or assignee_user_id <> requested_by)`.
- Indexes: `(assignee_user_id, status)`, `(assignee_team_id, status)`, `(requested_by)`, `(status, opened_at desc)`, `(due_at) where status not in ('resolved','cancelled')`.

### dependency_comments
- `id uuid pk`
- `dependency_id uuid not null references dependencies(id) on delete cascade`
- `author_id uuid not null references profiles(id) on delete set null`
- `body text not null`
- `attachments jsonb default '[]'`
- audit + `deleted_at`
- Index `(dependency_id, created_at)`.

### announcements
- `id uuid pk`
- `author_id uuid not null references profiles(id) on delete set null`
- `title text not null`
- `body_md text not null` — sanitized markdown
- `audience_type audience_type not null`
- `audience_ids uuid[] not null default '{}'`
- `pinned boolean not null default false`
- `published_at timestamptz`
- `expires_at timestamptz`
- audit + `deleted_at`
- Indexes: `(published_at desc) where deleted_at is null`, GIN `(audience_ids)`.

### announcement_reads
- composite pk `(announcement_id, user_id)`
- `announcement_id uuid references announcements(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `read_at timestamptz not null default now()`

---

## 4. Notifications

### notifications
- `id uuid pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `event_type text not null`
- `severity notification_severity not null default 'info'`
- `title text not null`
- `body text`
- `payload jsonb not null default '{}'`
- `action_url text`
- `read_at timestamptz`
- `archived_at timestamptz`
- `created_at timestamptz not null default now()`
- Indexes: `(user_id, read_at) where archived_at is null`, `(user_id, created_at desc)`.

### notification_preferences
- composite pk `(user_id, event_type)`
- `user_id uuid references profiles(id) on delete cascade`
- `event_type text`
- `in_app boolean default true`
- `email boolean default false`
- `slack boolean default false`
- `updated_at timestamptz`

### notification_deliveries
- `id uuid pk`
- `notification_id uuid references notifications(id) on delete cascade`
- `channel text not null` — in_app | email | slack
- `status text not null` — queued | sent | failed | retried
- `error text`
- `attempted_at timestamptz not null default now()`

---

## 5. Audit & System

### audit_logs (insert-only)
- `id bigint generated always as identity pk`
- `actor_id uuid references auth.users(id) on delete set null`
- `action audit_action not null`
- `target_table text not null`
- `target_id uuid`
- `before jsonb`
- `after jsonb`
- `diff jsonb`
- `ip inet`
- `user_agent text`
- `correlation_id uuid`
- `occurred_at timestamptz not null default now()`
- Indexes: `(target_table, target_id, occurred_at desc)`, `(actor_id, occurred_at desc)`, `(occurred_at desc)`, BRIN `(occurred_at)`.
- Update/delete grants revoked.

### activity_logs (lightweight per-user daily activity)
- `id bigint generated always as identity pk`
- `user_id uuid not null references profiles(id) on delete cascade`
- `work_date date not null`
- `event text not null` — checkin | checkout | break_start | break_end | morning | midday | eod | dep_open | dep_resolve
- `payload jsonb`
- `created_at timestamptz not null default now()`
- Indexes: `(user_id, work_date)`, `(work_date)`.

### settings
- `key text pk`
- `value jsonb not null`
- `scope_type scope_type not null default 'global'`
- `scope_id uuid`
- `description text`
- audit

### integration_accounts
- `id uuid pk`
- `provider integration_provider not null`
- `scope_type scope_type not null default 'global'`
- `scope_id uuid`
- `display_name text`
- `credentials_secret_id text not null` — Vault reference, never the secret itself
- `status text not null default 'connected'`
- `connected_by uuid references auth.users(id)`
- audit
- Unique `(provider, scope_type, scope_id)`.

### integration_links
- `id uuid pk`
- `account_id uuid references integration_accounts(id) on delete cascade`
- `local_entity text not null`, `local_id uuid not null`
- `external_id text not null`
- `metadata jsonb`
- Unique `(account_id, local_entity, local_id)`.

### integration_events (raw inbound)
- `id bigint generated always as identity pk`
- `account_id uuid references integration_accounts(id) on delete cascade`
- `event_type text not null`
- `payload jsonb not null`
- `signature_ok boolean not null`
- `processed_at timestamptz`
- `error text`
- `received_at timestamptz not null default now()`

### attachments
- `id uuid pk`
- `bucket text not null`
- `object_path text not null`
- `mime_type text not null`
- `size_bytes bigint not null`
- `owner_id uuid references profiles(id) on delete set null`
- `parent_table text`, `parent_id uuid`
- `checksum text`
- audit + `deleted_at`
- Unique `(bucket, object_path)`.

### sessions (UI metadata; Supabase manages refresh tokens)
- `id uuid pk`
- `user_id uuid references auth.users(id) on delete cascade`
- `ip inet`, `user_agent text`, `device_label text`
- `last_seen_at timestamptz not null default now()`
- `revoked_at timestamptz`

### domain_event_outbox
- `id bigint generated always as identity pk`
- `aggregate text not null`, `aggregate_id uuid not null`
- `event_type text not null`
- `payload jsonb not null`
- `available_at timestamptz not null default now()`
- `dispatched_at timestamptz`
- `attempts int not null default 0`
- `last_error text`
- Index `(dispatched_at, available_at) where dispatched_at is null`.

---

## 6. Views & Materialized Views

- `v_user_with_roles` — profile + aggregated active roles & scopes (used by app to hydrate session).
- `v_today_attendance` — today's attendance per user joined with profile and team.
- `v_open_dependencies` — open/escalated dependencies enriched with assignee & requester.
- `v_team_daily_health` — per-team daily counts: on_time, late, missing morning, missing eod, open dependencies.
- `mv_company_health_daily` (materialized) — composite score per day; refreshed by scheduled job.
- `mv_user_perf_weekly` (materialized) — punctuality, reports submitted, dependency resolution time.

All views set `security_invoker = on` so they honor caller RLS.

---

## 7. Relationship Map

```text
auth.users 1─1 profiles 1─1 employee_profiles
profiles *─1 departments *─1 departments (parent)
profiles *─* teams (team_members)
profiles *─* projects (project_members)
profiles 1─* attendance 1─* breaks
profiles 1─* morning_checkins / midday_reports / end_day_reports
profiles 1─* leave_requests
profiles 1─* dependencies (as requester / assignee)
teams 1─* dependencies (team-assigned)
dependencies 1─* dependency_comments
announcements 1─* announcement_reads
profiles 1─* notifications
auth.users 1─* user_roles  (role + optional scope)
* audited → audit_logs
* state change → domain_event_outbox
```

---

## 8. Integrity Rules (DB-enforced)

- One attendance per `(user_id, work_date)` while not soft-deleted.
- One morning/midday/eod per user per day.
- Dependency cannot self-assign (`assignee_user_id <> requested_by`).
- Exactly one assignee kind (user XOR team) — enforced via check.
- `leave_requests.end_date >= start_date`.
- `breaks.ended_at >= started_at`; at most one open break per attendance.
- `audit_logs` update/delete revoked at GRANT level + trigger blocks updates.
- `working_rules.arrival_end > arrival_start`.

See `RLSPolicies.md` for access policies and `Triggers.md` for maintained columns.
