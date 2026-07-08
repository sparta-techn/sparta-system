# Database Functions — SpartaFlow Hub

PL/pgSQL functions own privileged or invariant-bearing logic so RLS, validation, and event emission stay co-located with the data. All functions:

- Live in `public` (or `private` when internal).
- Are `SECURITY DEFINER` when they bypass RLS to write audit/notifications; otherwise `SECURITY INVOKER`.
- Set `search_path = public, pg_temp` explicitly.
- Validate caller permissions via `assert_permission(code)` helper at the top.
- Write to `audit_logs` and `domain_event_outbox` where relevant.

This document specifies **responsibilities**, not implementations.

## 1. Permission & Helper Functions

| Function                                                          | Purpose                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `assert_permission(code text)`                                    | Raises `insufficient_privilege` if `current_perm(code)` is false. |
| `current_user_profile() returns profiles`                         | Returns caller's profile or raises.                               |
| `working_rule_for(user uuid, on_date date) returns working_rules` | Resolves effective working rule (department override → global).   |
| `is_workday(rule working_rules, on_date date) returns boolean`    | Excludes weekends + holidays.                                     |
| `next_workday(d date) returns date`                               | Skips weekends/holidays.                                          |

## 2. Attendance Functions

### `check_in(p_note text default null) returns attendance`

- Caller acts as self. Idempotent for the same day.
- Resolves `work_date := (now() at time zone caller.timezone)::date`.
- Creates or updates the day's `attendance` row; sets `start_at = now()`.
- Computes `late_minutes` against `working_rule_for`; sets `status` to `on_time` | `late`.
- If `late_minutes > 0` enqueues `attendance.late` event.
- Writes `activity_logs` and `audit_logs`.

### `check_out() returns attendance`

- Closes the day's attendance: sets `finish_at = now()`.
- Auto-ends any open break first (delegates to `end_break`).
- Recomputes `break_minutes` and `worked_minutes`.
- Enqueues `attendance.checkout` event.
- Returns the closed row.

### `start_break(p_reason text default null) returns breaks`

- Requires an open attendance (otherwise raises).
- Rejects if an open break exists.
- Inserts a `breaks` row; writes activity log.

### `end_break() returns breaks`

- Closes the open break for caller. Computes `duration_minutes`.
- If cumulative `break_minutes` for the day would exceed the cap, attaches a warning event but still closes.
- Writes activity log.

### `override_attendance(p_attendance uuid, p_changes jsonb, p_reason text) returns attendance`

- Requires `attendance.override`.
- Snapshots before/after into `audit_logs`.
- Updates allowed fields only (`status`, `start_at`, `finish_at`, `notes`).

### `calculate_late_minutes(p_start timestamptz, p_rule working_rules, p_tz text) returns int`

- Pure helper.

### `calculate_working_hours(p_attendance uuid) returns int`

- Sums `finish_at - start_at - break_minutes`. Used in views.

### `close_open_attendance() returns int`

- Scheduled job. For every attendance with `start_at` and no `finish_at` past end-of-day in user's TZ, sets `finish_at` to end of arrival window, marks `notes = 'auto_closed'`, enqueues `attendance.auto_closed`.

## 3. Daily Workflow Functions

### `submit_morning_checkin(p_focus text, p_planned_tasks jsonb, p_planned_dependencies jsonb, p_mood int default null)`

- Idempotent per `(caller, today)`.
- Validates JSON shape via Postgres JSON Schema checks (or strict columns inside the JSON).
- Enqueues `workflow.morning.submitted`.

### `submit_midday_report(p_progress_pct int, p_blockers text)` — analogous.

### `submit_endday_report(p_completed jsonb, p_pending jsonb, p_blocked jsonb, p_outcomes jsonb, p_notes text)`

- For each item in `p_blocked` that references a target user/team, optionally creates a dependency via `create_dependency` (if `auto_create_dependency` flag in payload is true).
- Auto-triggers `check_out` if attendance is still open and the day is over.
- Enqueues `workflow.eod.submitted`.

### `generate_daily_summary(p_user uuid, p_date date) returns jsonb`

- Aggregates attendance, breaks, morning/midday/eod, dependencies opened/resolved.
- Used by manager dashboard and email digest.

## 4. Dependency Functions

### `create_dependency(p_title text, p_description text, p_priority priority, p_assignee_user uuid, p_assignee_team uuid, p_due timestamptz, p_project uuid, p_eod uuid) returns dependencies`

- Validates exactly one assignee kind; rejects self-assignment.
- Inserts row; writes audit + outbox `dependency.created` + notification to assignee(s).

