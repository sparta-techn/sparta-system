# SpartaFlow — UI ↔ Supabase Wiring (mock-data replacement)

> Records which UI surfaces were moved off mock data onto the Supabase
> service/repository layer (migration `20260630130000`), the technique used, and
> the surfaces that are **blocked** by an identity/schema mismatch under the
> "keep the current UI / do not redesign" constraint.
> Snapshot date: 2026-06-30.

---

## 1. Technique — store-internal backend swap (zero component churn)

Each daily-report feature already funnelled all persistence through a single
`store.ts` facade with a synchronous, `useSyncExternalStore`-based API. To honor
"replace mock data only / keep the current UI", **only the store internals were
swapped** — every exported function/hook keeps its exact name and signature, so
the wizards, widgets, summaries and routes are byte-for-byte unchanged.

Per store:

- **Drafts** stay in `localStorage` (local working state, not "mock data").
- **Submissions** now persist to Supabase via the repositories. The synchronous
  getters read an in-memory cache that is **hydrated from** Supabase on first
  subscribe and **written through** on submit (optimistic update → repository
  call → reconcile from server).
- Identity/date come from `src/features/daily-sync.ts`
  (`currentUserId()` via `supabase.auth.getUser()`, `resolveWorkDate()` via the
  `current_work_date` RPC).

Net component edits: **one line** in `routes/_authenticated/app/check-in.tsx`
(`getSubmission()` → `useTodaySubmission()` so edit-mode re-renders after async
hydration). Nothing else changed in the UI.

---

## 2. Connected surfaces

| Surface                  | Store / file                   | Backed by                                                       | Table                                             |
| ------------------------ | ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------- |
| **Morning Check-in**     | `features/checkin/store.ts`    | `statusUpdateRepository` (`submitCheckin`/`getCheckin`)         | `daily_status_updates` (`kind='morning_checkin'`) |
| **Midday Report**        | `features/midday/store.ts`     | `statusUpdateRepository` (`submitMidday`/`getMidday`)           | `daily_status_updates` (`kind='midday'`)          |
| **End-of-Day Report**    | `features/eod/store.ts`        | `dailyReportRepository` (`submit`/`getByDate`/`listByUser`)     | `daily_reports`                                   |
| **Attendance Dashboard** | `features/attendance/*`        | _already live_ (`api.ts` + `queries.ts`)                        | `work_sessions`                                   |
| **Working Timer**        | `attendance/today-status-card` | _already live_ (`start_work_session`/`finish_work_session` RPC) | `work_sessions`                                   |
| **Break Timer**          | `attendance/today-status-card` | _already live_ (`start_break`/`end_break` RPC)                  | `work_session_breaks`                             |

> Attendance/timers were already Supabase-backed (the live RPC schema), so no
> change was required — they are listed for completeness.

### Lossy-mapping notes (schema gaps, documented for follow-up)

- **Check-in `taskIds`** — `daily_status_updates` has no planned-tasks column and
  there is no `tasks` table yet, so the morning planned-tasks selection is **not
  persisted** (the picker is still mock). It round-trips as `[]`.
- **Midday `blockerLinks`** — stored in the `blockers` jsonb column (the column is
  schema-typed for check-in blockers; midday reuses the same jsonb slot).
- **Midday `newBlockerNotes`** — parked in `mood_note` (midday rows have no mood).

These are cosmetic encodings on jsonb columns; when dedicated columns/tables land
they can be migrated. Nothing is lost for the cleanly-mapped fields (mood, goal,
priorities, help, progress, focus, outlook, EOD summary/sections/tomorrow/reflection).

---

## 3. Blocked surfaces — identity/schema mismatch

Two listed surfaces **cannot** be connected without violating either
"keep the current UI" or "do not redesign", so they were left on mock and are
called out here with the exact follow-up required.

### Dependency Requests (`features/dependencies/*`)

The UI is built on **synthetic mock identities**:

- owner is selected from `PEOPLE` (e.g. `ownerId: "u-emir"`), department & project
  are **name strings** (`"Backend"`, `"Atlas Mobile v3"`).
- cards/threads render **comments**, **activity timelines** and **attachments**.

`public.dependency_requests` stores real `uuid` FKs (`owner_id`, `department_id`)
and has **no** project / comments / activity / attachments. Writing the mock
picker values would either **violate the FKs (runtime insert failure)** or strip
owner/project/comments — turning a richly-populated board into near-empty rows.
Both outcomes break the "keep the UI / no redesign" constraint.

