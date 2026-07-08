# SpartaFlow — Repository Layer

> The **domain-facing data API**. Repositories sit above the service layer
> (`src/services`): they compose one or more services and expose aggregate,
> intention-revealing operations. Hooks / TanStack Query call **repositories**;
> repositories never touch Supabase directly.
>
> **Status:** additive. The **UI is unchanged** — nothing here is wired into
> components yet, and the mock stores remain in place.

---

## 1. Why a repository layer

```
Components / hooks
      │  call
      ▼
Repositories            ← domain API: aggregates, intention-revealing methods
      │  use
      ▼
Services                ← uniform CRUD + domain methods over one table/RPC
      │  use
      ▼
src/lib/supabase + integrations/supabase   ← the single Supabase client
```

- **Domain framing.** Services speak in tables and rows; repositories speak in
  the domain — `getCurrentIdentity()`, `getWithMilestones()`, `activate()`.
- **Aggregation point.** A repository can fan out across services and combine
  the results (e.g. `AuthRepository.getCurrentIdentity` = user + profile + roles).
- **Stable seam for the UI.** Components depend on repositories; the service/SQL
  details underneath can change without touching callers.
- **Testable.** Each repository takes its service(s) via the constructor
  (defaulting to the shared singleton), so tests inject stubs.

This layer is **thin by design** — where a service method already expresses the
domain operation cleanly, the repository simply delegates. It earns its keep on
the aggregate reads and lifecycle verbs.

---

## 2. Structure

The **original seven** (documented in detail in §3) sit at the root:

```
src/repositories/
  auth.repository.ts         AuthRepository        → AuthService
  employee.repository.ts     EmployeeRepository    → AuthService (profiles)
  project.repository.ts      ProjectRepository     → ProjectsService
  task.repository.ts         TaskRepository        → TasksService
  sprint.repository.ts       SprintRepository      → SprintsService
  attendance.repository.ts   AttendanceRepository  → AttendanceService
  report.repository.ts       ReportRepository      → ReportsService
  index.ts                   Barrel — import from "@/repositories"
```

> **Grown since:** the layer now has **~35 repositories**, organized into
> per-domain folders alongside the root files (each with its own `index.ts`):
> `activity/`, `attendance/`, `hr/` (department, employee, position, team),
> `notifications/` (notification, preference, mention, approval),
> `projects/` (project, epic, milestone, member, risk, activity, calendar,
> workspace), and `reports/` (daily-report, status-update, dependency). They all
> follow the same class-+-singleton pattern and delegate to their matching
> service in `src/services/*`.

Each file exports a **class** (`<Name>Repository`) and a **shared singleton**
(`<name>Repository`). Import the singleton.

> **New service added:** `SprintsService` (`src/services/sprints`) was introduced
> so `SprintRepository` could delegate to the service layer like every other
> repository, following the existing service pattern (extends `BaseService`,
> exports a singleton, registered in `src/services/index.ts`).

---

## 3. Repositories

### `authRepository` → `AuthService`

Authentication and the current identity.

| Method                                    | Purpose                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `signIn` / `signOut`                      | Password auth.                                                                              |
| `requestPasswordReset` / `updatePassword` | Password lifecycle.                                                                         |
| `getSession` / `getCurrentUser`           | Raw session / user.                                                                         |
| `getProfile(userId)` / `getRoles(userId)` | Profile & role reads.                                                                       |
| `getCurrentIdentity()`                    | **Aggregate** — `{ userId, email, profile, roles }` in one call, or `null` when signed out. |

### `employeeRepository` → `AuthService` (the `profiles` table)

The canonical employee record is `profiles`; this repository frames it in
people/HR terms. (The `HrEmployee` mock in `features/hr` is untouched.)

| Method                                            | Purpose                        |
| ------------------------------------------------- | ------------------------------ |
| `list` / `getById` / `getByIdOrThrow`             | Directory reads.               |
| `getByEmail(email)`                               | Lookup by email.               |
| `listByDepartment(deptId)` / `listByTeam(teamId)` | Org-scoped lists.              |
| `listByStatus(status)`                            | By lifecycle status.           |
| `create(input)` / `update(id, patch)`             | Write profile.                 |
| `setStatus(id, status)`                           | Activate / suspend / offboard. |
| `getRoles(id)`                                    | Assigned roles.                |

