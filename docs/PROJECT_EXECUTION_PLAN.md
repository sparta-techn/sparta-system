# SpartaFlow — Project Execution Implementation Plan

> Planning document only. **No application code or migration is written by this
> doc.** It specifies how to deliver *Project Execution* by **connecting the
> modules that already exist** (Workspace, Projects, Tasks, Sprints, Kanban,
> Analytics, Dependencies, Teams) — not by building parallel features. Derived
> from `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, and the
> live code under `src/features/*`, `src/services/*`, `src/repositories/*`.
> Snapshot date: 2026-06-30.

---

## 1. Guiding principle

> *Connect existing modules; never regenerate them.* (CLAUDE.md §Coding Principles)

Every feature below already has **types + store + components + routes** built and
a **service + repository scaffolded**. The work is to (a) land the schema
`DATABASE_DESIGN.md` already specifies, (b) reconcile the scaffolded services to
that schema, and (c) swap each `store.ts` to the repositories using the proven
store-internal-swap pattern (already shipped for check-in / midday / eod). The
four "execution views" — **Roadmap, Calendar, Workload, Risk** — are **composed
from existing data** (projects, milestones, sprints, tasks, dependencies,
time-logs, attendance) using the existing chart components and
`project-analytics` derivations. No new feature folders.

---

## 2. Current-state audit

| Module | Types | Store (mock) | Service / Repo | Routes | DB table? |
| --- | --- | --- | --- | --- | --- |
| **Projects** | `features/projects/types.ts` (Project, Client, Template, Milestone, Member, Workspace, Activity, File) | `projects/store.ts` (localStorage) | `services/projects` + `repositories/project.repository.ts` | `projects.*` (8 routes) | ❌ none |
| **Tasks** | `features/tasks/types.ts` (Task, Epic, TaskMilestone, Relation, Checklist) | `tasks/store.ts` | `services/tasks` + `repositories/task.repository.ts` | `tasks.*` (6) | ❌ none |
| **Sprints** | `features/sprints/types.ts` (Sprint) | `sprints/store.ts` | `services/sprints` + `repositories/sprint.repository.ts` | `sprints.*` (3) | ❌ none |
| **Kanban** | `features/kanban/types.ts` (KanbanSettings, Filters) | `kanban/store.ts` (reads tasks) | — (reuses tasks) | `tasks.kanban.tsx` | ❌ none |
| **Analytics** | `features/analytics/types.ts` + `project-analytics/{insights,utils}.ts` | `analytics/mock-data.ts` | `services/analytics` (RPC + `saved_reports`) | `analytics.*` (5) | ❌ none |
| **Workspace** | `WorkspaceSettings` in projects/types | `projects/store.ts` (`getWorkspace`) | — | `projects.workspace.tsx` | 🔁 extend `company_settings` |
| **Teams** | HR `teams` | — (live) | `services/hr/teams.service.ts` + `repositories/hr/team.repository.ts` | `hr.organization.tsx` | ✅ `teams` |
| **Dependencies** | `features/dependencies/types.ts` | `dependencies/store.ts` | `services/reports/dependency-requests.service.ts` + `repositories/reports/dependency.repository.ts` | `dependencies.*` | ✅ `dependency_requests` |

**Two systemic issues to fix while connecting:**

1. **Column-casing mismatch.** `projects.service.ts`, `tasks.service.ts`,
   `sprints.service.ts`, `analytics.service.ts` declare **camelCase** columns
   (`projectId`, `assigneeId`, `createdAt`, `managerId`) but the DB convention is
   **snake_case**. Reconcile the service Row/Insert/Update types to snake_case and
   map camelCase ↔ snake_case in each feature `api.ts` — exactly the reconciliation
   already done for `reports.service.ts`/`daily-reports.service.ts`.
2. **Duplicate Milestone type.** `projects/Milestone` and `tasks/TaskMilestone`
   both exist. Unify on one `milestones` table (§7 below); tasks reference it via
   `milestone_id`.

---

## 3. Cross-cutting foundation (do first)

- **Schema waves** (from `DATABASE_DESIGN.md` Build Order + §8–§20): land P0
  `projects` → `project_members` → `clients`/`project_templates`/`milestones`/
  `epics` → `tasks` (+ supporting), then P1 `sprints` / `time_logs`, then connect
  the live `dependency_requests`. Each table ships RLS in its own migration;
  regenerate `src/integrations/supabase/types.ts` after each.
- **Permission keys**: add `projects:write`, `tasks:write` to the
  `permissions` catalog + `role_permissions` seed (mirror in
  `features/auth/permissions.ts`). The `permission_key` enum in DATABASE_DESIGN §0
  already lists them.
- **RLS helpers**: add `is_project_member(uid, project_id)` SECURITY DEFINER
  (DATABASE_DESIGN §9) — reused by tasks/sprints/milestones/epics policies.
- **Data path per feature** (the attendance template): `features/<f>/api.ts`
  (typed Supabase calls + camel↔snake mapping) → `features/<f>/queries.ts`
  (`queryOptions` + key factory) → `store.ts` internals swapped to call the
  repository (components unchanged), per `docs/UI_SUPABASE_WIRING.md`.
- **Reuse, don't recreate**: `profiles` (member/assignee pickers),
  `teams`/`departments` (live), `dependency_requests` (live),
  `analytics/charts/*` (timeline, heatmap, line, donut, bar),
  `project-analytics/{utils,insights}.ts` (health, workload, dependency signals),
  `components/ui/*`, `components/states`, `stat-card`, `status-badge`.

---

## 4. Projects

- **Existing code to reuse**: `features/projects/{types,store,mock-data}.ts`;
  components `project-card`, `project-list`, `project-detail`,
  `project-overview`, `projects-dashboard`, `create-project-dialog`,
  `project-settings-tab`, `client-views`, `template-list`, `badges`,
  `projects-subnav`; `services/projects/projects.service.ts` +
  `repositories/project.repository.ts`; routes `projects.{index,all,$id,clients,
  clients.$id,templates,workspace}.tsx`.
- **Database changes**: create `projects` (§8) + supporting `clients`,
  `project_templates`, `project_activity`, `project_favorites` (per-user
  favorite — replaces `Project.favorite` boolean). Derived counts
  (`progress`, `openTasks`, `overdueTasks`, `totalTasks`, `openDependencies`)
  become the **`project_stats` view** (§20), not stored columns.
- **APIs**: `features/projects/api.ts` — `listProjects(filters)`, `getProject`,
  `createProject`, `updateProject`, `archiveProject`, `setFavorite`,
  `listClients`, `nextProjectKey`. `queries.ts`: `projectKeys`,
  `projectsQuery(filters)`, `projectQuery(id)`, `projectStatsQuery(id)`.
- **Services**: reconcile `ProjectsService` Row to snake_case; keep `listByStatus`,
  `listByManager`, `setFavorite`→`project_favorites`, `archive`. Add `listClients`
  (already), `listActivity`.
- **Repositories**: extend `ProjectRepository` — `getWithStats(id)` (join the
  view), `getWithMilestones` (exists), `listForUser(userId)` (member-scoped).
- **UI changes**: none structural — swap `projects/store.ts` reads/writes to
  `projectRepository`; `progress`/counts read from `projectStatsQuery`. Keep
  components.
- **Permissions**: read if `is_project_member` OR `has_any_role(owner,
  super_admin, project_manager)`; write if `manager_id = auth.uid()` OR
  `projects:write`. Archive = managers/admins.
- **Business rules**: `key` unique (`nextProjectKey` via counter RPC to avoid
  races); `manager_id` required; archive is soft (`status='archived'` +
  `archived_at`); `health` defaults `healthy`; favorite is per-user.

---

## 5. Workspaces

- **Existing code to reuse**: `WorkspaceSettings` type, `workspace-settings.tsx`,
  `projects.workspace.tsx`, `projects/store.ts` `getWorkspace`/`updateWorkspace`;
  the live `getCompanySettings` in `features/attendance/api.ts`.
- **Database changes**: **extend `company_settings`** (singleton) per
  DATABASE_DESIGN §19 — add `company_name`, `logo_initial`, `working_days text[]`,
  `work_end_time time`, `languages text[]`, `default_statuses text[]`,
  `default_project_template uuid → project_templates`. **No new table.**
- **APIs**: extend `features/attendance/api.ts` (or new
  `features/projects/workspace-api.ts`) `getWorkspaceSettings` /
  `updateWorkspaceSettings` over the singleton.
- **Services**: reuse a `CompanySettingsService` (the attendance settings already
  read this row) — add `update(patch)`; or fold into `ProjectsService`. Avoid a
  second source of truth.
- **Repositories**: `WorkspaceRepository` thin wrapper (or reuse attendance
  settings repo) — `get()`, `update(patch)`.
- **UI changes**: swap `getWorkspace`/`updateWorkspace` to the repository; keep
  `workspace-settings.tsx` markup.
- **Permissions**: read all authenticated; write `owner`/`super_admin`/`hr`
  (existing `settings_admin_write` policy already covers this).
- **Business rules**: singleton (`id=true`); `default_project_template` must
  reference an existing template; working days/hours feed Calendar + Attendance.

---

## 6. Teams

- **Existing code to reuse**: **already live** — `services/hr/teams.service.ts`,
  `repositories/hr/team.repository.ts`, `teams` table + `hr.organization.tsx`.
- **Database changes**: none for teams themselves. For execution scoping, ensure
  `projects.department_id` (§8) and (optional) a `project_teams(project_id,
  team_id)` link **only if** projects span multiple teams; otherwise reuse
  `project_members` (§Members). Recommend reusing `project_members` — no new table.
- **APIs / Services / Repositories**: reuse `teamRepository.listActive()`,
  `listByDepartment`. No new code; Project Execution consumes teams for member
  pickers and workload grouping.
- **UI changes**: project member/workload views group by `teams` via existing
  team data; reuse `employee-chip`, `avatar`.
- **Permissions**: teams read all authenticated; write HR/super_admin/owner
  (existing).
- **Business rules**: a member's team comes from `profiles.team_id`; project
  workload rolls up by team through membership.

---

## 7. Members

- **Existing code to reuse**: `project-members.tsx`, `ProjectMember`/`ProjectRole`
  types, `profiles` directory (`employeeRepository` / profiles read), `avatar`,
  `employee-chip`.
- **Database changes**: create `project_members(project_id, user_id, project_role,
  added_by)` UNIQUE `(project_id, user_id)` (§9) + `is_project_member` helper.
  Replaces the embedded `Project.members[]` array.
- **APIs**: `features/projects/api.ts` — `listMembers(projectId)`,
  `addMember(projectId, userId, role)`, `removeMember`, `setMemberRole`.
  `queries.ts`: `projectMembersQuery(projectId)`.
- **Services**: `ProjectMembersService extends BaseService` (`project_members`) —
  `listByProject`, `add`, `remove`, `setRole`; or methods on `ProjectsService`.
- **Repositories**: `ProjectRepository.addMember/removeMember/listMembers`
  delegating; resolve member profiles via the profiles directory.
- **UI changes**: `project-members.tsx` reads `projectMembersQuery` + the profiles
  picker instead of the mock `members[]`. Keep markup.
- **Permissions**: members read their project's membership; project
  manager/lead + `owner`/`super_admin` write. Membership **drives** task/sprint
  RLS via `is_project_member`.
- **Business rules**: unique `(project_id, user_id)`; manager auto-added as
  `lead`; removing the manager is disallowed; `project_role ∈ {lead, contributor,
  reviewer, stakeholder}`.

---

## 8. Milestones

- **Existing code to reuse**: `projects/Milestone` type + `project-detail`
  milestone UI + `store.milestonesFor`; `tasks/TaskMilestone` (to be unified).
- **Database changes**: create one `milestones(project_id, name, due_date,
  status, progress)` table (§8 supporting). Tasks reference it via
  `tasks.milestone_id` (§10). Retire `tasks/TaskMilestone` as a separate concept.
- **APIs**: `features/projects/api.ts` — `listMilestones(projectId)`,
  `createMilestone`, `updateMilestone`, `setMilestoneStatus`. `queries.ts`:
  `milestonesQuery(projectId)`.
- **Services**: `ProjectsService.listMilestones` (exists) + add
  `createMilestone`/`updateMilestone`, or a small `MilestonesService`.
- **Repositories**: `ProjectRepository.getWithMilestones` (exists) — keep; add
  milestone writes.
- **UI changes**: milestone widgets read `milestonesQuery`; the task milestone
  picker (create-task-dialog/task-detail) selects from the same `milestones`.
- **Permissions**: project-member read; manager/lead + admins write
  (project-scoped via `is_project_member`).
- **Business rules**: `progress` derived from child task completion (view or
  computed); `status ∈ {upcoming,in_progress,done,missed}`; `missed` when
  `due_date < today` and not done; feeds Roadmap + Calendar.

---

## 9. Epics

- **Existing code to reuse**: `tasks/Epic` type; epic selection in
  `create-task-dialog`, `task-detail`, `tasks-filter-bar` (`epicIds`), kanban
  filter `epicIds`.
- **Database changes**: create `epics(project_id, name, color, owner_id)` (§10
  supporting). Tasks reference via `tasks.epic_id`.
- **APIs**: `features/tasks/api.ts` — `listEpics(projectId)`, `createEpic`,
  `updateEpic`. `queries.ts`: `epicsQuery(projectId)`.
- **Services**: `EpicsService extends BaseService` (`epics`) or methods on
  `TasksService` (`listEpics`).
- **Repositories**: `TaskRepository.listEpics(projectId)` + writes.
- **UI changes**: epic pickers/filters read `epicsQuery`; epic swimlanes in
  kanban group by `epic_id`. Keep components.
- **Permissions**: project-member read; manager/lead + admins write.
- **Business rules**: epic belongs to one project; deleting an epic nulls
  `tasks.epic_id` (SET NULL); epic is a grouping only (does not own tasks).

---

## 10. Dependencies

- **Existing code to reuse**: **live** `dependency_requests` table +
  `services/reports/dependency-requests.service.ts` +
  `repositories/reports/dependency.repository.ts` + `features/dependencies/*`
  UI + the open/terminal **business rules already implemented**
  (`services/reports/rules.ts`).
- **Database changes**: add `project_id uuid → projects(id) SET NULL` to
  `dependency_requests` (it already has `related_task_id` + `department_id`);
  once `tasks` lands, add the `related_task_id → tasks(id)` FK. No new table.
- **APIs**: extend `dependency.repository.ts` consumers — `listForProject`,
  `listForTask`; surface open dependencies in `project_stats`
  (`open_dependencies` count) and in EOD/midday (already wired).
- **Services**: reuse `DependencyRequestsService` — add
  `listByProject(projectId)` (filter `project_id`).
- **Repositories**: `DependencyRequestRepository.listForProject(projectId)`.
- **UI changes**: project-detail "Blockers" tab and task-detail "Dependencies"
  read the live dependency repository (replace the dependencies mock store, per
  the open item in `docs/UI_SUPABASE_WIRING.md §3` — note this needs the real
  profiles/department pickers).
- **Permissions**: existing — requester/owner/same-department/reviewers read;
  requester/owner/admins write (already enforced).
- **Business rules**: **already implemented** — Open until resolved
  (`isDependencyOpen`, `resolvedAtFor`), state machine via `setState`. Project
  health/risk consumes open critical dependencies.

---

## 11. Roadmap  *(composed view — no new table)*

- **Existing code to reuse**: `analytics/charts/timeline.tsx`,
  `project-analytics/utils.ts` (`sprintProgressList`), milestones + sprints +
  projects data; `projects-subnav` for a new tab.
- **Database changes**: none — derive. Optionally a `project_roadmap` **view**
  (§20 style) `UNION` of `projects(start_date,end_date)`,
  `milestones(due_date)`, `sprints(start_date,end_date)` keyed by project.
- **APIs**: `features/projects/api.ts` — `getRoadmap(projectId | portfolio)`
  reading the view or composing the existing milestone/sprint queries.
- **Services / Repositories**: read-only; fold into `ProjectRepository.getRoadmap`
  composing `milestonesQuery` + `sprintsQuery` + project dates (no new service).
- **UI changes**: a Roadmap tab/route under `projects.$id` (or
  `projects.roadmap`) rendering `timeline.tsx` with milestone/sprint bands. Reuse
  existing chart; no redesign.
- **Permissions**: project-member read (inherits milestone/sprint/project RLS via
  `security_invoker` view).
- **Business rules**: items ordered by date; overdue milestones flagged
  (`missed`); active sprint highlighted; portfolio roadmap = roadmap across the
  user's member projects.

---

## 12. Calendar  *(composed view — no new table)*

- **Existing code to reuse**: `manager/team-calendar.tsx`, `react-day-picker`
  (`components/ui/calendar`), live `holidays` table, milestones/sprint/task dates.
- **Database changes**: none — derive. Optional `calendar_events` **view**
  unioning `milestones.due_date`, `sprints.start/end`, `tasks.due_date`,
  `holidays.holiday_date`, and (for "my calendar") `work_sessions`.
- **APIs**: `features/projects/api.ts` — `getCalendar({from,to,projectId|userId})`
  composing milestone/sprint/task/holiday queries.
- **Services / Repositories**: read-only composition in `ProjectRepository`/a
  `CalendarRepository` (thin) — reuse `holidays` read from attendance.
- **UI changes**: reuse `team-calendar.tsx` / `ui/calendar`; a Calendar tab under
  projects or the dashboard. No new component family.
- **Permissions**: project-member read; "my calendar" = self; holidays read-all.
- **Business rules**: working days/hours from `company_settings` (Workspace);
  weekends/holidays shaded; task/milestone due dates plotted; due-today/overdue
  emphasized.

---

## 13. Workload  *(composed view — no new table)*

- **Existing code to reuse**: `manager/workload-distribution.tsx`,
  `project-analytics/utils.ts` (`tasksPerUser`, `projectTimeLogs`, `totalHours`),
  `analytics/charts/{heatmap,bar-chart}.tsx`, profiles/teams for grouping.
- **Database changes**: none new for counts; needs `time_logs` (§13, P1) for
  hours. Expose a `time_log_totals` **view** (§20) (minutes per user/task/day) and
  reuse `tasks(assignee_id, estimated_hours, story_points)`.
- **APIs**: `features/project-analytics/api.ts` — `getWorkload({projectId|teamId,
  from,to})` returning per-assignee task counts + estimated vs logged hours.
- **Services / Repositories**: read-only — compose `tasksService.listByProject`
  + `time_log_totals` view; or an `analytics`-scoped repository method.
- **UI changes**: `workload-distribution.tsx` + `heatmap` read the workload query
  instead of mock; group by user/team. Keep components.
- **Permissions**: managers/leads/owner read team workload
  (`can_review_reports`-style); members read own.
- **Business rules**: workload = open assigned tasks weighted by
  `estimated_hours`/`story_points`; over-allocation flag when assigned hours >
  capacity (sprint `capacity` / working hours); unassigned tasks surfaced.

---

## 14. Risk Management  *(composed register — derive first)*

- **Existing code to reuse**: `project-analytics/insights.ts`
  (`calcProjectHealth`, `generateInsights`), `dependencyInsights`,
  `ProjectHealth` enum (`healthy/at_risk/blocked/delayed`), overdue/blocked task
  signals, open critical dependencies (live), sprint slippage
  (`sprintProgressList`).
- **Database changes**: **none required** to start — compute a risk register from
  existing signals via a `project_risk_signals` **view** (overdue tasks, blocked
  tasks, open critical dependencies, at-risk health, sprint behind schedule).
  *Only if* mitigation/ownership must be persisted, add a minimal
  `project_risks(project_id, title, severity, likelihood, status, owner_id,
  mitigation)` table — flag as decision (§16), default to derive.
- **APIs**: `features/project-analytics/api.ts` — `getRiskRegister(projectId)`
  returning derived risks (+ CRUD if the optional table is chosen).
- **Services / Repositories**: read-only composition reusing `insights.ts`;
  promote `calcProjectHealth` to read live `project_stats` + dependencies.
- **UI changes**: a Risk tab in `project-analytics-dashboard` /
  `project-detail` rendering `insight-card` + severity badges
  (`status-badge`). Reuse existing components.
- **Permissions**: project-member read; manager/lead + owner manage mitigations
  (if persisted).
- **Business rules**: severity from priority × impact; a project is `at_risk` when
  health < 75, `delayed` when milestone/sprint overdue, `blocked` when an open
  critical dependency exists (mirrors `calcProjectHealth` levels); risks auto-clear
  when the underlying signal resolves.

---

## 15. Build order

1. **Foundation**: `projects:write`/`tasks:write` permissions + `is_project_member`
   helper; reconcile the four services to snake_case.
2. **P0 schema + wiring**: `projects` (+ `clients`, `templates`, `project_activity`,
   `project_favorites`, `project_stats` view) → `project_members` → `milestones`
   → `epics` → `tasks` (+ checklist/relations/activity/favorites). Swap
   `projects/store.ts` and `tasks/store.ts` to repositories.
3. **Workspace**: extend `company_settings`; wire `workspace-settings`.
4. **P1 schema + wiring**: `sprints` (+ `sprint_burndown` view), `time_logs`
   (+ `time_log_totals` view); swap `sprints/store.ts`, `kanban/store.ts`.
5. **Dependencies**: add `project_id` to `dependency_requests`; wire project/task
   dependency views (live repo already exists).
6. **Composed views**: `project_stats`, `sprint_burndown`, `time_log_totals`,
   `project_roadmap`, `calendar_events`, `project_risk_signals` → Roadmap,
   Calendar, Workload, Risk tabs reusing existing charts.

---

## 16. Permissions matrix

| Action | Roles |
| --- | --- |
| Read project / tasks / sprints / milestones / epics | `is_project_member` OR owner/super_admin/project_manager |
| Create/edit project | `manager_id = auth.uid()` OR `projects:write` (owner/super_admin/project_manager) |
| Manage members | project lead/manager + owner/super_admin |
| Create/edit task, set status, assign | project member with edit rights or assignee/reporter (`tasks:write`) |
| Manage sprint / milestone / epic | project manager/lead + admins |
| Raise/own dependency | any authenticated (requester) / owner / admins |
| Edit workspace settings | owner/super_admin/hr |
| Read roadmap/calendar/workload/risk | project member (views inherit base RLS via `security_invoker`) |

Keep `features/auth/permissions.ts` in lockstep with the seeded `role_permissions`.

---

## 17. Business-rule catalog (cross-feature)

- Project `key` unique; refs `ETB-142` via `next_task_ref(project_key)` counter RPC.
- Membership drives task/sprint visibility (`is_project_member`).
- Derived numbers are **views** (`project_stats`, `sprint_burndown`,
  `time_log_totals`) — never stored columns (CLAUDE.md Performance).
- One active sprint per project (partial unique); tasks reference a sprint, the
  sprint never owns them.
- Soft-delete tasks (`deleted_at`), archive projects (`archived_at`).
- Dependency Open-until-resolved (already implemented).
- All writes validated with `zod` at the mutation boundary; audit important
  actions via `audit_events` (CLAUDE.md Security).

---

## 18. Open decisions

1. **Risk persistence**: derive-only (recommended, "connect not create") vs. a
   `project_risks` table for mitigation tracking.
2. **Multi-team projects**: reuse `project_members` (recommended) vs. a
   `project_teams` link table.
3. **Dependencies UI connection**: requires repointing the mock people/department
   pickers to real `profiles`/`departments` (see `docs/UI_SUPABASE_WIRING.md §3`).
4. **Roadmap/Calendar scope**: per-project tabs vs. a portfolio-wide route.
5. **Service casing**: reconcile in place (recommended) vs. add mapping only in
   `api.ts` and leave service Row types camelCase.

---

*Derived from the live code and `docs/DATABASE_DESIGN.md` (§8 projects, §9
project_members, §10 tasks/epics/milestones, §14 sprints, §16 dependencies, §19
workspace settings, §20 views). It changes no application code.*
