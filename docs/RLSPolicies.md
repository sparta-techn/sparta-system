# Row Level Security Policies — SpartaFlow Hub

RLS is **enabled on every table in `public`**. Policies are expressed via SECURITY DEFINER helper functions to avoid recursive lookups and keep policy SQL declarative.

## 1. Helper Functions (SECURITY DEFINER)

All live in `public`, owned by the migration role, search_path = `public`.

| Function | Returns | Description |
|---|---|---|
| `has_role(_user uuid, _role app_role)` | boolean | True if user holds active `_role` at any scope. |
| `has_role_in_scope(_user uuid, _role app_role, _scope_type scope_type, _scope_id uuid)` | boolean | Scoped variant. |
| `is_self(_user uuid)` | boolean | `_user = auth.uid()`. |
| `is_in_team(_user uuid, _team uuid)` | boolean | Membership in `team_members`. |
| `manages_team(_user uuid, _team uuid)` | boolean | Owner/Super Admin/HR; team lead of that team; PM whose project includes that team. |
| `manages_department(_user uuid, _dept uuid)` | boolean | Owner/Super Admin/HR; dept lead; PM in that dept. |
| `is_manager_of(_actor uuid, _subject uuid)` | boolean | True if actor manages any team the subject belongs to, or actor is HR/Owner/Super Admin. |
| `is_audience_of(_user uuid, _announcement uuid)` | boolean | Resolves `audience_type` + `audience_ids` against the user's teams/departments. |
| `current_perm(_code text)` | boolean | True if any of the caller's active roles grants `_code`. |

Every helper is `stable` (or `volatile` only when necessary), `security definer`, and `set search_path = public`. Revoke `EXECUTE` from `public`, grant to `authenticated` and `service_role`.

## 2. GRANT Conventions

For every user-facing table:

```sql
grant select, insert, update, delete on public.<t> to authenticated;
grant all on public.<t> to service_role;
-- no anon grants unless an explicit public read policy exists
```

For reference tables that drive UI (e.g. `roles`, `permissions`, `holidays` public-wide):

```sql
grant select on public.<t> to authenticated;
```

Audit & private tables: only `service_role` writes; `authenticated` may `select` only the rows policy allows.

## 3. Policy Catalogue

Each table lists the policies in the form `name — operation — using/with check`. Where multiple commands share logic, they're grouped. All policies target `authenticated` unless noted.

### profiles
- read_all_active: SELECT — `using (deleted_at is null)`.
- update_self: UPDATE — `using (id = auth.uid())` / `with check (id = auth.uid())`.
- update_any_hr: UPDATE — `using (current_perm('directory.edit.any'))` / same in check.
- insert_self_or_admin: INSERT — `with check (id = auth.uid() or current_perm('directory.edit.any'))`. Normal path is the trigger.
- delete_admin: DELETE — `using (current_perm('directory.edit.any'))`. Soft-delete preferred via UPDATE.

### employee_profiles
- read_self_minimal: SELECT — `using (user_id = auth.uid())`.
- read_hr: SELECT — `using (current_perm('admin.audit.read') or has_role(auth.uid(),'hr'))`.
- write_hr: ALL — `using (has_role(auth.uid(),'hr') or has_role(auth.uid(),'owner'))`.

### departments / teams
- read_all_active: SELECT — `using (is_active and deleted_at is null)`.
- write_admin: ALL — `using (current_perm('admin.config'))`.

### team_members
- read_team_or_manager: SELECT — `using (user_id = auth.uid() or is_in_team(auth.uid(), team_id) or manages_team(auth.uid(), team_id))`.
- write_manager: ALL — `using (manages_team(auth.uid(), team_id))`.

### user_roles
- read_self_or_admin: SELECT — `using (user_id = auth.uid() or current_perm('admin.roles'))`.
- write_admin: ALL — `using (current_perm('admin.roles'))`.

### roles / permissions / role_permissions
- read_all: SELECT — `using (true)`.
- write_super_admin: ALL — `using (has_role(auth.uid(),'super_admin') or has_role(auth.uid(),'owner'))`.

