# SpartaFlow — Service Layer

> The single backend boundary for the app. **All external communication goes
> through these service classes** (per `CLAUDE.md`). Components never touch
> Supabase directly — they call a service singleton, normally from inside a hook
> or a TanStack Query function.

---

## 1. Why a service layer

- **One boundary.** Persistence, auth, RPCs and Edge Functions are reached only
  through `src/services`. Swapping mock stores for live tables, or changing a
  query, happens in one place.
- **Uniform CRUD.** Every domain inherits the same verbs from `BaseService`, so
  callers learn one shape and reuse it everywhere.
- **Predictable errors.** Failures are normalized to `ServiceError` — the UI
  handles a single error type instead of raw Postgrest/auth shapes.
- **Strict typing, contained casts.** Tables not yet in the generated
  `Database` types are reached through a single relaxed client (`core/client.ts`),
  so every loose cast is isolated there and feature code stays fully typed.

This layer is **additive**. It does not remove or alter the existing
`features/*` mock stores or `features/auth` / `features/attendance` APIs — where
those already exist, the services **compose** them rather than duplicate them.

---

## 2. Folder structure

> The layer has grown well beyond the original eight domains. Full current set
> (35 service modules, 32 extending `BaseService`):

```
src/services/
  core/                 # Shared foundation
    base-service.ts     # Generic CRUD base class
    client.ts           # Relaxed + typed Supabase clients
    errors.ts           # ServiceError + normalizers
    types.ts            # ListParams, Paginated, Filters, …
    index.ts
  auth/                 # AuthService          → profiles, user_roles, supabase.auth
  attendance/           # Attendance{,Records,Sessions,Events}Service, BreakSessionsService
  hr/                   # Departments/Employees/Positions/Teams services
  projects/             # Projects, Epics, Milestones, Members, Roles, Risks,
                        #   Activity, Calendar, Workspace, ProjectRecords services
  sprints/              # SprintsService
  tasks/                # TasksService         → tasks (table not yet in schema)
  reports/              # Reports, DailyReports, StatusUpdates, DependencyRequests
  approvals/            # ApprovalRequests, ApprovalActions services
  activity/             # ActivityFeedService  → activity_feed (append-only)
  notifications/        # Notifications, Preferences, Mentions services
  analytics/            # AnalyticsService     → saved_reports + aggregate RPCs
  kpi/                  # ExecutiveKpiService  (see docs/KPI_SERVICES.md)
  ai/                   # AiService            → ai_conversations, ai_messages, Edge Fn
  index.ts              # Barrel — import everything from "@/services"
```

> The `## 4. Domain services` catalog below documents the original eight in
> detail; the HR, sprints, approvals, activity, kpi, and additional `projects/*`
> services follow the identical pattern (class + singleton + barrel).

Each domain folder exposes:

- a **service class** (`<Domain>Service`) extending `BaseService`,
- a **shared singleton** instance (`<domain>Service`) — import this, not the class,
- an **`index.ts`** barrel re-exporting the class, the singleton, and its types.

---

## 3. Core foundation

### `BaseService<Row, Insert, Update>`

Generic CRUD base. A concrete service declares its table and row shapes and
inherits the full verb set; domain-specific reads/mutations are added as extra
methods on the subclass.

```ts
class ProjectsService extends BaseService<Project, ProjectInsert, ProjectUpdate> {
  protected readonly table = "projects";
  protected readonly entity = "Project";
}
```

Inherited methods:

| Method | Description |
| --- | --- |
| `list(params?)` | Rows with optional equality `filters`, `orderBy`, `direction`, `limit`/`offset`, `select`. |
| `paginate(params)` | Page-addressed list with an exact `count` (`{ rows, count, page, pageSize }`). |
| `getById(id, select?)` | Single row or `null`. |
| `getByIdOrThrow(id, select?)` | Single row, throws `ServiceError("not_found")` if missing. |
| `create(input)` | Insert one row, returns it. |
| `createMany(input[])` | Bulk insert. |
| `update(id, patch)` | Patch by id, returns the updated row. |
| `upsert(input)` | Insert or update on primary key. |
| `remove(id)` | Hard delete by id. |
| `count(filters?)` | Count rows matching equality filters. |

