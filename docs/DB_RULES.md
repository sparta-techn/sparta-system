# Database Rules & Conventions — SpartaFlow Hub

Living document. All schema changes must comply. When in doubt, add a rule here first, then implement.

---

## 1. Naming Conventions

### Tables
- **Plural, snake_case**: `profiles`, `work_sessions`, `leave_requests`.
- Junction tables: `<a>_<b>` in alphabetical order: `team_members`, `project_members`, `role_permissions`.
- Never abbreviate unless it is universally understood (`auth.users` is external; we do not control it).

### Columns
- **snake_case**: `user_id`, `work_date`, `started_at`, `late_minutes`.
- Booleans: prefix with `is_` or `has_`: `is_active`, `is_company_wide`.
- Timestamps: suffix with `_at` for a point in time, `_date` for calendar dates.
- Durations: suffix with unit and granularity: `late_minutes`, `working_seconds`, `break_minutes`.
- Foreign keys: `<referenced_table_singular>_id`: `department_id`, `manager_id`.
- JSONB columns: plural when they hold arrays (`planned_tasks`), singular when a single object (`emergency_contact`).

### Enums
- Name the enum type in singular PascalCase: `app_role`, `attendance_status`.
- Enum values: lowercase, snake_case: `on_time`, `super_admin`, `in_progress`.
- Define once in SQL; never hardcode values in application code.

### Functions & Triggers
- Functions: descriptive, prefix with domain when grouped: `start_work_session()`, `finish_work_session()`, `tg_set_updated_at()`.
- Triggers: prefix `tg_` + action + table: `tg_set_updated_at`, `tg_handle_new_user`.

### Indexes
- Naming: `idx_<table>_<column(s)>`: `idx_profiles_department_id`.
- Partial indexes append condition: `idx_profiles_status_active` (where `deleted_at is null`).
- Unique indexes: `uk_<table>_<columns>`.

---

## 2. Primary Keys

- Every table gets `id uuid primary key default gen_random_uuid()`.
- **No auto-increment integers** for business tables.
- Exception: append-only audit/event tables may use `bigint generated always as identity` for chronological ordering (e.g. `audit_logs`, `activity_logs`, `domain_event_outbox`).
- Composite primary keys are allowed only for pure junction tables with no extra state: `team_members (team_id, user_id)`.

---

## 3. Audit Fields

Every business table must include:

```
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
created_by   uuid references auth.users(id) on delete set null
updated_by   uuid references auth.users(id) on delete set null
```

- `updated_at` is maintained by `public.tg_set_updated_at()` trigger.
- `created_by` / `updated_by` are set by application code or trigger; never leave null on new rows if the actor is known.
- Reference tables (e.g. `roles`, `permissions`) still get `created_at` / `updated_at` but may omit `created_by` / `updated_by` if they are seeded.

---

## 4. Soft Deletes

- User-visible records use **soft delete**: `deleted_at timestamptz` default `null`.
- Hard delete is permitted only for:
  - Log/event tables after retention (e.g. `audit_logs` after 1+ years).
  - Notification archive after 90 days.
  - Raw inbound integration events after 30 days.
- All SELECT queries and indexes filtering active data must include `where deleted_at is null`.
- Unique constraints on soft-deletable tables must be partial: `where deleted_at is null`.
- Cascading soft delete is preferred over `ON DELETE CASCADE` for user-linked records; implement via trigger or application logic to preserve audit context.

---

## 5. Foreign Keys

- Every relationship must declare a foreign key.
- Choose `ON DELETE` explicitly:
  - `CASCADE` for dependent/junction rows that have no meaning without the parent (e.g. `breaks` → `attendance`, `team_members` → `teams`).
  - `SET NULL` for actor references (e.g. `lead_user_id`, `approver_id`, `overridden_by`).
  - `RESTRICT` for reference data that should not disappear while referenced (e.g. `teams.department_id`).
- **Never FK directly to `auth.users`** for extensions. Use `profiles.id` as the public-facing identity key.
- Composite FKs are allowed when the composite PK is natural (junction tables).

---

## 6. Indexing Rules

### Required indexes
- Every foreign key column.
- Every column used in `WHERE`, `JOIN`, or `ORDER BY` in frequently run queries.
- Every `status` + `created_at` / `opened_at` pair used for dashboards.

### Partial indexes
- Filter soft-deleted rows: `WHERE deleted_at is null`.
- Filter open states: `WHERE status not in ('resolved','cancelled')`.
- Filter pending items for approver queues: `WHERE status = 'pending'`.

### Unique indexes
- Business uniqueness constraints must be enforced at the database level, not just application code.
- Examples: one attendance per user per date; one morning check-in per user per day.

### Prohibited
- No unused indexes. Review `pg_stat_user_indexes` quarterly.
- No redundant indexes covering the same leading columns.

---

