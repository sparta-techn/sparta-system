# SpartaFlow — Backend Migration Plan

> Documentation only. No code was modified. This plan maps every mock-data source
> in the codebase to the backend work required to make it real.
> Snapshot date: 2026-06-30.

## How to read this

- **Status legend**: ✅ Live (already on Supabase) · 🟡 Mock (localStorage store) ·
  🔵 Mock (static seed, read-only UI) · 🔴 Not started.
- The persistence pattern is consistent: each feature's `store.ts` is a
  `localStorage`-backed `useSyncExternalStore` facade, seeded from `mock-data.ts`,
  and explicitly written to "mirror the future Supabase repository surface."
  Migration = replace store internals with `api.ts` (Supabase) + `queries.ts`
  (TanStack Query), the pattern **already proven in `attendance`**.
- **Reference template for every module**: `src/features/attendance/api.ts` +
  `src/features/attendance/queries.ts`.

## Already-live backend (baseline)

Tables that exist today (`supabase/migrations/`): `profiles`, `user_roles`,
`departments`, `teams`, `holidays`, `company_settings`, `work_sessions`,
`work_session_breaks`. RPCs: `current_work_date`, `start_work_session`,
`start_break`, `end_break`, `finish_work_session`, `has_role`, `has_any_role`,
`current_user_roles`. Enums: `app_role`, `employee_status`, `attendance_status`,
`work_session_status`.

## Mock-data inventory (raw)

27 data files, ~5,344 LOC of seed + store logic:

| Feature | mock-data.ts | store.ts | api/queries |
| --- | ---: | ---: | --- |
| tasks | 319 | 465 | — |
| projects | 429 | 238 | — |
| hr | 413 | — | — |
| manager | 290 | — | — |
| dependencies | 260 | 201 | — |
| task-communication | 126 | 265 | — |
| analytics | 221 | — | — |
| dashboard | 261 | — | — |
| eod | 203 | 198 | — |
| notifications | 199 | 140 | — |
| time-tracking | 96 | 188 | — |
| sprints | 50 | 166 | — |
| midday | 149 | 125 | — |
| checkin | 76 | 136 | — |
| kanban | — | 130 | — |
| attendance | — | — | ✅ api.ts + queries.ts |
| auth | — | — | ✅ auth-service.ts |

---

## Migration Priority Overview

| Wave | Modules | Rationale |
| --- | --- | --- |
| **P0 — foundation** | Projects, Tasks | Almost everything references `projectId` / `taskId`. Nothing else can be correct until these are real. |
| **P1 — core workflows** | Sprint, Time Tracking, Comments, Files | Direct children of Tasks/Projects; high daily-use. |
| **P2 — daily ops** | Daily Reports, Notifications | Depend on Tasks + Dependencies + identity; high product value. |
| **P3 — org & insight** | Company Hub, Workspace, Analytics | Company Hub is partly admin/HR; Analytics is derived and should come last (reads everything). |
| ✅ Done | Authentication, Attendance | Already live. |

---

## 1. Authentication ✅ Live

- **Status**: Live. No mock data.
- **Mock data location**: None. `features/auth/auth-service.ts` calls Supabase;
  `auth-context.tsx` manages session; `permissions.ts` derives UI permissions.
- **Future API needed**: Mostly complete. Gaps: invitation issuance/acceptance is
  partially client-only (`routes/auth/accept-invitation.tsx`) — needs a secured
  server function to create the auth user + profile + role atomically.
- **Required tables**: `profiles`, `user_roles` (exist). Add `invitations` table
  (see Company Hub) to back the invite flow server-side.
- **Service layer**: `auth-service.ts` (exists). Add `inviteUser` /
  `acceptInvitation` server functions using the service-role client.
- **Dependencies**: none (foundational).
- **Priority**: ✅ Done — only harden the invitation server path.

## 2. Attendance ✅ Live

- **Status**: Live (reference implementation).
- **Mock data location**: None. `features/attendance/api.ts` + `queries.ts`.
- **Future API needed**: Complete. Optional: realtime subscription for the team
  board (`team-today-grid.tsx` already comments on realtime intent).
- **Required tables**: `work_sessions`, `work_session_breaks`, `company_settings`,
  `holidays` (exist).
- **Service layer**: `api.ts` (start/break/finish RPCs, history, team) + `queries.ts`.
- **Dependencies**: Authentication.
- **Priority**: ✅ Done — optionally add Supabase Realtime to the team view.