Subclasses can override `defaultOrderBy` (defaults to `created_at`) and reach
the relaxed client via `this.client` for bespoke queries.

### `core/client.ts`

- `supabase` — the strongly-typed generated client (used by auth & attendance,
  which target real tables / RPCs).
- `db` — a relaxed view of the same client for tables not yet in the generated
  `Database` types. **This is the only place loose casts live.**

### `core/errors.ts`

- `ServiceError` — `{ message, code, cause }`. The single error type the UI sees.
- `toServiceError(err, fallback?)` — normalizes any thrown value (Postgrest, auth,
  string) into a `ServiceError`.
- `notFound(entity, id)` — convenience for missing single-row lookups.

### `core/types.ts`

`Identifiable`, `Filters<Row>`, `ListParams<Row>`, `PageParams<Row>`,
`Paginated<Row>`, `SortDirection` — the shared query/pagination vocabulary every
service speaks.

---

## 4. Domain services

Backing tables marked _(future)_ are not yet in the generated `Database` types;
the service is wired and ready for when the migration lands. Services marked
_(live)_ compose existing, fully-typed feature APIs.

> **Schema update (since this catalog was written):** several _(future)_ tables
> have since landed in `supabase/migrations/` — `projects` (+ `milestones`,
> `epics`, members/roles), `notifications` (+ `notification_preferences`,
> `mentions`), and reports as **`daily_reports`** / `daily_status_updates` (not
> `eod_reports`). Still genuinely _(future)_: **`tasks`**, task `comments`,
> `sprints`, `saved_reports`, and the `ai_conversations` / `ai_messages` tables.
> The service code targets these names regardless; only the "landed vs. pending"
> status changed. See `docs/ARCHITECTURE.md` §10 for the authoritative table list.

### `authService` — _(live)_

Authentication, the current session, and profile/role records. CRUD targets
`profiles`; session/credential calls compose `features/auth/auth-service`.

| Method | Purpose |
| --- | --- |
| `signIn(email, password)` / `signOut()` | Password auth. |
| `requestPasswordReset(email)` | Send reset email. |
| `updatePassword(pw, metadata?)` | Update signed-in user's password. |
| `getCurrentUser()` / `getSession()` | Current auth user / session. |
| `getProfile(userId)` | Fetch a profile row. |
| `getRoles(userId)` | List a user's `AppRole`s. |
| _+ inherited CRUD on `profiles`_ | |

### `attendanceService` — _(live)_

Work sessions, breaks and team presence. CRUD targets `work_sessions`; lifecycle
transitions are RPC-backed via `features/attendance/api`.

| Method | Purpose |
| --- | --- |
| `clockIn()` / `clockOut()` | Open / finalize today's session. |
| `startBreak()` / `endBreak()` | Break lifecycle. |
| `getCurrentWorkDate()` | Server-defined work date. |
| `getTodaySession(userId)` | Session + breaks for today. |
| `getHistory(userId, filters)` | Paginated, filterable history. |
| `getTeamToday()` | Everyone's sessions today. |
| `getCompanySettings()` | Attendance configuration. |
| _+ inherited CRUD on `work_sessions`_ | |

### `projectsService` — _(future: `projects`)_

| Method | Purpose |
| --- | --- |
| `listByStatus(status, params?)` | Projects by lifecycle status. |
| `listByManager(managerId, params?)` | Projects a manager owns. |
| `setFavorite(id, favorite)` | Toggle favorite. |
| `archive(id)` | Archive (status + `archivedAt`). |
| `listMilestones(projectId)` | Project milestones. |
| `listClients()` | Clients. |
| _+ inherited CRUD on `projects`_ | |

### `tasksService` — _(future: `tasks`)_

Subtasks are ordinary task rows with a non-null `parentTaskId`.