### projects
- read_member_or_manager: SELECT — `using (
    exists (select 1 from project_members pm where pm.project_id = id and pm.user_id = auth.uid())
    or manages_department(auth.uid(), department_id)
    or current_perm('report.read.company'))`.
- write_pm_or_admin: ALL — `using (current_perm('admin.config') or pm_user_id = auth.uid())`.

### project_members
- read_visible: SELECT — `using (user_id = auth.uid() or exists (select 1 from project_members p where p.project_id = project_id and p.user_id = auth.uid()) or manages_department(auth.uid(), (select department_id from projects where id = project_id)))`.
- write_pm_or_admin: ALL — `using (current_perm('admin.config') or exists (select 1 from projects p where p.id = project_id and p.pm_user_id = auth.uid()))`.

### attendance
- read_self: SELECT — `using (user_id = auth.uid())`.
- read_manager: SELECT — `using (is_manager_of(auth.uid(), user_id))`.
- read_hr_owner: SELECT — `using (current_perm('attendance.read.all'))`.
- insert_self: INSERT — `with check (user_id = auth.uid())`.
- update_self_open: UPDATE — `using (user_id = auth.uid() and finish_at is null)` / `with check (user_id = auth.uid())`.
- update_override_hr: UPDATE — `using (current_perm('attendance.override'))`.
- delete_admin: DELETE — `using (current_perm('admin.config'))`.

### breaks — mirror attendance (self read/write, manager read).

### morning_checkins / midday_reports / end_day_reports — three identical sets:
- read_self / read_manager / read_hr_owner.
- insert_self (only for current day; enforced by trigger).
- update_self_same_day.
- delete_admin.

### leave_requests
- read_self: SELECT — `using (user_id = auth.uid())`.
- read_manager: SELECT — `using (is_manager_of(auth.uid(), user_id))`.
- read_hr_owner: SELECT — `using (current_perm('leave.approve.all'))`.
- insert_self: INSERT — `with check (user_id = auth.uid())`.
- update_self_pending: UPDATE — `using (user_id = auth.uid() and status = 'pending')`.
- approve_manager: UPDATE — `using (
    (current_perm('leave.approve.team') and is_manager_of(auth.uid(), user_id))
    or current_perm('leave.approve.all'))` / with check restricts allowed fields via trigger.
- delete_admin: DELETE — `using (current_perm('admin.config'))`.

### holidays / working_rules
- read_all: SELECT — `using (true)`.
- write_admin_or_hr: ALL — `using (current_perm('admin.config') or has_role(auth.uid(),'hr'))`.

### dependencies
- read_participant: SELECT — `using (
    requested_by = auth.uid()
    or assignee_user_id = auth.uid()
    or (assignee_team_id is not null and is_in_team(auth.uid(), assignee_team_id))
    or is_manager_of(auth.uid(), requested_by)
    or (assignee_user_id is not null and is_manager_of(auth.uid(), assignee_user_id))
    or current_perm('report.read.company'))`.
- insert_creator: INSERT — `with check (requested_by = auth.uid() and current_perm('dependency.create'))`.
- update_state: UPDATE — `using (
    requested_by = auth.uid()
    or assignee_user_id = auth.uid()
    or (assignee_team_id is not null and is_in_team(auth.uid(), assignee_team_id))
    or is_manager_of(auth.uid(), assignee_user_id))`.
- delete_admin: DELETE — `using (current_perm('admin.config'))`.

### dependency_comments
- read_visible_dep: SELECT — `using (exists (select 1 from dependencies d where d.id = dependency_id and (
    d.requested_by = auth.uid() or d.assignee_user_id = auth.uid()
    or (d.assignee_team_id is not null and is_in_team(auth.uid(), d.assignee_team_id))
    or is_manager_of(auth.uid(), d.requested_by))))`.
- write_visible_dep: ALL — same predicate restricted to `author_id = auth.uid()` for non-admin updates.

