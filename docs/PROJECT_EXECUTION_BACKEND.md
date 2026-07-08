# SpartaFlow — Project Execution Backend (Services + Repositories)

> Reference for the backend data layer over the project-execution tables
> (migration `20260630150000`: `projects`, `project_roles`, `project_members`,
> `milestones`, `epics`, `project_activity`, `project_calendar_events`,
> `project_risks`) plus the `company_settings` workspace singleton.
> **UI is not connected** — these are the service/repository singletons hooks
> and routes will call next. Snapshot date: 2026-06-30.

---

## 1. Layering

Same two-tier boundary as the rest of the app (`docs/SERVICES.md`,
`docs/REPOSITORIES.md`, `docs/ATTENDANCE_REPORTS_BACKEND.md`):

```
hook / TanStack Query
      │ (calls a repository singleton)
      ▼
Repository — domain verbs, orchestration, activity logging, reuse of Tasks
      │ (composes one or more services)
      ▼
Service (extends BaseService) — one table each, CRUD + finders
      │ (relaxed `db` client — these tables aren't in generated types yet)
      ▼
Supabase (RLS enforced: is_project_member / can_manage_project)
```

- **Services** extend `BaseService<Row, Insert, Update>` (`services/core`) over
  the relaxed `db` client, with explicit **snake-case** row types in
  `services/projects/types.ts` (matching the SQL exactly).
- **Repositories** are the domain API and live in their own folder with a barrel,
  **not** re-exported from the root `@/repositories` (the legacy mock-typed
  `ProjectRepository` keeps that name) — the same convention as
  `@/repositories/hr` / `attendance` / `reports`. Import from
  `@/repositories/projects`.
- **Reuse**: `ProjectRepository.listTasks()` delegates to the existing
  `TasksService.listByProject` — Tasks is **not** re-implemented. Workspace reuses
  the live `company_settings` row + `CompanySettings` type (shared with
  Attendance). Status/health enums are reused from `features/projects/types`.

### Coexistence with the legacy projects scaffold

The pre-existing `services/projects/projects.service.ts` (`ProjectsService`) and
`repositories/project.repository.ts` are the **mock-typed, camelCase** scaffold;
they are left untouched. The new services/repositories are **snake-case** and
match the migration. `ProjectInsert`/`ProjectUpdate` stay bound to the legacy
service in the barrel; the new project insert/update are exported as
`ProjectRecordInsert` / `ProjectRecordUpdate`.

---

## 2. Services — `@/services/projects`

| Service / singleton                                 | Table                          | Key methods (beyond inherited CRUD)                                             |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `ProjectRecordsService` / `projectRecordsService`   | `projects`                     | `listByStatus`, `listByManager`, `setStatus`, `setHealth`, `archive`            |
| `ProjectRolesService` / `projectRolesService`       | `project_roles`                | `listActive`, `getBySlug`                                                       |
| `ProjectMembersService` / `projectMembersService`   | `project_members`              | `listByProject`, `listByUser`, `getMembership`, `setRole`                       |
| `MilestonesService` / `milestonesService`           | `milestones`                   | `listByProject`, `setStatus`, `setProgress`                                     |
| `EpicsService` / `epicsService`                     | `epics`                        | `listByProject`, `archive`                                                      |
| `ProjectActivityService` / `projectActivityService` | `project_activity`             | `log`, `listByProject` — **append-only** (`update`/`upsert`/`remove` reject)    |
| `ProjectCalendarService` / `projectCalendarService` | `project_calendar_events`      | `listByProject`, `listInRange`, `listByMilestone`                               |
| `ProjectRisksService` / `projectRisksService`       | `project_risks`                | `listByProject`, `listByStatus`, `listOpen`, `setStatus` (stamps `resolved_at`) |
| `WorkspaceService` / `workspaceService`             | `company_settings` (singleton) | `get`, `update` (typed `supabase` client, reuses `CompanySettings`)             |

---

## 3. Repositories — `@/repositories/projects`

