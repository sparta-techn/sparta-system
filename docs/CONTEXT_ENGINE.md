# SpartaFlow — AI Context Engine

> Reference for the Context Engine in `src/ai/context/`. It gathers grounding
> data for the AI Assistant from SpartaFlow's existing modules **through the
> service layer only** — never from UI components or feature stores. Part of the
> AI infrastructure (`docs/AI_INFRASTRUCTURE.md`); see `docs/AI_ARCHITECTURE.md`
> for the end-to-end system.
>
> Snapshot date: 2026-07-01.

---

## 1. The one rule

**The AI never queries UI components or feature stores.** Every context source
reads through a `@/services/*` service singleton — the same boundary the app
itself uses (CLAUDE.md: "Components must never call APIs directly"; the AI is
held to the mirror of that rule). This keeps context:

- **Authorized** — services run RLS-scoped queries, so the AI only ever sees rows
  the asking user could open in the UI. Grounding can never become a
  privilege-escalation path.
- **Consistent** — one query path, one set of domain rules, no view-layer coupling.
- **Swappable** — when a module's backend changes, its source changes in one place.

```
ContextRequest ─► ContextBuilder ─► CompositeContextResolver ─► [ ContextSource… ]
                                                                      │  reads via
                                                                      ▼
                                                            @/services/* singletons
                                                                      │
                                                                      ▼
                                                        Supabase (RLS-scoped rows)
```

---

## 2. Structure

```
src/ai/context/
  context-builder.ts     # ContextBuilder — surface → resolver registry (+ default)
  composite-resolver.ts  # CompositeContextResolver — runs sources, merges fragments
  surfaces.ts            # SURFACE_SOURCES map + registerDefaultResolvers()
  index.ts               # barrel; wires default resolvers onto the shared builder
  sources/               # one reusable builder per module
    source-utils.ts      #   shared helpers (hints, clamp, duration, fragment)
    profile.source.ts
    attendance.source.ts
    daily-reports.source.ts
    projects.source.ts
    tasks.source.ts
    sprints.source.ts
    time-tracking.source.ts
    comments.source.ts
    dependencies.source.ts
    notifications.source.ts
    index.ts             #   CONTEXT_SOURCES registry + getSource/getSources
```

---

## 3. Contracts

Defined in `src/ai/types/context.ts`.

```ts
interface ContextRequest {
  surface: string | null; // where the assistant opened (drives sources)
  hints: Record<string, unknown>; // scoping hints (taskId, projectId, workDate, …)
  userId: string; // the asking user — sources scope reads to this
}

interface ContextEntity {
  // one cited grounding row
  type: string;
  id: string;
  ref?: string;
  summary: string;
}

interface ContextFragment {
  // one source's contribution
  source: ContextSourceKey;
  label: string;
  entities: ContextEntity[];
  truncated: boolean;
  note?: string;
}

interface ContextSource {
  // a reusable, single-module builder
  readonly key: ContextSourceKey;
  readonly label: string;
  gather(request: ContextRequest): Promise<ContextFragment>;
}

interface ContextBlock {
  // merged, provider-ready grounding
  summary: string;
  entities: ContextEntity[];
  truncated: boolean;
}
```

The Prompt Builder renders `ContextBlock` into a delimited `<context>…</context>`
section, so the model treats it as cited data, not instructions.

---

## 4. The sources

Each source is a reusable singleton that maps one module's rows into
`ContextEntity`s. All reads go through the service layer.

| Source (`key`)  | Service(s) used                                         | Gathers                                                                          | Hints                 |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------- |
| `profile`       | `authService`, `employeesService`                       | Who is asking: name, title, roles, status, tz, location                          | —                     |
| `attendance`    | `attendanceRecordsService`, `attendanceSessionsService` | Today's record (status, worked/break/overtime) + active session                  | `workDate`            |
| `daily_reports` | `dailyReportsService`, `statusUpdatesService`           | Recent EOD reports + check-in/midday updates                                     | —                     |
| `projects`      | `projectsService`                                       | A project (`projectId`) or projects the user manages: status, health, progress   | `projectId`           |
| `tasks`         | `tasksService`                                          | A task (`taskId`), a project's tasks (`projectId`), or the user's assigned tasks | `taskId`, `projectId` |
| `sprints`       | `sprintsService`                                        | A project's sprints (`projectId`) or active sprints                              | `projectId`           |
| `time_tracking` | `attendanceSessionsService`                             | Tracked time per recent work date (see note)                                     | —                     |
| `comments`      | `tasksService.listComments`                             | Discussion on a task in scope                                                    | `taskId` (required)   |
| `dependencies`  | `dependencyRequestsService`                             | Blockers the user requested or owns, open items first                            | —                     |
| `notifications` | `notificationsService`                                  | Recent notifications + unread count                                              | —                     |