| Method | Purpose |
| --- | --- |
| `listByProject(projectId, params?)` | Tasks in a project. |
| `listByAssignee(assigneeId, params?)` | Tasks assigned to a user. |
| `listSubtasks(parentTaskId)` | Direct children. |
| `setStatus(id, status)` | Move status; stamps `completedAt` on `done`. |
| `assign(id, assigneeId\|null)` | (Re)assign or unassign. |
| `softDelete(id)` | Move to trash (`deletedAt`). |
| `listComments(taskId)` / `addComment(taskId, authorId, body)` | Task comments. |
| _+ inherited CRUD on `tasks`_ | |

### `reportsService` — _(future: `eod_reports`)_

One report per work session.

| Method | Purpose |
| --- | --- |
| `submit(report)` | File the report for a session. |
| `getBySession(sessionId)` | Report attached to a session. |
| `listByUser(userId, params?)` | A user's reports. |
| `listByDate(workDate, params?)` | All reports for a date (HR/manager roll-up). |
| _+ inherited CRUD on `eod_reports`_ | |

### `notificationsService` — _(future: `notifications`)_

| Method | Purpose |
| --- | --- |
| `listForRecipient(recipientId, params?)` | A recipient's inbox. |
| `unreadCount(recipientId)` | Badge count. |
| `markRead(id)` / `markAllRead(recipientId)` | Read lifecycle. |
| `archive(id)` | Archive a notification. |
| `getPreferences(recipientId)` / `savePreferences(recipientId, prefs)` | Delivery preferences. |
| _+ inherited CRUD on `notifications`_ | |

### `analyticsService` — _(future: `saved_reports` + RPC views)_

Read-mostly metrics plus CRUD for saved reports. Aggregations run server-side.

| Method | Purpose |
| --- | --- |
| `listByScope(scope, params?)` | Saved reports for a scope. |
| `setPinned(id, pinned)` | Pin / unpin. |
| `getMetric(metric, filters)` | Benchmarked metric (current vs. previous). |
| `getTrend(metric, filters)` | Trend series for charts. |
| `getInsights(scope, filters)` | Generated insights. |
| _+ inherited CRUD on `saved_reports`_ | |

### `aiService` — _(future: `ai_conversations`, `ai_messages` + Edge Fn)_

Assistant conversations and completions. The model call is delegated to the
`ai-assistant` Edge Function so provider keys never reach the browser; it
persists the exchange and returns the reply. (Per `CLAUDE.md`, build AI features
on the latest Claude models — e.g. `claude-opus-4-8`.)

| Method | Purpose |
| --- | --- |
| `listForUser(userId, params?)` | A user's conversations. |
| `listMessages(conversationId)` | Messages in a thread. |
| `ask(request)` | Send a prompt; returns `{ conversationId, message }`. |
| _+ inherited CRUD on `ai_conversations`_ | |

---

## 5. Usage

Always import the **singleton** from the barrel:

```ts
import { tasksService } from "@/services";

const tasks = await tasksService.listByProject(projectId, {
  filters: { status: "in_progress" },
  orderBy: "priority",
  direction: "desc",
});
```

Inside a TanStack Query hook:

```ts
import { useQuery } from "@tanstack/react-query";
import { notificationsService } from "@/services";

export function useUnreadCount(userId: string) {
  return useQuery({
    queryKey: ["notifications", "unread", userId],
    queryFn: () => notificationsService.unreadCount(userId),
  });
}
```

Error handling — every method rejects with a `ServiceError`:

```ts
import { ServiceError } from "@/services";

try {
  await tasksService.getByIdOrThrow(id);
} catch (err) {
  if (err instanceof ServiceError && err.code === "not_found") {
    // show a 404 state
  }
}
```

---

## 6. Conventions

- **Components never call APIs directly** — only services do (`CLAUDE.md`).
- **Import singletons, not classes.** Classes are exported only for testing /
  extension.
- **Add domain methods to the subclass;** never re-implement the inherited CRUD.
- **Throw `ServiceError`.** Wrap bespoke queries in `try/catch` with
  `toServiceError`.
- **Keep casts in `core/client.ts`.** When a table enters the generated
  `Database` types, switch that service from `db` to the typed `supabase` client
  and drop its `as unknown as` casts.
- **No mocks were removed.** Wiring these services into the UI (replacing the
  in-browser stores) is deliberately a later step.