## 3. Daily Reports 🟡 Mock — **P2**

Three linked sub-reports across the workday: **Morning Check-in** → **Midday
Status** → **End-of-Day (EOD)**. One report per Work Session.

- **Mock data location**:
  - `features/checkin/{store.ts, mock-data.ts, types.ts}` (mood, goals, priorities, blockers, help request)
  - `features/midday/{store.ts, mock-data.ts, types.ts}` (progress %, task progress, blocker links, outlook)
  - `features/eod/{store.ts, mock-data.ts, types.ts}` (summary, completed/in-progress, dependencies snapshot, needs-from-others, tomorrow plan, reflection)
  - Submission state persisted to `localStorage`; all three reference `work_sessions` and `dependencies`.
- **Future API needed**: RPCs already named in the type docs:
  `submit_checkin`, `submit_midday_report`, `submit_eod_report`,
  `update_eod_report`, `get_session_reports(work_date)`. Reads: today's report set,
  history list, manager rollup.
- **Required tables**:
  - `daily_checkins` (user_id, work_date, session_id, mood, mood_note, main_goal, jsonb priorities, jsonb blockers, jsonb help_request, submitted_at)
  - `midday_reports` (user_id, work_date, progress, jsonb task_progress, current_focus, jsonb blocker_links, outlook, jsonb help, submitted_at)
  - `eod_reports` (user_id, work_date, session_id, summary, jsonb completed, jsonb in_progress, jsonb open_dependencies, jsonb need_from_others, jsonb tomorrow_plan, jsonb reflection, jsonb session_summary, submitted_at)
  - Optional normalization of `report_help_requests` / `report_blocker_links` if cross-querying is needed.
- **Service layer**: new `features/{checkin,midday,eod}/api.ts` + `queries.ts`.
  Consider a shared `daily-reports/` service since they share `work_date` + session keys.
- **Dependencies**: Attendance (work_sessions, current_work_date), Tasks
  (task progress snapshots), **Dependencies feature** (blocker links), Notifications
  (submission triggers reminders). RLS: author writes own; manager/HR read team.
- **Priority**: **P2 / High** — daily-driver feature; build after Tasks exist so
  task-progress links are real.

## 4. Company Hub 🔵 Mock — **P3**

The HR/organization surface: employees, invitations, leave, documents,
announcements, audit log, onboarding/offboarding.

- **Mock data location**: `features/hr/mock-data.ts` (413 LOC — `HrEmployee`,
  `HrInvitation`, `HrLeaveRequest`, `HrLeaveBalance`, `HrAttendanceIssue`,
  `HrDocument`, `HrAnnouncement`, `HrAuditEvent`, `HrOnboardingTask`,
  `HrOffboardingTask`, plus `departments`/`teams`/`hrKpis`). Read-only static seed,
  no store. Routes under `app/hr.*`.
- **Future API needed**: CRUD for announcements, documents, leave
  (request/approve/reject), onboarding/offboarding checklists, employee directory,
  invitations; append-only audit writes. KPIs become aggregate queries/views.
- **Required tables**:
  - `announcements`, `documents` (+ Supabase Storage for files),
    `leave_requests`, `leave_balances`, `attendance_issues`,
    `onboarding_tasks`, `offboarding_tasks`, `invitations`, `audit_events`.
  - Reuse existing `profiles`, `departments`, `teams` for the directory (the mock
    `HrEmployee` should map onto `profiles` + a related `employment` extension
    rather than a parallel table).
- **Service layer**: `features/hr/api.ts` + `queries.ts`; an `audit.ts` helper for
  the append-only log (the audit requirement in CLAUDE.md/Security).
- **Dependencies**: Authentication/RBAC (HR-only writes via RLS
  `has_any_role('hr','super_admin','owner')`), Attendance (attendance issues),
  Notifications (leave approvals, announcements). Storage (documents).
- **Priority**: **P3 / Medium** — admin surface; directory parts can land earlier
  since `profiles` already exists.

## 5. Workspace 🔵 Mock — **P3**

Company/workspace-level settings panel.

- **Mock data location**: `WorkspaceSettings` in `features/projects/types.ts`,
  rendered by `features/projects/components/workspace-settings.tsx`
  (route `app/projects/workspace`). Static defaults, no persistence.