### `acknowledge_dependency(p_id uuid) returns dependencies`

- Caller must be the assignee or in the assignee team.
- Sets `status='acknowledged'`, `acknowledged_at = now()`. Enqueues event.

### `resolve_dependency(p_id uuid, p_note text) returns dependencies`

- Assignee or manager. Sets `status='resolved'`, `resolved_at = now()`.
- Notifies requester. Cancels open escalations.

### `escalate_dependency(p_id uuid, p_reason text) returns dependencies`

- Requester or manager. Sets `status='escalated'`. Notifies requester's chain + assignee's chain.

### `cancel_dependency(p_id uuid, p_reason text) returns dependencies`

- Requester or admin.

### `dependency_sla_status(p_id uuid) returns text`

- Pure: returns `green | amber | red` based on `due_at`, status, age.

## 5. Leaves & Holidays

### `request_leave(p_type leave_type, p_start date, p_end date, p_reason text) returns leave_requests`

- Validates dates; default approver = caller's manager; notifies approver.

### `approve_leave(p_id uuid, p_note text) returns leave_requests`

- Requires `leave.approve.team` (scoped) or `leave.approve.all`.
- On approval, marks the affected attendance days as `excused` automatically (next-day idempotent).

### `reject_leave(p_id uuid, p_note text) returns leave_requests` — analogous.

### `cancel_leave(p_id uuid) returns leave_requests` — owner of the request only, before start_date.

## 6. Announcements & Notifications

### `publish_announcement(p_id uuid)`

- Author publishes draft. Sets `published_at = now()`.
- For every resolved audience member, enqueues `notification.created` (deduped per user).

### `mark_announcement_read(p_id uuid)` — upserts `announcement_reads`.

### `enqueue_notification(p_user uuid, p_event text, p_title text, p_body text, p_severity notification_severity, p_payload jsonb, p_url text)`

- Internal helper. SECURITY DEFINER; writes `notifications` + `notification_deliveries` per user preferences.

### `mark_notification_read(p_id uuid)` / `archive_notification(p_id uuid)`.

## 7. Admin / Role Functions

### `grant_role(p_user uuid, p_role app_role, p_scope_type scope_type, p_scope_id uuid)`

- Requires `admin.roles`.
- Inserts `user_roles`; audit log; forces session refresh notification for target user.

### `revoke_role(p_user uuid, p_role app_role, p_scope_type scope_type, p_scope_id uuid)` — analogous; sets `revoked_at`.

### `offboard_user(p_user uuid, p_reason text)`

- HR/Owner. Suspends sessions, revokes roles, soft-deletes profile, reassigns open dependencies.

## 8. Reporting / Materialized View Refresh

### `refresh_company_health()`

- Refreshes `mv_company_health_daily` concurrently.

### `refresh_user_perf_weekly()` — analogous.

### `team_daily_health(p_team uuid, p_date date) returns jsonb`

- On-demand snapshot for team-lead dashboard.

## 9. Outbox / Dispatch (private schema)

### `private.enqueue_event(p_aggregate text, p_aggregate_id uuid, p_event text, p_payload jsonb)`

- Inserts into `domain_event_outbox`.

### `private.dispatch_outbox(p_batch int default 50)`

- Pulls undispatched events, calls dispatcher Edge Function via `pg_net.http_post`, marks dispatched on 2xx.

## 10. Utility Functions

### `set_updated_audit() returns trigger`

- Sets `updated_at = now()`, `updated_by = auth.uid()` on UPDATE.

### `set_created_audit() returns trigger`

- Sets `created_at`, `created_by`, `updated_at`, `updated_by` on INSERT.

### `write_audit_log() returns trigger`

- Generic AFTER INSERT/UPDATE/DELETE trigger that diffs OLD/NEW into `audit_logs`.

### `prevent_audit_mutation() returns trigger`

- BEFORE UPDATE/DELETE on `audit_logs` → raises exception. Defense in depth alongside revoked grants.

## 11. Conventions

- Every function returns the affected row (or rows) so the client gets fresh state without a refetch round-trip.
- Functions raise typed errors using SQLSTATE codes mapped by the app (`P0001` business rule, `P0002` not found, `42501` forbidden).
- Functions never call out to external services directly — they enqueue to `domain_event_outbox` and a dispatcher Edge Function handles HTTP.

## 12. Testing

- pgTAP unit tests per function (happy path + each rejection).
- Integration tests under `supabase/tests/functions/` simulate end-to-end flows (check_in → break → check_out, dependency lifecycle, leave approval).
