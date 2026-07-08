# SpartaFlow — Attendance & Daily Reports Backend (Services + Repositories)

> Reference for the backend data layer over the migration-`20260630130000`
> tables (`attendance`, `attendance_sessions`, `break_sessions`,
> `daily_reports`, `daily_status_updates`, `dependency_requests`,
> `attendance_events`). **UI is not yet connected** — these are the service +
> repository singletons the hooks/routes will call next.
> Snapshot date: 2026-06-30.

---

## 1. Layering

Same two-tier boundary the rest of the app uses (`docs/SERVICES.md`,
`docs/REPOSITORIES.md`):

```
Component / hook / TanStack Query
        │  (calls a repository singleton)
        ▼
Repository  ──  domain verbs, multi-table orchestration
        │  (composes one or more services)
        ▼
Service (extends BaseService)  ──  one table each, CRUD + finders
        │  (relaxed `db` client — tables not yet in generated types)
        ▼
Supabase (RLS enforced)
```

- **Services** extend `BaseService<Row, Insert, Update>` (`services/core`).
  They bind to one table and add table-specific finders. Because these tables
  are not yet in the generated `Database` types, the services run on the relaxed
  `db` client (`services/core/client.ts`) — exactly as documented for
  projects/tasks/etc.
- **Repositories** are the domain-facing API. The attendance repository
  _orchestrates_ four services into lifecycle verbs; the report repositories are
  thin intention-revealing wrappers.
- Every singleton is exported lower-camel (`attendanceRecordsService`); import
  the singleton, not the class.

### Coexistence with the legacy attendance/report modules

These tables run **parallel** to the live `work_sessions` / `work_session_breaks`
/ `eod_reports` schema. To avoid name clashes, the new repositories live in their
own folders and are **not** re-exported from the root `@/repositories` barrel —
the same convention the HR repositories use:

| Concern           | New (this doc)                                                             | Legacy (unchanged)                                  |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Import path       | `@/repositories/attendance`, `@/repositories/reports`                      | `@/repositories`                                    |
| Attendance tables | `attendance`, `attendance_sessions`, `break_sessions`, `attendance_events` | `work_sessions`, `work_session_breaks` (RPC-backed) |
| Report tables     | `daily_reports`, `daily_status_updates`, `dependency_requests`             | `eod_reports`                                       |

Services use distinct class names (`AttendanceRecordsService`,
`DailyReportsService`, …) so they coexist in the root `@/services` barrel.

---

## 2. Services

### Attendance — `@/services/attendance`

| Service / singleton                                       | Table                 | Key methods (beyond inherited CRUD)                                                                                    |
| --------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AttendanceRecordsService` / `attendanceRecordsService`   | `attendance`          | `getByDate(userId, workDate)`, `ensureForDate(userId, workDate, seed?)`, `listByUser`, `listByDate`                    |
| `AttendanceSessionsService` / `attendanceSessionsService` | `attendance_sessions` | `getActive(userId, workDate)`, `listByAttendance`, `listByUser`                                                        |
| `BreakSessionsService` / `breakSessionsService`           | `break_sessions`      | `getOpenBreak(sessionId)`, `listBySession`, `listByAttendance`                                                         |
| `AttendanceEventsService` / `attendanceEventsService`     | `attendance_events`   | `log(event)`, `listByAttendance`, `listByUser` — **append-only**: `update`/`upsert`/`remove` reject with `append_only` |

### Reports — `@/services/reports`

| Service / singleton                                       | Table                  | Key methods                                                                                               |
| --------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `DailyReportsService` / `dailyReportsService`             | `daily_reports`        | `submit(input)` (idempotent), `getByDate`, `getBySession`, `listByUser`, `listByDate`                     |
| `StatusUpdatesService` / `statusUpdatesService`           | `daily_status_updates` | `submit(input)` (idempotent on `(user, date, kind)`), `getByKind`, `listByUser`, `listByDate(date, kind)` |
| `DependencyRequestsService` / `dependencyRequestsService` | `dependency_requests`  | `setState`, `setPriority`, `setOwner`, `listOpen`, `listByState/Requester/Owner/Department`               |

`submit(...)` on both report services is **idempotent**: it updates the existing
row for the day (or `(day, kind)`) if present, else inserts — stamping
`submitted_at` (and `status='submitted'` for daily reports).

---

## 3. Repositories

### `@/repositories/attendance` — `AttendanceRepository` / `attendanceRepository`

Orchestrates the four attendance services into the lifecycle verbs. Resolves the
company-timezone work date via the existing `current_work_date` RPC when the
caller omits `workDate`.

| Verb            | Signature                                                                            | What it does                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Check-in**    | `checkIn(userId, context?, workDate?)` → `AttendanceSession`                         | ensure `attendance` row → set `first_check_in_at` → open `attendance_sessions` (`working`) → log `clock_in`                                                        |
| **Check-out**   | `checkOut(userId, workDate?)` → `AttendanceRecord`                                   | close any open break → close active session (`finished`, `duration_seconds`) → accumulate `worked_seconds`/`break_seconds` + `last_check_out_at` → log `clock_out` |
| **Break Start** | `startBreak(userId, reason?, workDate?)` → `BreakSession`                            | open `break_sessions` → flip session to `on_break` → log `break_start`                                                                                             |
| **Break End**   | `endBreak(userId, workDate?)` → `BreakSession`                                       | close open break (`duration_seconds`) → flip session to `working` → log `break_end`                                                                                |
| Reads           | `getDay(userId, workDate?)` → `AttendanceDay`, `getActiveSession(userId, workDate?)` | snapshot (record + sessions + breaks); current open session                                                                                                        |

Guards throw `ServiceError` with stable codes: `no_active_session`,
`already_on_break`, `not_on_break`.

### `@/repositories/reports`

| Repository / singleton                                        | Backs                                    | Verbs                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusUpdateRepository` / `statusUpdateRepository`           | **Morning Check-in** + **Midday Status** | `submitCheckin(payload)`, `getCheckin(userId, date)`, `submitMidday(payload)`, `getMidday(userId, date)`, `update(id, patch)`, `listCheckinsByDate`, `listMiddayByDate`, `listByUser`                                                             |
| `DailyReportRepository` / `dailyReportRepository`             | **End-of-Day Report**                    | `submit(report)`, `update`, `getByDate`, `getBySession`, `getById`, `listByUser`, `listByDate`, `remove`                                                                                                                                          |
| `DependencyRequestRepository` / `dependencyRequestRepository` | **Dependency Requests**                  | `create`, `update`, `get`/`getOrThrow`, `listOpen`/`listForRequester`/`listForOwner`/`listForDepartment`/`listByState`, `setState`/`setPriority`/`assignOwner`, semantic transitions `accept`/`start`/`block`/`resolve`/`reject`/`cancel`/`close` |

