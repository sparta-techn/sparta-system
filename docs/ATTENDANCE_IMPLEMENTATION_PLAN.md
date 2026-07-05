# SpartaFlow — Attendance & Daily Reports Implementation Plan

> Planning document only. **No application code or migration is written by this
> doc.** It specifies how to take the Attendance + Daily-Reports surface from its
> current state (Attendance live; the daily-report flows UI-only) to a fully
> backed, RLS-secured implementation that follows the patterns already
> established by the `auth` / `attendance` / `hr` modules.
> Snapshot date: 2026-06-30.

---

## 1. Scope

This plan covers the full employee day, end-to-end:

| # | Feature | Today | Target |
| --- | --- | --- | --- |
| 1 | **Attendance** | ✅ live (Supabase) | extend reads only |
| 2 | **Morning Check-in** | 🟡 UI + `localStorage` store | `daily_checkins` table + RPC |
| 3 | **Working Session** | ✅ live (part of Attendance) | no schema change |
| 4 | **Break Management** | ✅ live (part of Attendance) | no schema change |
| 5 | **Midday Status** | 🟡 UI + `localStorage` store | `midday_reports` table + RPC |
| 6 | **End-of-Day Report** | 🟡 UI store + scaffolded `ReportsService` | `eod_reports` table + RPC |
| 7 | **Dependency Requests** | 🟡 UI + in-memory mock | `dependencies` + activity table + RPC |
| 8 | **Daily Timeline** | ❌ not built | composite read (view + query) |
| 9 | **Manager Review** | 🟡 UI + mock-data | roll-up reads over the above |

Legend: ✅ live · 🟡 mock/UI-only · ❌ absent.

---

## 2. Current-state audit

**Live today (`attendance`)**
- Tables: `work_sessions`, `work_session_breaks`, `company_settings`, `holidays`.
- RPCs: `current_work_date`, `start_work_session`, `start_break`, `end_break`,
  `finish_work_session`.
- Data path: `features/attendance/api.ts` (typed `supabase` calls) →
  `features/attendance/queries.ts` (`queryOptions` + `attendanceKeys`) →
  `services/attendance/attendance.service.ts` (`AttendanceService extends BaseService`)
  → `repositories/attendance.repository.ts` (`AttendanceRepository`).
- RLS: self-read + manager/HR/owner-read; **no direct writes** (RPC-only).
- Realtime: both tables in `supabase_realtime`.

**Service / repository pattern in place**
- `services/core/base-service.ts` — generic `BaseService<Row, Insert, Update>`
  (list/paginate/getById/create/update/upsert/remove/count) over the relaxed
  `db` client (`services/core/client.ts`) so services can target tables not yet
  in generated `types.ts`.
- Each domain: `XService extends BaseService` (singleton) → `XRepository`
  wraps the service singleton (singleton). See `reports.service.ts` +
  `report.repository.ts` for the already-scaffolded EOD shell.

**Mock-only today**
- `features/checkin` — `store.ts` over `localStorage`, keyed per work date.
  Types: `CheckInDraft` / `CheckInSubmission`. No service/repository/table.
- `features/midday` — `store.ts`, `MiddayDraft` / `MiddaySubmission`. No backend.
- `features/eod` — `store.ts` UI; **but** `ReportsService` + `ReportRepository`
  already exist targeting a future `eod_reports` table.
- `features/dependencies` — `store.ts` is **in-memory only** (lost on refresh).
  Types define the full state machine + activity. No backend.
- `features/manager` — `mock-data.ts` only; pure presentation.

**Issues this plan must resolve**
1. **Column-casing mismatch (EOD):** `ReportsService` declares `userId`,
   `sessionId`, `workDate` (camelCase) but DB convention is snake_case
   (`user_id`, `session_id`, `work_date`). → §8 reconciles by switching the
   service row/insert types to snake_case and mapping in the feature `api.ts`.
2. **No check-in / midday service or repository** exists. → §6, §9 add them.
3. **Dependencies persistence** is in-memory. → §10 lands a real table.
4. **Daily Timeline & Manager roll-ups** read from many tables; they should be
   DB **views** (per DATABASE_DESIGN §20 "derived numbers are views").