**To connect (follow-up, needs approval — it's a redesign):**

1. Repoint the create dialog's pickers to real data: owner → `profiles`
   directory, department → real `departments` (uuid), drop or model `project`.
2. Add tables for dependency **comments**, **activity** and **attachments**
   (or reuse the planned polymorphic `comments`/`attachments`), then map
   `dep-comments` / `dep-timeline`.
3. Map `requesterId`/`ownerId` → `profiles` for the avatar/name lookups (replace
   `personById` over `PEOPLE`).

### Manager Daily View (`features/manager/*`)

All 12 manager widgets read `manager/mock-data.ts`, which is built from the same
mock team identities. The report roll-ups (`report-compliance`, `team-status-board`,
`blockers-panel`, `attendance-overview`) could read real
`daily_status_updates` / `daily_reports` / `attendance` **by date**, but every
row would render as a bare `user_id` with no name/avatar until joined to real
`profiles`. Showing real reports without the identity join is a visible
regression, so this surface is blocked on the same identity bridge.

**To connect (follow-up):**

1. A profile-directory read (`profiles` join or a `manager_team_today` /
   `report_compliance` view as proposed in `docs/ATTENDANCE_IMPLEMENTATION_PLAN.md`).
2. Map the roll-up widgets to `statusUpdateRepository.listCheckinsByDate` /
   `listMiddayByDate`, `dailyReportRepository.listByDate`, and the attendance
   reads — keyed by real profiles.

---

## 4. Files changed

```
src/features/daily-sync.ts                      # NEW — shared currentUserId / resolveWorkDate
src/features/checkin/store.ts                   # internals → statusUpdateRepository
src/features/midday/store.ts                    # internals → statusUpdateRepository
src/features/eod/store.ts                       # internals → dailyReportRepository
src/routes/_authenticated/app/check-in.tsx      # getSubmission() → useTodaySubmission() (1 line)
```

No component markup, styling, or layout was modified. Type-check and lint pass
clean. Mock data files (`mock-data.ts`) remain for the not-yet-connected pickers
(planned-tasks, dependency people/projects, manager team) per the notes above.

---

## 5. Projects module (migration `20260630150000`)

Snapshot: 2026-07 follow-up. Same store-internal swap technique, but here the
"do not redesign" constraint on the **identity pickers was explicitly relaxed**
(approved) because the Projects UI resolved every person/department against
`hr/mock-data`, while the schema uses real `profiles` / `departments` /
`auth.users` FKs — a faithful connection is impossible otherwise.

### What is connected to Supabase

- **People directory** — `features/projects/store.ts` hydrates `profiles` via
  `employeeRepository` and `departments` via `departmentRepository`, exposing
  `personById` / `listPeople` / `listDepartments`. Components resolve people
  through these instead of `employeeById` (mock).
- **Projects** (dashboard / list / card / detail / overview) → `projectRepository`.
- **Members** → `projectMemberRepository` (`project-members.tsx` add / remove /
  role reconcile through `updateProject({ members })`).
- **Milestones** (overview "Upcoming milestones") → `milestoneRepository`.
- **Project activity** (overview + Activity tab) → `projectActivityRepository`.
- **Create / settings writes** → `projectRepository.create` + `assignByRole`;
  pickers (`create-project-dialog`, `project-settings-tab`) source live
  profiles/departments. Layout unchanged; only the data source swapped.

The store keeps the synchronous public API; the cache is hydrated async on load
and mutations are optimistic + written through. Row→domain mapping lives in
`features/projects/mappers.ts`.

### Local-only (no backing table — unchanged, documented)

`clients`, `templates`, `files`, the workspace-settings panel, and per-project
extras (`favorite`, `environments`, `clientId`, `templateId`) persist to a
localStorage overlay. Derived task counts (`progress`, `openTasks`, …) read `0`
until the tasks module is connected.

### Not connected — no existing UI

`Epics`, `Roadmap`, and `Calendar` were in the request but have **no rendered
UI**: the Milestones/Epics tabs in `project-detail.tsx` are `disabled` and there
is no roadmap/calendar component. Building them would be net-new UI (a redesign),
so the backing services (`epicsService`, `milestoneRepository`,
`projectCalendarService`) are ready but unwired. Connect when that UI exists.

### Caveats

- Against a freshly-migrated (empty) database the module renders empty and only
  the signed-in user's profile resolves — expected until projects/profiles exist.
- `company_settings` lacks the extended workspace columns, so the workspace panel
  stays local until that migration lands.

### Files changed

```
src/features/projects/types.ts            # + Person type
src/features/projects/mappers.ts          # NEW — row→domain mappers
src/features/projects/store.ts            # internals → Supabase repositories + people directory
src/features/projects/components/project-card.tsx        # employeeById → personById
src/features/projects/components/project-overview.tsx     # employeeById → personById
src/features/projects/components/project-extras.tsx       # employeeById → personById
src/features/projects/components/project-members.tsx      # personById + people from store
src/features/projects/components/project-settings-tab.tsx # manager picker → store people
src/features/projects/components/create-project-dialog.tsx# manager/department pickers → store
```

No component markup/layout changed beyond picker data sources. `tsc` + `eslint`
clean · `vitest` 26 passing.