- **Future API needed**: read/update workspace settings (company name, timezone,
  working days/hours, languages, default statuses, default project template).
- **Required tables**: extend the existing singleton `company_settings` table
  (already used by Attendance) with these columns rather than creating a new table.
- **Service layer**: add `getWorkspaceSettings` / `updateWorkspaceSettings` to a
  shared settings service (alongside `attendance.getCompanySettings`).
- **Dependencies**: RBAC (owner/super_admin write), Projects (default template ref).
- **Priority**: **P3 / Low** — small surface, owner-only; fold into `company_settings`.

## 6. Projects 🟡 Mock — **P0**

- **Mock data location**: `features/projects/{store.ts (238), mock-data.ts (429),
  types.ts}` — `Project`, `Client`, `ProjectTemplate`, `Milestone`, `ProjectFile`,
  `ActivityEvent`, `ProjectMember`. Routes `app/projects.*` (all, clients,
  templates, $id).
- **Future API needed**: CRUD projects, members, clients, templates, milestones;
  project activity feed; favorite toggle. Progress/openTasks/overdue counts must
  become **derived aggregates** (view or computed query), not stored columns.
- **Required tables**:
  - `projects` (key, name, description, client_id, manager_id, department,
    dates, priority, status, health, color, icon, repo/figma/api urls, jsonb
    environments, template_id, archived_at)
  - `project_members` (project_id, user_id, project_role)
  - `clients`, `project_templates`, `milestones`, `project_activity`
  - `project_files` → see Files module (Storage-backed).
- **Service layer**: `features/projects/api.ts` + `queries.ts`. Aggregate counts
  via a `project_stats` SQL view joining `tasks`.
- **Dependencies**: Authentication/RBAC, HR (`departments`, member profiles).
  **Tasks depend on this** — build Projects first.
- **Priority**: **P0 / Critical** — root entity; `projectId` is referenced by
  tasks, sprints, dependencies, time logs, reports, analytics.

## 7. Tasks 🟡 Mock — **P0**

- **Mock data location**: `features/tasks/{store.ts (465), mock-data.ts (319),
  types.ts (298)}` — richest store in the app: `Task` (with subtasks via
  `parentTaskId`), `Epic`, `TaskMilestone`, `ChecklistItem`, `TaskRelation`,
  `TaskActivity`, `TaskComment`, `SavedFilter`, favorites. Plus
  `features/kanban/store.ts` (board column settings + per-column ordering; reads
  tasks, never owns them). Routes `app/tasks.*` (all, kanban, time, $id).
- **Future API needed**: CRUD tasks/subtasks; status/assignee/priority mutations
  with activity logging; checklist, watchers, relations, favorites, saved filters;
  bulk operations; `next_ref(project_key)` sequence; soft-delete/archive/restore.
  Kanban: persist column config + ordering.
- **Required tables**: `tasks` (self-referential `parent_task_id`), `epics`,
  `task_milestones`, `task_checklist_items`, `task_watchers`, `task_relations`,
  `task_activity` (append-only), `saved_filters`, `task_favorites`,
  `kanban_settings`. (Comments/attachments live in their own modules — §10/§11.)
  A DB sequence/RPC for human refs (`ETB-142`).
- **Service layer**: `features/tasks/api.ts` + `queries.ts`; an `activity.ts`
  writer mirroring the current `logActivity`. Keep client-side `applyFilters`/sort
  or push to SQL for large datasets (virtualize per audit M7).
- **Dependencies**: Projects (P0). Consumed by Sprint, Time Tracking, Comments,
  Files, Daily Reports, Analytics, Kanban — so this is the highest-fan-out module.
- **Priority**: **P0 / Critical**.

## 8. Sprint 🟡 Mock — **P1**

- **Mock data location**: `features/sprints/{store.ts (166), mock-data.ts (50),
  types.ts}` — `Sprint` (planned/active/completed, goal, capacity). Sprint does
  **not** own tasks; tasks reference `sprintId`.
- **Future API needed**: CRUD sprints; set status; assign/remove tasks
  (mutate `tasks.sprint_id`); burndown/progress aggregates.
- **Required tables**: `sprints` (name, project_id, start/end, status, goal,
  capacity). Task↔sprint link is the existing `tasks.sprint_id` column.
- **Service layer**: `features/sprints/api.ts` + `queries.ts`. Burndown via a view
  over `tasks` grouped by `sprint_id` + `status`.