**Time tracking note.** A dedicated `time_logs` service does not exist yet; the
tracked-time signal in the service layer today is the attendance **work session**
(`duration_seconds`). `time_tracking.source.ts` reads those and documents the
swap point — when a first-class time-tracking service lands, only that source's
fetch changes; the fragment shape and consumers stay identical.

**Comments note.** Comments are entity-scoped, so `comments` requires a `taskId`
hint. Without one it returns a note ("provide a taskId…") rather than dumping
unrelated threads.

### Source conventions (`source-utils.ts`)

- `hintString(hints, key)` / `resolveWorkDate(hints)` — safe hint reads.
- `clampList(items, limit)` — cap rows per source (default 5) and flag `truncated`.
- `formatDuration(seconds)` / `snippet(text, max)` — tidy one-line summaries.
- `fragment(...)` / `emptyFragment(...)` / `dedupeById(...)` — build results.

Each source caps its output so no single module floods the prompt budget.

---

## 5. Composition & resolution

`CompositeContextResolver` runs a surface's sources **concurrently**
(`Promise.allSettled`) and merges their fragments into one `ContextBlock`.

- **Failure isolation.** A source that throws degrades to a note
  (`"unavailable — <reason>"`) instead of failing the whole request. The AI still
  gets partial, useful grounding.
- **Data-driven.** The resolver holds no module knowledge — just the source list
  handed to it. `mergeFragments()` flattens entities, builds a per-source summary,
  and ORs the `truncated` flags.

### Surface → sources (`surfaces.ts`)

`SURFACE_SOURCES` decides "when the assistant opens from X, gather Y":

| Surface                             | Sources                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `global` (default / `null` surface) | profile, attendance, daily_reports, tasks, notifications        |
| `tasks`                             | profile, tasks, comments, dependencies, sprints                 |
| `projects`                          | profile, projects, sprints, tasks                               |
| `sprints`                           | profile, sprints, tasks                                         |
| `analytics`                         | profile, projects, time_tracking, attendance                    |
| `reports`                           | profile, daily_reports, attendance, dependencies, time_tracking |
| `dependencies`                      | profile, dependencies, tasks                                    |

`registerDefaultResolvers(builder)` registers a resolver per surface and sets the
`global` resolver as the default (used for the `null` surface and any surface
without a dedicated entry). Importing `src/ai/context` wires this onto the shared
`contextBuilder` automatically, so `aiEngine` gathers real context out of the box.

---

## 6. Usage

Through the engine (normal path — the engine calls the Context Builder for you):

```ts
import { aiEngine } from "@/ai";

await aiEngine.generate({
  user: { id, displayName, roles },
  surface: "tasks",
  contextHints: { taskId: "…" }, // scopes the tasks/comments sources
  prompt: "Summarize where this task stands and what's blocking it.",
});
```

Directly (e.g. tests, previews, custom surfaces):

```ts
import { contextBuilder } from "@/ai/context";

const block = await contextBuilder.build({
  surface: "reports",
  hints: {},
  userId,
});
```

Reusing a single source in isolation:

```ts
import { tasksSource } from "@/ai/context";

const fragment = await tasksSource.gather({ surface: null, hints: {}, userId });
```

---

## 7. Extending

- **Add a source** — create `sources/<name>.source.ts` implementing
  `ContextSource`, reading only through a `@/services/*` singleton; register it in
  `sources/index.ts` (`CONTEXT_SOURCES` + `ContextSourceKey`).
- **Add/adjust a surface** — one entry in `SURFACE_SOURCES`.
- **Wire a real time-tracking service** — swap the fetch in
  `time-tracking.source.ts`; nothing else changes.

No consumer, resolver, or the engine changes when sources or surfaces evolve —
that is the point of the fragment/resolver split.

---

## 8. Verification

- `npx tsc --noEmit` — **0 errors** (whole project).
- `npx eslint "src/ai/**/*.ts"` — clean.
- No import of `@/features/**` components or stores from any source — reads go
  through `@/services/*` exclusively.

---

_The Context Engine is deliberately read-only and service-sourced. Grounding
authorization is delegated to service/RLS scoping; the engine never widens what a
user can see. Running this orchestration inside the server-side Edge Function
(`docs/AI_ARCHITECTURE.md §12`) keeps provider calls and keys off the client._