## 7. Row Level Security (RLS)

### Global rules
- **Every table in `public` must have RLS enabled.** No exceptions.
- Every table in `public` must have explicit `GRANT` statements.

### GRANT order (exact sequence)
```sql
1. CREATE TABLE public.<name>(...)
2. GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;
3. GRANT ALL ON public.<name> TO service_role;
4. ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;
5. CREATE POLICY ...
```

- Drop `TO anon` grants unless the table has a policy explicitly allowing anonymous reads.
- Always include `service_role` for tables touched by edge functions, admin jobs, or triggers.

### Policy design
- **Never query the protected table inside its own policy.** This causes infinite recursion.
- Instead, use **SECURITY DEFINER helper functions** (e.g. `has_role`, `is_in_team`, `manages_team`).
- Keep policies declarative: one predicate per operation where possible.
- `TO authenticated` is the default target. `TO anon` only for public reference data.

### Helper functions
- All helpers live in `public`, are `STABLE` (or `VOLATILE` only when necessary), `SECURITY DEFINER`, and `SET search_path = public`.
- Revoke `EXECUTE` from `public`; grant to `authenticated` and `service_role`.

### Audit tables
- `audit_logs`: revoke `UPDATE` and `DELETE` at the GRANT level.
- Add a trigger that blocks `UPDATE`/`DELETE` even from table owners.
- `service_role` may still insert; no `authenticated` write policies.

---

## 8. Check Constraints & Validation

- Use `CHECK` constraints for **immutable, data-shape** rules:
  - `end_date >= start_date`
  - `progress_pct between 0 and 100`
  - `assignee_user_id is not null or assignee_team_id is not null`
- Use **triggers** (not `CHECK`) for time-dependent or state-dependent rules:
  - `expire_at > now()` (immutable constraint would break on restore).
  - "Only one open break per attendance."
  - "Insert/update self only for current day."

---

## 9. Timestamps & Timezones

- All timestamps are `timestamptz`, stored in UTC.
- Application layer converts to user-local time using `profiles.timezone`.
- Working-day boundaries use the company timezone from `company_settings.timezone`.
- Date columns (`work_date`, `start_date`) are `date` type, interpreted in the company timezone at query time.

---

## 10. Migration Strategy

### One migration per logical change
- A single migration may contain multiple statements if they are interdependent (table + triggers + indexes + policies).
- Do not split a feature across multiple migrations unless the dependency graph demands it.

### Idempotency
- Migrations must be rerunnable or guarded with `IF NOT EXISTS` / `IF EXISTS`.
- Enum additions use `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

### Data safety
- Migrations that alter columns must preserve existing data (e.g. add new column, backfill, then drop old).
- Renaming columns requires a two-step migration or application compatibility window.

### Seeding
- Reference tables (`roles`, `permissions`) are seeded in the same migration that creates them.
- `company_settings` seeding happens in the initial migration with idempotent `INSERT ... ON CONFLICT`.

### Testing
- Every policy migration must have corresponding pgTAP tests under `supabase/tests/policies/`.
- Tests must pass before the migration is considered complete.

---

## 11. Anti-Patterns (Forbidden)

| Anti-pattern | Why | Correct approach |
|---|---|---|
| Storing role on `profiles` | Privilege escalation risk | Separate `user_roles` table |
| Querying protected table inside its own RLS policy | Infinite recursion | SECURITY DEFINER helper function |
| `TO anon` grants on user data tables | Data exposure | Omit anon grants; use auth-only policies |
| Using `service_role` key for ordinary app reads to bypass RLS | Bypasses all access control | Fix the policy or application logic |
| Hard delete on user-visible records without audit | Data loss / compliance gap | Soft delete + audit log |
| `CHECK (expire_at > now())` | Breaks on restore / immutable rule | Validation trigger |
| Missing `GRANT` after `CREATE TABLE` | Data API permission error | Always include grants in same migration |
| Integer primary keys for business tables | Predictable IDs, merge conflicts | `gen_random_uuid()` |
| Nullable `user_id` in user-owned tables with RLS | Policy ambiguity, orphan rows | `NOT NULL` + correct default or insert value |

---

## 12. Quick Reference Checklist

Before submitting a migration, confirm:

- [ ] Table name is plural, snake_case
- [ ] `id uuid primary key default gen_random_uuid()` present
- [ ] `created_at`, `updated_at`, `created_by`, `updated_by` included (business tables)
- [ ] `deleted_at` included if table is user-visible
- [ ] All FKs declared with explicit `ON DELETE`
- [ ] GRANTs follow the exact 5-step order
- [ ] RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Policies use helpers, never self-query
- [ ] Indexes cover FKs and common filters; partial indexes exclude soft-deleted rows
- [ ] Immutable rules use `CHECK`; time/state rules use triggers
- [ ] Enum values defined in SQL, not hardcoded in app