- **Dependencies**: Tasks (P0), Projects (P0).
- **Priority**: **P1 / High**.

## 9. Time Tracking 🟡 Mock — **P1**

- **Mock data location**: `features/time-tracking/{store.ts (188),
  mock-data.ts (96), types.ts}` — `TimeLog` (timer or manual, active when
  `endTime === null`), `ManualEntryInput`. Floating active timer in `AppShell`.
- **Future API needed**: start/stop timer (enforce one active timer per user),
  manual entry, edit/delete, list by task/user/range, aggregate totals per task
  and per day. RPC `start_timer` / `stop_timer` for atomicity.
- **Required tables**: `time_logs` (task_id, user_id, start_time, end_time,
  duration_minutes, description, source). Partial unique index to prevent two
  active timers per user.
- **Service layer**: `features/time-tracking/api.ts` + `queries.ts`. Realtime
  optional for the floating timer across tabs.
- **Dependencies**: Tasks (P0), Authentication.
- **Priority**: **P1 / High**.

## 10. Files 🔵 Mock — **P1**

Attachments appear in three places; unify on Supabase Storage.

- **Mock data location**:
  - `features/task-communication/types.ts` → `TaskFile` (uses blob `previewUrl` on
    fake upload), store `task-communication/store.ts`.
  - `features/tasks/types.ts` → `TaskAttachment`.
  - `features/projects/types.ts` → `ProjectFile`.
  - No real uploads anywhere; no Supabase Storage usage exists yet.
- **Future API needed**: signed upload/download, list by parent
  (task/project/comment), delete, metadata persistence. Storage bucket(s) with
  RLS-aligned path policies.
- **Required tables**: a unified `attachments` table (owner_type, owner_id,
  bucket, path, file_name, mime, kind, size, uploaded_by) backing all three
  surfaces, plus Supabase Storage buckets (`task-files`, `project-files`,
  `hr-documents`, `avatars`).
- **Service layer**: shared `features/files/api.ts` (upload/sign/delete) consumed
  by tasks, projects, comments, HR documents.
- **Dependencies**: Tasks, Projects, Comments, Company Hub; Authentication for
  signed URLs / RLS. **Net-new infra (Storage)** — provision buckets early.
- **Priority**: **P1 / High** (shared dependency of several P1/P2 modules).

## 11. Comments 🟡 Mock — **P1**

Threaded comments exist in three modules; consolidate the model.

- **Mock data location**:
  - `features/task-communication/{store.ts (265), types.ts}` → `TaskThreadComment`
    (threaded via `parentCommentId`, mentions, reactions, soft delete) +
    `TaskCommActivity`.
  - `features/tasks/types.ts` → simpler flat `TaskComment` (in tasks store).
  - `features/dependencies/types.ts` → `DependencyComment` (in dependencies store).
- **Future API needed**: create/edit/soft-delete comment, threaded replies,
  @mentions (fan out to Notifications), emoji reactions, activity log; list by
  parent entity.
- **Required tables**: one polymorphic `comments` table (parent_type, parent_id,
  author_id, body, parent_comment_id, jsonb mentions, deleted_at) +
  `comment_reactions` (comment_id, user_id, emoji). Retire the three divergent
  shapes.
- **Service layer**: shared `features/comments/api.ts` + `queries.ts`; mention
  parsing emits domain events for Notifications.
- **Dependencies**: Tasks, Dependencies; Notifications (mentions); Authentication
  (author/RLS). Files (comment attachments) optional.
- **Priority**: **P1 / High** — unify the model during migration to avoid three
  backends.

## 12. Analytics 🔵 Mock — **P3**

- **Mock data location**: `features/analytics/{mock-data.ts (221), types.ts,
  filters-context.tsx}` (`AnalyticsScope`, `TrendPoint`, `Insight`, `SavedReport`,
  `BenchmarkValue`); plus derived dashboards: `features/dashboard/mock-data.ts`
  (261), `features/manager/mock-data.ts` (290), `features/project-analytics/`
  (insights/utils). Routes `app/analytics.*` (executive, hr, team, saved).
- **Future API needed**: aggregate queries (trends, benchmarks WoW/MoM/QoQ,
  per-scope KPIs), insight generation, **saved reports CRUD**. Most outputs are
  read-only aggregations over other modules' tables.