### announcements
- read_audience: SELECT — `using (is_audience_of(auth.uid(), id) and (published_at is not null and (expires_at is null or expires_at > now())))`.
- read_author_or_admin: SELECT — `using (author_id = auth.uid() or current_perm('admin.audit.read'))`.
- insert_author_with_scope: INSERT — `with check (
    (audience_type = 'company' and current_perm('announcement.create.company'))
    or (audience_type = 'department' and current_perm('announcement.create.department'))
    or (audience_type in ('team','user') and current_perm('announcement.create.team')))`.
- update_author: UPDATE — `using (author_id = auth.uid())`.
- delete_admin_or_author: DELETE — `using (author_id = auth.uid() or current_perm('admin.audit.read'))`.

### announcement_reads
- read_self: SELECT — `using (user_id = auth.uid())`.
- write_self: INSERT/UPDATE — `with check (user_id = auth.uid())`.

### notifications
- read_self: SELECT — `using (user_id = auth.uid())`.
- update_self: UPDATE — `using (user_id = auth.uid())` (mark read/archive).
- insert_service: INSERT — `with check (false)` for authenticated; service_role bypasses.
- delete_self: DELETE — `using (user_id = auth.uid())`.

### notification_preferences / sessions
- read_write_self: ALL — `using (user_id = auth.uid())`.

### audit_logs
- read_admin_or_hr: SELECT — `using (current_perm('admin.audit.read'))`.
- insert/update/delete revoked from `authenticated` entirely; trigger blocks updates and deletes even from owners.

### activity_logs
- read_self_or_manager: SELECT — `using (user_id = auth.uid() or is_manager_of(auth.uid(), user_id) or current_perm('report.read.company'))`.
- writes: service_role only.

### settings
- read_all: SELECT — `using (true)`.
- write_admin: ALL — `using (current_perm('admin.config'))`.

### integration_accounts / integration_links / integration_events
- read_admin: SELECT — `using (current_perm('admin.integrations'))`.
- write_admin: ALL — `using (current_perm('admin.integrations'))`.

### attachments
- read_parent: SELECT — `using (
    owner_id = auth.uid()
    or parent_table is null
    or (parent_table = 'announcements' and exists (select 1 from announcements a where a.id = parent_id and is_audience_of(auth.uid(), a.id)))
    or (parent_table = 'dependencies' and exists (select 1 from dependencies d where d.id = parent_id and (d.requested_by = auth.uid() or d.assignee_user_id = auth.uid())))
    or current_perm('admin.audit.read'))`.
- insert_owner: INSERT — `with check (owner_id = auth.uid())`.
- delete_owner_or_admin: DELETE — `using (owner_id = auth.uid() or current_perm('admin.config'))`.

### domain_event_outbox
- service_role only. No `authenticated` policies.

## 4. Storage Policies (per bucket)

Defined on `storage.objects` filtered by `bucket_id`:

- `avatars` — owner write/delete; world-read for authenticated.
- `announcement-assets` — author write; audience read (joins `attachments` + `is_audience_of`).
- `documents` — owner write; managers + HR read.
- `attachments` — owner write; reader determined by linked parent (joins `attachments` table).
- `exports` — owner read/write; deleted by retention job.
- `company-assets` — admin write; world-read for authenticated.

All storage policies use the helper functions where possible to keep policy logic in one place.

## 5. Testing

- pgTAP test suite under `supabase/tests/policies/` runs in CI against a fresh DB with seeded fixtures per role.
- For every table, tests cover: allow/deny per role, scope boundary, cross-team negative cases, HR/Owner positive cases.
- Tests must run green before any policy migration is merged.

## 6. Anti-patterns (forbidden)

- Querying the table being protected inside its own policy (causes infinite recursion). Use SECURITY DEFINER helpers.
- `TO anon` on user-owned tables.
- Checking role with subqueries on `profiles`/`user_roles` directly inside policies.
- Using `service_role` for ordinary app reads to "fix" an RLS denial.
- Granting `update`/`delete` on `audit_logs`.