| Repository / singleton                                    | Feature               | Verbs                                                                                                                                                                                                                  |
| --------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectRepository` / `projectRepository`                 | **Project CRUD**      | `list`, `getById(OrThrow)`, `listByStatus`, `listByManager`, `create` (logs `project_created`), `update`, `setStatus`/`setHealth` (log), `archive`, `remove`, `getWithActivity`, **`listTasks` (reuses TasksService)** |
| `WorkspaceRepository` / `workspaceRepository`             | **Workspace CRUD**    | `get`, `update`                                                                                                                                                                                                        |
| `ProjectMemberRepository` / `projectMemberRepository`     | **Member Assignment** | `listMembers`, `getMembership`, `assign(projectId,userId,roleId?)`, `assignByRole(slug)`, `setRole`, `remove` (logs `member_added`/`member_removed`)                                                                   |
| `MilestoneRepository` / `milestoneRepository`             | **Milestones**        | `listForProject`, `create` (logs `milestone_created`), `update`, `setStatus` (logs `milestone_reached` on done), `setProgress`, `remove`                                                                               |
| `EpicRepository` / `epicRepository`                       | **Epics**             | `listForProject`, `create` (logs `epic_created`), `update`, `archive`, `remove`                                                                                                                                        |
| `ProjectCalendarRepository` / `projectCalendarRepository` | **Project Calendar**  | `listForProject`, `listInRange(from,to)`, `listForMilestone`, `create` (logs `event_created`), `update`, `remove`                                                                                                      |
| `ProjectActivityRepository` / `projectActivityRepository` | **Project Activity**  | `listForProject`, `log`                                                                                                                                                                                                |
| `ProjectRiskRepository` / `projectRiskRepository`         | **Risk Management**   | `listForProject`, `listOpen`, `raise` (logs `risk_raised`), `update`, `setStatus`, `resolve` (logs `risk_resolved`), `remove`                                                                                          |

The **project activity feed** is populated as a side effect of domain actions:
project create / status / health, member add / remove, milestone create / reached,
epic create, calendar event create, risk raise / resolve. All flow through the
single `projectActivityService.log`.

---

## 4. Supported operations → call sites

| Operation             | Call                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Project CRUD          | `projectRepository.create({ key, name, manager_id, … })` · `.setStatus(id,'active')` · `.archive(id)` |
| Workspace CRUD        | `workspaceRepository.get()` · `.update({ timezone, work_start_time, … })`                             |
| Member assignment     | `projectMemberRepository.assignByRole(projectId, userId, 'lead')` · `.remove(projectId, userId)`      |
| Milestones            | `milestoneRepository.create({ project_id, name, due_date })` · `.setStatus(id,'done')`                |
| Epics                 | `epicRepository.create({ project_id, name, color })`                                                  |
| Project calendar      | `projectCalendarRepository.create({ project_id, title, starts_at })` · `.listInRange(id, from, to)`   |
| Project activity      | `projectActivityRepository.listForProject(projectId)`                                                 |
| Risk management       | `projectRiskRepository.raise({ project_id, title, severity, likelihood })` · `.resolve(id)`           |
| Project tasks (reuse) | `projectRepository.listTasks(projectId)` → `TasksService.listByProject`                               |

`user_id` / actor is taken from the authenticated session; RLS
(`is_project_member`, `can_manage_project`) and the `created_by`/`actor_id`
`DEFAULT auth.uid()` columns enforce + stamp server-side.

---

## 5. Types & reuse

- Row/Insert/Update for all 8 tables live in `services/projects/types.ts`
  (snake-case). `Insert` requires only NOT-NULL keys (`project_id`+`name`,
  `key`+`name`+`manager_id`, …); everything else falls back to DB defaults.
- `ProjectStatus` / `ProjectHealth` reused from `@/features/projects/types`;
  `PriorityLevel` reused for risk severity + likelihood.
- Workspace reuses `CompanySettings` from `@/features/attendance/types` — one
  source of truth shared with Attendance.
- Audit columns (`created_by`/`updated_by`/`actor_id`) are normally omitted so the
  `DEFAULT auth.uid()` fires.

---

## 6. Known limitations / next steps

1. **Tables not in generated types yet** — services use the relaxed `db` client.
   Regenerate `src/integrations/supabase/types.ts` after the migration is applied;
   the explicit row types can then be tightened to the generated ones.
2. **Non-atomic activity logging** — repositories perform the write then log
   activity as a second statement (not transactional). For guaranteed
   consistency, move logging into a DB trigger on each table.
3. **Workspace extension** — the extended workspace columns (`company_name`,
   `working_days`, `default_project_template`, …) from
   `docs/PROJECT_EXECUTION_PLAN.md §5` are **not yet** in `company_settings`;
   `WorkspaceService` currently reads/writes the existing attendance columns and
   will pick up the new ones once that migration lands.
4. **UI not connected** (by request). Next: `features/projects/queries.ts`
   (`queryOptions` + key factories) + mutation hooks calling these repositories,
   then swap the `projects/store.ts` localStorage internals (per
   `docs/UI_SUPABASE_WIRING.md`).

---

## 7. Files added

```
src/services/projects/
  types.ts                       # snake-case row/insert/update for all 8 tables
  project-records.service.ts     # ProjectRecordsService (projects)
  project-roles.service.ts       # ProjectRolesService (project_roles)
  project-members.service.ts     # ProjectMembersService (project_members)
  milestones.service.ts          # MilestonesService (milestones)
  epics.service.ts               # EpicsService (epics)
  project-activity.service.ts    # ProjectActivityService (append-only)
  project-calendar.service.ts    # ProjectCalendarService (project_calendar_events)
  project-risks.service.ts       # ProjectRisksService (project_risks)
  workspace.service.ts           # WorkspaceService (company_settings singleton)
  index.ts                       # (extended) barrel

src/repositories/projects/
  project.repository.ts          # ProjectRepository (+ reuses TasksService)
  workspace.repository.ts        # WorkspaceRepository
  project-member.repository.ts   # ProjectMemberRepository
  milestone.repository.ts        # MilestoneRepository
  epic.repository.ts             # EpicRepository
  project-calendar.repository.ts # ProjectCalendarRepository
  project-activity.repository.ts # ProjectActivityRepository
  project-risk.repository.ts     # ProjectRiskRepository
  index.ts
```

The legacy `services/projects/projects.service.ts` and
`repositories/project.repository.ts` were left unchanged; the root
`@/repositories` barrel was not modified. No frontend/UI code was modified.
`tsc --noEmit` clean · `eslint` clean · `vitest` 26 passing.