- **Required tables**: minimal new storage — `saved_reports` (scope, filters,
  created_by). Everything else should be **SQL views / materialized views /
  Postgres functions** over `tasks`, `time_logs`, `work_sessions`, `daily_*`,
  `dependencies`, `projects`. Avoid storing derived numbers.
- **Service layer**: `features/analytics/api.ts` + `queries.ts` calling
  aggregate RPCs/views; keep `filters-context` as the client filter state.
- **Dependencies**: **Everything** — Tasks, Time Tracking, Attendance, Daily
  Reports, Projects, Dependencies. Build last so sources exist.
- **Priority**: **P3 / Medium-Low** — highest value but only meaningful once
  upstream data is real.

## 13. Notifications 🟡 Mock — **P2**

- **Mock data location**: `features/notifications/{store.ts (140),
  mock-data.ts (199), types.ts}` plus an in-memory engine:
  `event-bus.ts`, `automation-engine.ts`, `rules.ts`, `channels.ts`,
  `preferences.ts`, `directory.ts`, `bootstrap.ts`. `AppNotification`,
  `DomainEvent`, `AutomationRule`, `NotificationPreferences`, `DeliveryChannel`.
  Routes `app/notifications.*` (index, preferences).
- **Future API needed**: persist notifications + read/seen/dismiss lifecycle;
  per-user preferences CRUD; server-side rule evaluation that turns domain events
  (task assigned, comment mention, dependency blocked, report submitted, leave
  request) into notifications; delivery channels (in-app now; email/Slack later).
- **Required tables**: `notifications` (recipient_id, type, priority, lifecycle,
  jsonb payload, jsonb actions, seen_at, dismissed_at), `notification_preferences`
  (user_id, jsonb per-category channel matrix), optionally `automation_rules`.
- **Service layer**: `features/notifications/api.ts` + `queries.ts` +
  **Supabase Realtime** subscription for live delivery. The event-driven
  architecture (`event-bus`/`automation-engine`) maps cleanly to DB triggers or
  Edge Functions that insert notifications.
- **Dependencies**: nearly every module emits events (Tasks, Comments, Daily
  Reports, Dependencies, Company Hub/leave). Authentication for recipient
  resolution. **Net-new infra (Realtime + possibly Edge Functions)**.
- **Priority**: **P2 / High** — wire after Tasks/Comments/Daily Reports emit real
  events; provision Realtime alongside.

---

## Supporting module (not in the list but required)

**Dependencies** (`features/dependencies/{store.ts, mock-data.ts, types.ts}`) is
referenced by **Daily Reports** (checkin blockers, midday blocker links, EOD open
dependencies) and Analytics. It needs its own `dependencies`, `dependency_comments`
(fold into the unified `comments` table), and `dependency_activity` tables. Schedule
it in **P2 alongside Daily Reports**, since reports snapshot dependency state.

---

## Cross-Cutting Workstreams (do once, benefit everywhere)

1. **Adopt the `attendance` contract everywhere** — `api.ts` (Supabase) +
   `queries.ts` (`queryOptions` + key factory). Reduce each `store.ts` to an
   optional optimistic cache, not the source of truth.
2. **RLS on every table** — mirror `permissions.ts` intent; author-owns-write,
   manager/HR/owner elevated reads via `has_any_role`. Add a parity test so the UI
   matrix can't drift from policy.
3. **Provision net-new infra early**: Supabase **Storage** (Files, avatars, HR
   docs) and **Realtime** (Notifications, Attendance team board, live comments).
4. **Unify duplicated models during migration**: Comments (3 shapes → 1),
   Files/attachments (3 shapes → 1), `EmptyState` (per audit M1). Migrate to the
   unified backend shape rather than porting each mock 1:1.
5. **Derived data as views, not columns**: project progress, sprint burndown,
   analytics KPIs — compute in SQL, don't persist.
6. **Regenerate `integrations/supabase/types.ts`** after each migration; never
   hand-edit generated clients.
7. **Seed → fixtures**: move any still-needed seed data from `mock-data.ts` into
   SQL seed/migrations; delete `mock-data.ts` once a module is cut over.

## Recommended Sequence

```
P0  Projects ──► Tasks ──┐
                         ├─► P1  Sprint, Time Tracking, Comments, Files
                         │
P2  Dependencies ──► Daily Reports ──► Notifications
                         │
P3  Company Hub, Workspace, Analytics (reads everything — last)
```

*Authentication and Attendance are already live and act as the reference
implementations for every wave above.*