`StatusUpdatePayload` = the status-update insert **without** `kind` (the verb sets
`morning_checkin` vs `midday`).

---

## 4. Supported operations → call sites

| Operation                | Call                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Morning Check-in         | `statusUpdateRepository.submitCheckin({ user_id, work_date, mood, main_goal, priorities, … })`         |
| Check-out                | `attendanceRepository.checkOut(userId)`                                                                |
| Break Start              | `attendanceRepository.startBreak(userId, reason?)`                                                     |
| Break End                | `attendanceRepository.endBreak(userId)`                                                                |
| Midday Status            | `statusUpdateRepository.submitMidday({ user_id, work_date, progress, current_focus, outlook, … })`     |
| End-of-Day Report        | `dailyReportRepository.submit({ user_id, work_date, summary, completed, in_progress, … })`             |
| Dependency Requests      | `dependencyRequestRepository.create({ title, requester_id, type, priority, … })` + `.resolve(id)` etc. |
| Clock-in (opens the day) | `attendanceRepository.checkIn(userId, context?)`                                                       |

`user_id` / `userId` is passed in by the caller (the authenticated user's id);
RLS (`auth.uid()`) and the `created_by`/`actor_id` `DEFAULT auth.uid()` columns
do the server-side enforcement and audit stamping.

---

## 5. Types & reuse

Row/Insert/Update types live in `services/attendance/types.ts` and
`services/reports/types.ts`. The variable report sections **reuse the feature
element types** (single-sourced with the UI) rather than redeclaring them:

- Status enums (`AttendanceStatus`, `WorkSessionStatus`) ← `@/features/attendance/types`
- Check-in shapes (`Mood`, `PriorityItem`, `BlockerItem`, `HelpRequest`) ← `@/features/checkin/types`
- Midday shapes (`TaskProgressEntry`, `EndOfDayOutlook`) ← `@/features/midday/types`
- EOD shapes (`InProgressItem`, `OpenDependencyEntry`, `NeedFromOthersItem`, `TomorrowPlan`, `DailyReflection`) ← `@/features/eod/types`
- Dependency enums (`DependencyState`, `DependencyType`, `DependencyPriority`) ← `@/features/dependencies/types`

`Insert` types require only the NOT-NULL keys (`user_id`+`work_date`,
`title`+`requester_id`, …); everything else is optional and falls back to DB
defaults. Audit columns (`created_by`, `updated_by`, `actor_id`) are normally
omitted so the `DEFAULT auth.uid()` fires.

---

## 6. Known limitations / next steps

1. **Non-atomic orchestration.** The attendance lifecycle verbs are multi-step
   sequences over several tables, not single transactions. For concurrency
   safety, port `checkIn`/`checkOut`/`startBreak`/`endBreak` into
   `SECURITY DEFINER` RPCs (mirroring `start_work_session`) and have the
   repository call those — the method signatures stay identical.
2. **No `zod` validation yet.** Per the implementation plan, add a draft schema
   per submission at the repository boundary before wiring the UI.
3. **`late_minutes` / `overtime_seconds`** on `attendance` are not yet computed
   (no `company_settings` integration in the new lifecycle) — left at defaults
   until the lifecycle moves into RPCs.
4. **UI not connected** (by request). Next: feature `queries.ts` (`queryOptions`
   - key factories) + mutation hooks that call these repositories, then swap the
     `localStorage`/in-memory stores in `features/checkin|midday|eod|dependencies`.

---

## 7. Files added

```
src/services/attendance/
  types.ts                       # row/insert/update + SessionContext
  attendance-records.service.ts  # AttendanceRecordsService
  attendance-sessions.service.ts # AttendanceSessionsService
  break-sessions.service.ts      # BreakSessionsService
  attendance-events.service.ts   # AttendanceEventsService (append-only)
  index.ts                       # (extended) barrel

src/services/reports/
  types.ts                       # row/insert/update for the 3 report tables
  daily-reports.service.ts       # DailyReportsService
  status-updates.service.ts      # StatusUpdatesService
  dependency-requests.service.ts # DependencyRequestsService
  index.ts                       # (extended) barrel

src/repositories/attendance/
  attendance.repository.ts       # AttendanceRepository (orchestrator)
  index.ts

src/repositories/reports/
  daily-report.repository.ts     # DailyReportRepository
  status-update.repository.ts    # StatusUpdateRepository (check-in + midday)
  dependency.repository.ts       # DependencyRequestRepository
  index.ts
```

Root barrels `src/services/index.ts` (service singletons) were extended;
`src/repositories/index.ts` was intentionally left unchanged (import the new
repositories from their folders). No frontend/UI code was modified.
