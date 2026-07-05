# Triggers — SpartaFlow Hub

Triggers enforce invariants, maintain audit columns, write the audit log, and emit domain events. They are intentionally thin — heavy logic lives in functions (see `DatabaseFunctions.md`).

## 1. Global Maintenance Triggers

### `tg_set_created_audit` — BEFORE INSERT on every business table
- Calls `set_created_audit()`.
- Sets `created_at`, `created_by`, `updated_at`, `updated_by`.

### `tg_set_updated_audit` — BEFORE UPDATE on every business table
- Calls `set_updated_audit()`.
- Refuses to update `created_at` / `created_by` (resets to OLD).

### `tg_write_audit_log` — AFTER INSERT OR UPDATE OR DELETE on audited tables
- Calls `write_audit_log()`.
- Audited tables: `profiles`, `user_roles`, `attendance`, `breaks`, `leave_requests`, `dependencies`, `announcements`, `integration_accounts`, `settings`, `working_rules`, `projects`, `project_members`, `employee_profiles`.
- Diffs OLD vs NEW; persists `actor_id = auth.uid()`, `ip`, `user_agent` (read from `request.headers` via Edge runtime → set via `set_config` per request).

### `tg_prevent_audit_mutation` — BEFORE UPDATE OR DELETE on `audit_logs`
- Raises `feature_not_supported`. Defense in depth on top of revoked grants.

## 2. Auth & Profile Triggers

### `tg_handle_new_user` — AFTER INSERT on `auth.users`
- Creates `profiles` row with `display_name` derived from email, `status='invited'` (or `active` for OAuth direct sign-up if ever enabled).
- Reads optional invite metadata (`raw_user_meta_data`) for `department_id`, `team_ids`, `roles`.
- Inserts the requested `user_roles`.
- Writes audit log.

### `tg_handle_user_email_update` — AFTER UPDATE of `email` on `auth.users`
- Mirrors to `profiles.contact_email` (if maintained) and writes audit.

### `tg_handle_user_delete` — AFTER DELETE on `auth.users`
- Soft-deletes `profiles` (cascade already removes hard FKs).

## 3. Attendance & Workflow Triggers

### `tg_attendance_compute` — BEFORE INSERT OR UPDATE on `attendance`
- Recomputes `late_minutes`, `worked_minutes`, `break_minutes`, `status`.
- Enforces unique `(user_id, work_date)` even across soft-deletes.

### `tg_attendance_notify_late` — AFTER INSERT OR UPDATE on `attendance`
- If new `late_minutes > 0` and (NEW differs from OLD), enqueues `attendance.late` event targeting the user's team lead + HR.

### `tg_break_compute` — BEFORE UPDATE on `breaks` when `ended_at` set
- Computes `duration_minutes`.
- Rolls aggregate up to `attendance.break_minutes` via `AFTER` trigger `tg_attendance_recount_breaks`.

### `tg_workflow_today_only` — BEFORE INSERT on `morning_checkins`, `midday_reports`, `end_day_reports`
- Enforces `work_date = today_in_user_tz()`. Rejects backfills (use `override_*` admin function).

### `tg_eod_event` — AFTER INSERT on `end_day_reports`
- Enqueues `workflow.eod.submitted` event.
- Triggers auto-checkout via `check_out()` if attendance still open.

### `tg_activity_log_event` — AFTER INSERT on `attendance`, `breaks`, `morning_checkins`, `midday_reports`, `end_day_reports`, `dependencies`
- Inserts a row into `activity_logs` (lightweight per-user feed).

## 4. Dependency Triggers

### `tg_dependency_validate` — BEFORE INSERT OR UPDATE on `dependencies`
- Enforces XOR of `assignee_user_id` / `assignee_team_id`.
- Prevents self-assignment.
- Forces `acknowledged_at`/`resolved_at` monotonicity with `status`.

### `tg_dependency_notify` — AFTER INSERT OR UPDATE on `dependencies`
- On INSERT: notifies assignee (or all team members of `assignee_team_id`) + the user's manager.
- On status change → `escalated`: notifies both managerial chains.
- On status change → `resolved`: notifies requester.

### `tg_dependency_comment_notify` — AFTER INSERT on `dependency_comments`
- Notifies all participants except the author.

## 5. Leave Triggers

### `tg_leave_validate` — BEFORE INSERT OR UPDATE on `leave_requests`
- `end_date >= start_date`, status transitions allowed only along the state machine, only `pending` rows editable by owner.

### `tg_leave_post_decision` — AFTER UPDATE on `leave_requests`
- On `pending → approved`: enqueues attendance excuse for each date in range (creates/updates `attendance` rows with status `excused`).
- On any decision: notifies requester.

## 6. Announcement Triggers

### `tg_announcement_publish` — AFTER UPDATE on `announcements` when `published_at` becomes non-null
- Resolves audience, enqueues notifications for each recipient.
- Emits `announcement.published` event for realtime fan-out.

### `tg_announcement_read_unique` — BEFORE INSERT on `announcement_reads`
- Upsert semantics (do nothing on conflict).

## 7. Role / Admin Triggers

### `tg_user_roles_audit` — AFTER INSERT OR UPDATE on `user_roles`
- Writes audit; enqueues `user.role_changed` event (forces target client to refetch `me`).

### `tg_settings_audit` — AFTER UPDATE on `settings`
- Standard audit; broadcasts `settings.changed` over Realtime for admin UIs.

## 8. Notifications Trigger

### `tg_notification_dispatch` — AFTER INSERT on `notifications`
- Reads `notification_preferences` for the recipient/event.
- For each enabled channel ≠ in_app, inserts `notification_deliveries(queued)`.
- A dispatcher Edge Function consumes the queue via pg_cron.

## 9. Session Tracking Trigger

### `tg_session_touch` — BEFORE INSERT OR UPDATE on `sessions`
- Sets `last_seen_at = now()`. Used by the heartbeat endpoint.

## 10. Outbox Trigger

### `tg_outbox_dispatch_notify` — AFTER INSERT on `domain_event_outbox`
- `pg_notify('outbox', payload_id)` so a long-running listener (Edge Function) can dispatch with low latency in addition to the 1-min cron sweeper.

## 11. Trigger Ordering

Within a table, triggers run in name order. Use prefix `tg_a_`, `tg_b_`, `tg_z_` to control ordering when it matters:

- `tg_a_set_created_audit` / `tg_a_set_updated_audit` run first (so subsequent triggers see normalized columns).
- Domain validation triggers `tg_b_*`.
- Computation triggers `tg_c_*`.
- Audit and notification triggers `tg_y_*` (last; they consume final NEW).
- Outbox dispatch notify `tg_z_*`.

## 12. Idempotency

- Triggers that send notifications include a dedupe key in the notification payload (`{user_id, event_type, target_id, date_bucket}`) and check `notifications` for an existing unread row before insert.
- Outbox events carry `(aggregate, aggregate_id, event_type, version)` so the dispatcher can ignore duplicates.

## 13. Failure Handling

- Trigger errors abort the transaction and surface as typed SQLSTATEs to the client.
- Notification trigger failures are non-fatal: wrapped in `BEGIN…EXCEPTION WHEN OTHERS THEN insert into private.trigger_errors`. A monitor alerts on growth.