### `projectRepository` → `ProjectsService`

| Method                                        | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `list` / `getById` / `getByIdOrThrow`         | Reads.                                |
| `listByStatus` / `listByManager`              | Filtered lists.                       |
| `create` / `update` / `remove`                | Writes.                               |
| `archive(id)` / `setFavorite(id, bool)`       | Lifecycle / personalization.          |
| `listMilestones(projectId)` / `listClients()` | Related reads.                        |
| `getWithMilestones(id)`                       | **Aggregate** — project + milestones. |

### `taskRepository` → `TasksService`

Subtasks are tasks with a non-null `parentTaskId`.

| Method                                                        | Purpose              |
| ------------------------------------------------------------- | -------------------- |
| `list` / `getById` / `getByIdOrThrow`                         | Reads.               |
| `listByProject` / `listByAssignee` / `listSubtasks`           | Filtered lists.      |
| `create` / `update`                                           | Writes.              |
| `setStatus(id, status)` / `assign(id, assignee)`              | Workflow.            |
| `softDelete(id)` / `remove(id)`                               | Trash / hard delete. |
| `listComments(taskId)` / `addComment(taskId, authorId, body)` | Comment thread.      |

### `sprintRepository` → `SprintsService`

| Method                                | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `list` / `getById` / `getByIdOrThrow` | Reads.                                     |
| `listByProject` / `listByStatus`      | Filtered lists.                            |
| `getActiveForProject(projectId)`      | **Aggregate** — the active sprint, if any. |
| `create` / `update` / `remove`        | Writes.                                    |
| `activate(id)` / `complete(id)`       | Lifecycle transitions.                     |

### `attendanceRepository` → `AttendanceService`

| Method                        | Purpose                        |
| ----------------------------- | ------------------------------ |
| `clockIn` / `clockOut`        | Session open / finalize (RPC). |
| `startBreak` / `endBreak`     | Break lifecycle (RPC).         |
| `getCurrentWorkDate`          | Server-defined work date.      |
| `getTodaySession(userId)`     | Today's session + breaks.      |
| `getHistory(userId, filters)` | Paginated history.             |
| `getTeamToday()`              | Team presence.                 |
| `getCompanySettings()`        | Attendance config.             |

### `reportRepository` → `ReportsService`

One report per work session.

| Method                                        | Purpose         |
| --------------------------------------------- | --------------- |
| `submit(report)`                              | File a report.  |
| `update(id, patch)`                           | Edit.           |
| `getById(id)` / `getBySession(sessionId)`     | Reads.          |
| `listByUser(userId)` / `listByDate(workDate)` | Filtered lists. |
| `remove(id)`                                  | Delete.         |

---

## 4. Usage

Import the **singleton** from the barrel:

```ts
import { authRepository, taskRepository } from "@/repositories";

const identity = await authRepository.getCurrentIdentity();
const tasks = await taskRepository.listByProject(projectId, {
  filters: { status: "in_progress" },
});
```

Inside a TanStack Query hook:

```ts
import { useQuery } from "@tanstack/react-query";
import { projectRepository } from "@/repositories";

export function useProjectDetail(id: string) {
  return useQuery({
    queryKey: ["project", id, "with-milestones"],
    queryFn: () => projectRepository.getWithMilestones(id),
  });
}
```

Testing with an injected stub:

```ts
const repo = new TaskRepository(fakeTasksService);
```

Errors propagate as `ServiceError` from the service layer — handle them the same
way (`err instanceof ServiceError`, check `err.code`).

---

## 5. Conventions

- **Components/hooks call repositories, not services or Supabase.** (Services
  remain available for low-level use, but the domain entry point is the
  repository.)
- **Import singletons, not classes.** Classes exist for testing / DI.
- **Keep repositories thin.** Delegate to services; add value through aggregates
  and lifecycle verbs, not by re-implementing CRUD.
- **One service owns each table.** If a repository needs a new table, add a
  service for it first (as was done for sprints), then delegate.
- **No UI changes, mocks intact.** Wiring repositories into hooks/components and
  retiring the mock stores is a deliberate later step.

```

```