---

## 3. Conventions (inherited — every new object follows these)

From the live migrations + `docs/DATABASE_DESIGN.md` / `docs/DB_RULES.md`:

- `uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `created_at` / `updated_at timestamptz NOT NULL DEFAULT now()`;
  `BEFORE UPDATE` trigger `public.tg_set_updated_at()`.
- Identity FKs → `auth.users(id)` / `profiles(id)`; `CASCADE` for owned rows,
  `SET NULL` for soft refs.
- `ENABLE ROW LEVEL SECURITY` on **every** table, in the same migration.
- Authorization via `public.has_role` / `public.has_any_role` /
  `public.has_permission`. Add `public.can_review_reports(uid)` helper (§13).
- Grants to `authenticated` (+ `service_role`), **never `anon`**.
- **Validated/atomic writes go through `SECURITY DEFINER` RPCs**, not direct
  INSERT/UPDATE grants — the `start_work_session` pattern. Reports & dependency
  state transitions qualify.
- Denormalize `user_id` / `work_date` onto child rows for cheap RLS.
- Soft-delete via `deleted_at`; never hard-delete user content.
- Add live-collaboration tables to `supabase_realtime`.
- Derived numbers (timeline, compliance, roll-ups) are **views**.
- Regenerate `src/integrations/supabase/types.ts` after each migration; never
  hand-edit it or `routeTree.gen.ts`.

**Code-layer contract (mirror Attendance for each new feature):**

```
features/<f>/types.ts      domain types (+ map to Row types)
features/<f>/api.ts        typed supabase calls / RPCs  (replaces store.ts)
features/<f>/queries.ts    queryOptions factories + <f>Keys key hierarchy
services/<f>/<f>.service.ts  XService extends BaseService  (singleton)
repositories/<f>.repository.ts  XRepository wraps service  (singleton)
features/<f>/components/*   unchanged React surface (consume query hooks)
```

The `store.ts` localStorage modules are **retired** (or demoted to draft-only
client cache); components switch from `useTodaySubmission()` selectors to
`useQuery(queries)` + `useMutation` hooks with the same shape.

---

## 4. Build order

Aligns with DATABASE_DESIGN "P2" wave (daily reports + dependencies sit on top
of the live attendance schema).

1. **Wave A — shared enums + helpers** (one migration): `report_mood`,
   `task_progress_state`, `eod_outlook`, `dependency_state`, `dependency_type`,
   `priority_level`; helper `can_review_reports(uid)`,
   `can_access_dependency(uid, dep_id)`.
2. **Wave B — Daily Reports**: `daily_checkins`, `midday_reports`, `eod_reports`
   (+ submit/update RPCs). Wire check-in → midday → eod feature modules.
3. **Wave C — Dependencies**: `dependencies` + `dependency_activity`
   (+ `set_dependency_state` RPC). Reuse polymorphic `comments` if landed, else
   a local `dependency_comments` table (see §10 note).
4. **Wave D — Read models**: `daily_timeline` view, `report_compliance` view,
   `manager_team_today` view. Wire Daily Timeline + Manager Review.

Every table ships RLS + policies in the migration that creates it.

---

## 5. Feature 1 — Attendance  *(extend reads only)*

Already live; **no schema change**. This section records the contract so the
report features can reference the session.

- **Database**: `work_sessions` (one per `(user_id, work_date)`),
  `work_session_breaks`, `company_settings`, `holidays`. Unchanged.
- **APIs** (`features/attendance/api.ts`): `getCompanySettings`,
  `getCurrentWorkDate`, `getTodaySession`, `startWork`, `startBreak`,
  `endBreak`, `finishWork`, `getAttendanceHistory`, `getTeamToday`.
- **Services**: `AttendanceService` — `clockIn/clockOut/startBreak/endBreak`,
  `getTodaySession`, `getHistory`, `getTeamToday`, `getCompanySettings`,
  `getCurrentWorkDate`.
- **Repositories**: `AttendanceRepository` (delegates 1:1).
- **UI flow**: `today-status-card` (clock-in/out, break toggle, live timer via
  `use-timer`), `team-today-grid`, `attendance-history-table`,
  `finish-summary-dialog`. Reminders via `use-attendance-reminders`.
- **Validation**: server-side in RPCs (work-date rollover, late calc, single
  session per day via `UNIQUE`, break/finish state guards). Client: disable
  actions per `session_status`.
- **Permissions**: self read+act; managers/HR/owner read team
  (`has_any_role(owner, super_admin, hr, project_manager, team_lead)`).

**New work for this plan:** expose the `session_id` of the current work session
to the report features so `daily_checkins.session_id` / `eod_reports.session_id`
can be set. Add a thin `useCurrentSessionId()` derived from `todaySessionQuery`.

---

## 6. Feature 2 — Morning Check-in

Plans the day right after clock-in. One per `(user_id, work_date)`.

### Database — `public.daily_checkins` 🆕
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid NOT NULL | → `auth.users(id)` CASCADE (denormalized) |
| work_date | date NOT NULL | from `current_work_date()` |
| session_id | uuid | → `work_sessions(id)` SET NULL |
| mood | report_mood | `excellent…difficult` |
| mood_note | text | |
| main_goal | text | |
| priorities | jsonb | `[{title, level, effort}]` (`PriorityItem[]`) |
| task_ids | uuid[] | planned tasks (future ClickUp/tasks refs) |
| blockers | jsonb | `[{kind, label, note}]` (`BlockerItem[]`) |
| help_request | jsonb | `HelpRequest` shape |
| submitted_at | timestamptz | set by RPC |
| created_at / updated_at | timestamptz | trigger |
| | | UNIQUE `(user_id, work_date)` |

- Indexes: `(user_id, work_date DESC)`, `(work_date)`.
- Enum `report_mood`: `excellent, good, okay, stressed, difficult` (mirrors
  `checkin/types.ts` `Mood`).
- RLS: author read+write own; reviewers read team (`can_review_reports`).
- Write: **RPC `submit_checkin(_payload jsonb)`** (SECURITY DEFINER) — resolves
  `auth.uid()` + `current_work_date()`, links the active `work_sessions.id`,
  upserts on `(user_id, work_date)`, stamps `submitted_at`. **RPC
  `update_checkin(_id, _payload)`** enforces the 30-min edit window
  (`EDIT_WINDOW_MINUTES`) server-side.

### APIs — `features/checkin/api.ts` (replaces `store.ts`)
- `getTodayCheckin(userId): Promise<DailyCheckinRow | null>`
- `submitCheckin(draft: CheckInDraft): Promise<DailyCheckinRow>` → `rpc('submit_checkin')`
- `updateCheckin(id, draft): Promise<DailyCheckinRow>` → `rpc('update_checkin')`
- `listCheckinsByDate(workDate)` (manager roll-up)

### Queries — `features/checkin/queries.ts`
`checkinKeys = { all, today(userId), byDate(date), history(userId) }`;
`todayCheckinQuery(userId)` (`staleTime 15s`), `checkinsByDateQuery(date)`.

### Services — `services/reports/checkin.service.ts`
`CheckinService extends BaseService<DailyCheckinRow, DailyCheckinInsert, DailyCheckinUpdate>`
`table='daily_checkins'`. Methods: `submit`, `update`, `getToday(userId)`,
`listByUser`, `listByDate(workDate)`.

### Repositories — `repositories/checkin.repository.ts`
`CheckinRepository` wraps `checkinService`: `submit`, `update`,
`getToday`, `listByDate`, `listByUser`.

### UI flow
`check-in-widget` (dashboard entry) → `check-in-wizard` (mood → priorities →
tasks → blockers → help) → `check-in-summary`. Wizard `onSubmit` calls a
`useSubmitCheckin()` mutation (invalidates `checkinKeys.today`). `check-in.tsx`
route renders summary or wizard based on `todayCheckinQuery`. Drafts may stay in
`localStorage` (autosave) but the **submission** is server-side.

### Validation
- `zod` schema `checkInDraftSchema` (mood required, ≥1 priority, help_request
  conditional fields) at the mutation boundary before `submit`.
- DB: `UNIQUE(user_id, work_date)` blocks double-submit; RPC validates edit
  window + ownership.

### Permissions
- Submit/update: self only (`reports:write`; employee has it).
- Read own: author. Read team: `can_review_reports` (owner, super_admin, hr,
  project_manager, team_lead → `reports:read`).

---

## 7. Feature 3 — Working Session  *(part of Attendance — no schema change)*

The "working" portion of `work_sessions` between clock-in and clock-out.

- **Database**: `work_sessions.session_status ∈ {working, on_break, finished}`,
  `working_seconds`, `started_at`, `overtime_seconds`. No new table.
- **APIs / Services / Repositories**: `startWork` / `finishWork` →
  `AttendanceService.clockIn/clockOut` → `AttendanceRepository`. Unchanged.
- **UI flow**: `today-status-card` live timer (`use-timer`, `use-now`); floating
  timer in `AppShell`. Finish → `finish-summary-dialog` (which should prompt the
  EOD report — see §8 linkage).
- **Validation**: server RPC guards (`'Cannot finish a session that never
  started'`, already-finished). Late/overtime computed in `finish_work_session`.
- **Permissions**: self act; managers read.

**Linkage added by this plan:** `finish_work_session` stays the source of truth
for hours; `eod_reports.session_summary` reads those numbers (don't recompute on
the client).

---

## 8. Feature 4 — Break Management  *(part of Attendance — no schema change)*

- **Database**: `work_session_breaks` (`session_id`, `user_id`, `started_at`,
  `ended_at`, `duration_seconds`); partial index on open breaks; `break_seconds`
  aggregated onto `work_sessions` at finish. No new table.
- **APIs / Services / Repositories**: `startBreak` / `endBreak` →
  `AttendanceService.startBreak/endBreak` → repository. Unchanged.
- **UI flow**: break toggle in `today-status-card`; `session_status` flips
  `working ↔ on_break`; max-break warning from `company_settings.max_break_minutes`.
- **Validation**: RPC guards (`'Already on break'`, `'Not currently on break'`,
  `'Start work before taking a break'`). Client surfaces remaining break budget.
- **Permissions**: self act; managers read.

---

## 9. Feature 5 — Midday Status

Progress pulse mid-workday. One per `(user_id, work_date)`.

### Database — `public.midday_reports` 🆕
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid NOT NULL | CASCADE (denormalized) |
| work_date | date NOT NULL | |
| session_id | uuid | → `work_sessions(id)` SET NULL |
| progress | int | 0–100 (multiples of 10) `CHECK (progress BETWEEN 0 AND 100)` |
| task_progress | jsonb | `TaskProgressEntry[]` (id + **title snapshot** + state) |
| current_focus | text | |
| blocker_links | jsonb | `BlockerLink[]` — dependency id + title snapshot |
| new_blocker_notes | text | inline free-text blocker |
| help_request | jsonb | `HelpRequest` |
| outlook | eod_outlook | `on_track…need_manager_help` |
| submitted_at | timestamptz | |
| created_at / updated_at | timestamptz | trigger |
| | | UNIQUE `(user_id, work_date)` |

- Indexes: `(user_id, work_date DESC)`, `(work_date)`.
- Enum `task_progress_state`: `completed, partial, not_started`.
- Enum `eod_outlook`: `on_track, need_more_time, blocked, need_manager_help`.
- Write: **RPC `submit_midday_report(_payload jsonb)`** + `update_midday_report`.
- RLS / permissions: identical to check-in (§6).

### APIs — `features/midday/api.ts`
`getTodayMidday(userId)`, `submitMidday(draft)`, `updateMidday(id, draft)`,
`listMiddayByDate(workDate)`.

### Queries — `features/midday/queries.ts`
`middayKeys`; `todayMiddayQuery(userId)`, `middayByDateQuery(date)`.

### Services / Repositories
`services/reports/midday.service.ts` →
`MiddayService extends BaseService<MiddayReportRow, …>` `table='midday_reports'`.
`repositories/midday.repository.ts` → `MiddayRepository` wraps it
(`submit/update/getToday/listByDate`).

### UI flow
`midday-reminder` (nudge) → `midday-widget` → `midday-wizard` (progress slider →
task progress → blockers/links → outlook → help) → `midday-summary`. `midday.tsx`
route gates on `todayMiddayQuery`. `manager-midday-overview` consumes
`middayByDateQuery`. **Blocker links** pull from the Dependencies query (§10) so
the picker shows live dependencies.

### Validation
- `zod` `middayDraftSchema`: `progress` 0–100 step 10, `outlook` required,
  `taskProgress` entries well-formed. DB `CHECK` + `UNIQUE`.

### Permissions
Self submit/update (`reports:write`); team read via `can_review_reports`.

---

## 10. Feature 6 — End-of-Day Report

Closes the day; one per Work Session. Service shell already exists — this plan
**reconciles its column casing** and adds the migration + RPCs.

### Database — `public.eod_reports` 🆕
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid NOT NULL | CASCADE |
| work_date | date NOT NULL | |
| session_id | uuid | → `work_sessions(id)` SET NULL |
| summary | text | `≤ 500` (`SUMMARY_MAX_LENGTH`) |
| completed | jsonb | `TaskProgressEntry[]` |
| in_progress | jsonb | `InProgressItem[]` |
| open_dependencies | jsonb | `OpenDependencyEntry[]` (id + title snapshot) |
| need_from_others | jsonb | `NeedFromOthersItem[]` |
| tomorrow_plan | jsonb | `TomorrowPlan` |
| reflection | jsonb | `DailyReflection` |
| session_summary | jsonb | `WorkSessionSummary` snapshot from `work_sessions` |
| submitted_at | timestamptz | |
| created_at / updated_at | timestamptz | trigger |
| | | UNIQUE `(user_id, work_date)` |

- Indexes: `(user_id, work_date DESC)`, `(work_date)`.
- Write: **RPC `submit_eod_report(_payload jsonb)`** — reads
  `work_sessions` (worked/break minutes, check-in/out) to populate
  `session_summary` server-side; `update_eod_report` enforces edit window.
  Submitting an EOD may surface checkout (does **not** auto-finish the session;
  keep them decoupled — the `finish-summary-dialog` offers EOD as the next step).

### Reconciliation of the existing scaffold
`services/reports/reports.service.ts` currently uses `userId/sessionId/workDate`
(camelCase) and `defaultOrderBy='workDate'`. Change to snake_case
(`user_id/session_id/work_date`) to match the migration; update
`EodReportRow/Insert/Update` and `getBySession`/`listByUser`/`listByDate`
filters accordingly. `ReportRepository` needs no signature change. The
feature-level `EodDraft → EodReportInsert` mapping moves into
`features/eod/api.ts`.

### APIs — `features/eod/api.ts`
`getTodayEod(userId)`, `getEodBySession(sessionId)`, `submitEod(draft, sessionId)`,
`updateEod(id, draft)`, `listEodByDate(workDate)`, `listEodByUser(userId)`.

### Queries — `features/eod/queries.ts`
`eodKeys`; `todayEodQuery`, `eodHistoryQuery(userId)`, `eodByDateQuery(date)`.

### Services / Repositories
`ReportsService` (rename-friendly) / `ReportRepository` — already present;
keep `eod_reports` binding, fix casing, add `getToday(userId)`.

### UI flow
`eod-widget` → `eod-wizard` (summary → completed → in-progress → open deps →
need-from-others → tomorrow plan → reflection; `session_summary` shown read-only
from attendance) → `eod-summary`. `eod.index.tsx` gates on `todayEodQuery`;
`eod.history.tsx` uses `eodHistoryQuery`. `manager-eod-overview` uses
`eodByDateQuery`.

### Validation
`zod` `eodDraftSchema`: `summary ≤ 500`, arrays well-formed,
`needFromOthers[].department ∈ NEED_DEPARTMENTS`. DB `UNIQUE` + RPC edit window.

### Permissions
Self submit/update (`reports:write`); team read via `can_review_reports`.

---

## 11. Feature 7 — Dependency Requests

Cross-team request/blocker entity referenced by check-in / midday / eod. Land a
real table (currently in-memory). Mirrors DATABASE_DESIGN §16.

### Database — `public.dependencies` 🆕 + `public.dependency_activity` 🆕
**`dependencies`**
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | (UI shows `DEP-####`; expose a `ref` text via counter RPC if needed) |
| title / description | text | title NOT NULL |
| type | dependency_type | |
| priority | priority_level | `low, medium, high, critical` |
| state | dependency_state | default `pending` |
| requester_id | uuid NOT NULL | → profiles |
| owner_id | uuid | → profiles SET NULL |
| department_id | uuid | → departments SET NULL |
| project_id | uuid | → projects SET NULL (when Projects lands) |
| related_task_id | uuid | → tasks SET NULL (nullable until Tasks lands) |
| tags | text[] | |
| due_at / resolved_at | timestamptz | |
| created_at / updated_at | timestamptz | trigger |

- Indexes: `(state)`, `(requester_id)`, `(owner_id)`, `(department_id)`,
  `(project_id)`, GIN `(tags)`.
- Enum `dependency_state` (9): `draft, pending, accepted, in_progress, blocked,
  resolved, rejected, cancelled, closed`. Enum `dependency_type` (13) and
  `priority_level` (4) per `dependencies/types.ts`.

**`dependency_activity`** (append-only): `id, dependency_id → dependencies CASCADE,
actor_id → profiles SET NULL, kind text, meta jsonb, at timestamptz`.

**Comments**: reuse the polymorphic `comments` table (`parent_type='dependency'`)
when it lands; until then, a local `dependency_comments
(id, dependency_id, author_id, body, parent_id, mentions uuid[], is_status_update,
created_at)` keeps `dep-comments.tsx` working. Pick one in §14.

- Write: **RPC `set_dependency_state(_id, _new_state)`** (SECURITY DEFINER)
  validating the transition map (e.g. `pending→accepted/rejected`,
  `accepted→in_progress`, `in_progress→blocked/resolved`, …) and appending to
  `dependency_activity`; sets `resolved_at` on resolve/close. Creation/priority
  via guarded INSERT/UPDATE (RLS) + activity trigger, or companion RPCs.
- Realtime: add `dependencies` to `supabase_realtime` (kanban board).

### APIs — `features/dependencies/api.ts` (replaces in-memory `store.ts`)
`listDependencies(filters)`, `getDependency(id)`, `createDependency(input)`,
`setDependencyState(id, state)` → `rpc('set_dependency_state')`,
`setDependencyPriority(id, priority)`, `addComment(id, body, parentId)`.

### Queries — `features/dependencies/queries.ts`
`dependencyKeys = { all, list(filters), detail(id), board() }`;
`dependenciesQuery(filters)`, `dependencyQuery(id)`.

### Services — `services/dependencies/dependencies.service.ts`
`DependenciesService extends BaseService<DependencyRow, …>` `table='dependencies'`
+ `setState`, `setPriority`, `addComment`, `listForBoard`, `listForUser`.

### Repositories — `repositories/dependency.repository.ts`
`DependencyRepository` wraps the service singleton.

### UI flow
`dep-create-dialog` → list/board: `dep-table`, `dep-kanban` (columns =
`KANBAN_COLUMNS`), `dep-card`, `dep-filters`, `dep-widgets`; detail
`dependencies.$id.tsx` with `dep-timeline` (activity) + `dep-comments`.
`dependencies.manager.tsx` for the manager view. `useDependencies()` selector
becomes `useQuery(dependenciesQuery)`.

### Validation
`zod` `dependencyCreateSchema` (title required, valid `type`/`priority`,
owner/department references). State transitions validated **server-side** in
`set_dependency_state` (single source of truth) — client `utils.ts`
(`isOpen`/`isOverdue`) stays for display only.

### Permissions
- Read: requester, owner, same-department, or reviewers (`can_access_dependency`).
- Create: any `authenticated` (`reports:write` employee can raise a blocker).
- State/priority write: requester, owner, or admins.

---

## 12. Feature 8 — Daily Timeline

A unified chronological view of one person's day (clock-in, check-in submitted,
breaks, midday, dependencies raised/resolved, EOD). **Read-only composite** — no
new base table.

### Database — `public.daily_timeline` 🆕 (view)
`UNION ALL` of event rows keyed `(user_id, work_date)` over:
`work_sessions` (clock-in/out), `work_session_breaks` (break start/end),
`daily_checkins.submitted_at`, `midday_reports.submitted_at`,
`eod_reports.submitted_at`, `dependency_activity` (created/resolved by actor).
Columns: `user_id, work_date, at timestamptz, kind text, title text,
ref_type text, ref_id uuid`. Ordered by `at`.

- RLS: views inherit base-table RLS (each underlying table already self/manager
  scoped), so the timeline is automatically self + manager-visible. Add
  `security_invoker = true` so caller's RLS applies.

### APIs / Queries
`features/dashboard` (or a small `features/timeline`) `api.ts`:
`getDailyTimeline(userId, workDate)`; `queries.ts` `timelineQuery(userId, date)`.

### Services / Repositories
Optional thin `TimelineService extends BaseService` bound to the view (read-only;
override mutations to throw), or fold into `AttendanceRepository.getTimeline()`.

### UI flow
New `daily-timeline` component on the employee dashboard + the manager
`employee-drawer`; renders the ordered events with per-`kind` icons. Read-only.

### Validation / Permissions
No writes. Read = self or `can_review_reports` (inherited from base tables).

---

## 13. Feature 9 — Manager Review

Team-wide roll-up the manager uses to review attendance + reports + blockers.
Read models over the report tables; **no employee data is duplicated**.

### Database — views 🆕
- `public.report_compliance` — per `(user_id, work_date)`: booleans
  `checked_in`, `midday_done`, `eod_done` (LEFT JOINs of the three report tables
  onto `work_sessions`) for the compliance grid.
- `public.manager_team_today` — `work_sessions` for `current_work_date()` joined
  to `profiles` + today's check-in mood/outlook + open-dependency counts.
- Reuse `daily_timeline` (§12) inside the employee drawer.
- Helper `public.can_review_reports(uid)` SECURITY DEFINER:
  `has_any_role(uid, ARRAY['owner','super_admin','hr','project_manager','team_lead'])`
  — single source for every report-read policy above.

### APIs / Queries — `features/manager/api.ts` (replaces `mock-data.ts`)
`getTeamToday()` (extends attendance team query), `getReportCompliance(date)`,
`getTeamBlockers()` (open dependencies), `getTeamReports(date)`. `queries.ts`:
`managerKeys`, `teamComplianceQuery(date)`, `teamBlockersQuery()`.

### Services / Repositories
`services/manager/manager.service.ts` reading the views (`BaseService` bound to
each view, read-only) → `repositories/manager.repository.ts`. Where it just
re-reads attendance/report/dependency data, **compose existing repositories**
rather than duplicating queries.

### UI flow
`manager.tsx` route assembles: `attendance-overview`, `report-compliance`
(`teamComplianceQuery`), `blockers-panel` (`teamBlockersQuery`), `team-health`,
`team-status-board`, `live-activity-feed` (timeline/realtime), `employee-drawer`
(per-person check-in/midday/eod + `daily-timeline`). All read-only roll-ups.

### Validation / Permissions
- Read-only. Gate the whole route + queries on `can_review_reports` /
  `hasAnyRole([...managers])`; wire `reports:read` into the sidebar entry.
- Manager **cannot** edit an employee's report (no write path exposed). Any
  manager action (e.g. nudging) is a separate notification, out of scope here.

---

## 14. Cross-cutting concerns

**RPC inventory to add** (all `SECURITY DEFINER`, `search_path=public`, execute
revoked from `anon`/`public`, granted to `authenticated`):
`submit_checkin`, `update_checkin`, `submit_midday_report`,
`update_midday_report`, `submit_eod_report`, `update_eod_report`,
`set_dependency_state` (+ optional `create_dependency`, `set_dependency_priority`).
Each resolves `auth.uid()` + `current_work_date()`, enforces ownership + the
30-minute edit window, and stamps `submitted_at`. This keeps the
`work_sessions` RPC-only mutation pattern consistent across daily reports.

**Validation (zod) boundary**: one schema per draft in
`features/<f>/validation.ts`, applied in the mutation/`api.ts` before the RPC
call (DATABASE_DESIGN / ARCHITECTURE §15.7 "input validation on writes"). DB
`CHECK` + `UNIQUE` are the backstop.

**Realtime**: add `dependencies` to `supabase_realtime`; the report tables are
fetch-on-demand (no realtime needed). Manager `live-activity-feed` may subscribe
to `dependencies` + `work_sessions` (already published).

**Permissions matrix (summary)**

| Action | Roles |
| --- | --- |
| Submit/edit own check-in / midday / eod | self (`reports:write`) |
| Read own reports | self |
| Read team reports / compliance / timeline | `can_review_reports` = owner, super_admin, hr, project_manager, team_lead (`reports:read`) |
| Raise a dependency | any authenticated |
| Change dependency state/priority | requester, owner, admins |
| Read dependency | requester, owner, same-dept, reviewers |
| Edit company attendance settings | owner, super_admin, hr |

Keep `features/auth/permissions.ts` in lockstep with the seeded
`role_permissions` table (the HR migration already seeded `reports:read` /
`reports:write`).

**Realtime/edit-window note**: `EDIT_WINDOW_MINUTES = 30` currently lives in the
checkin store; move the canonical value server-side (RPC) and keep the client
constant only for UI affordance (disable "Edit" past the window).

---

## 15. Migration plan (files, in order)

Mirror the existing naming (`<timestamp>_<slug>.sql`); each file is
self-contained (tables + indexes + RLS + policies + triggers + RPCs + grants):

1. `…_daily_reports_enums_and_helpers.sql` — enums (`report_mood`,
   `task_progress_state`, `eod_outlook`) + `can_review_reports(uid)`.
2. `…_daily_checkins.sql` — table + RLS + `submit_checkin` / `update_checkin`.
3. `…_midday_reports.sql` — table + RLS + `submit_midday_report` / `update_*`.
4. `…_eod_reports.sql` — table + RLS + `submit_eod_report` / `update_eod_report`.
5. `…_dependencies.sql` — `dependency_state`/`dependency_type`/`priority_level`
   enums, `dependencies` + `dependency_activity` (+ `dependency_comments` or
   reuse `comments`), `set_dependency_state`, realtime publication,
   `can_access_dependency(uid, dep_id)`.
6. `…_daily_read_models.sql` — `daily_timeline`, `report_compliance`,
   `manager_team_today` views (`security_invoker = true`).

After **each** migration: regenerate `src/integrations/supabase/types.ts`.

---

## 16. Open decisions (resolve before coding)

1. **Dependency comments**: reuse the planned polymorphic `comments` table, or
   ship a local `dependency_comments` now and migrate later? (Recommend local
   now; the Dependencies module is needed before the cross-cutting comments
   table lands.)
2. **EOD ↔ checkout coupling**: keep `finish_work_session` and `submit_eod_report`
   independent (recommended), or require EOD before checkout? Affects
   `finish-summary-dialog` flow.
3. **`task_ids` / `related_task_id` typing**: `uuid[]` now (forward-compatible
   with the future `tasks` table) vs. `text[]` for current ClickUp-style refs.
   (Recommend `uuid[]` nullable; tolerate empty until Tasks lands.)
4. **Draft persistence**: keep autosave drafts in `localStorage` (offline-friendly)
   while submissions go server-side, or move drafts to the DB too? (Recommend
   localStorage drafts + server submissions.)
5. **Timeline/manager roll-ups**: plain views (simplest, recommended) vs.
   materialized views refreshed on schedule (only if perf demands).

---

*This plan is derived from the live `auth`/`attendance`/`hr` migrations, the
existing service/repository layer (`BaseService`, `*.service.ts`,
`*.repository.ts`), the feature `types.ts`/`store.ts` modules, and
`docs/DATABASE_DESIGN.md` §7, §15, §16. It changes no application code.*
