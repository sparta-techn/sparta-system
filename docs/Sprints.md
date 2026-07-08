# Sprints

Time-boxed iteration grouping over existing **Tasks**. Sprints organize work — they never own it.

## Scope

- **Adds:** a `Sprint` entity plus a UI surface (list, detail, planning) for grouping tasks.
- **Touches:** a single new optional reference `task.sprintId` (already present in the Task type).
- **Does NOT change:** the Tasks module, the Kanban module, the Task store, or any task lifecycle logic.
- **Does NOT implement:** real analytics, velocity, burndown, capacity logic, or time tracking. All charts and reports are UI placeholders.

## Architecture

Feature-first, mirroring every other module:

```text
src/features/sprints/
  types.ts                # Sprint, SprintStatus, SprintFilters
  mock-data.ts            # 3 sprints x first 3 projects
  store.ts                # localStorage-backed reactive facade
  utils.ts                # date helpers, sprintStats, buildBurndown
  components/
    sprint-status-badge.tsx
    sprint-card.tsx
    sprints-filter-bar.tsx
    create-sprint-dialog.tsx
    add-tasks-dialog.tsx
    sprint-overview.tsx
    sprint-tasks.tsx          # reuses <TaskCard /> from features/tasks
    sprint-progress.tsx
    sprint-reports.tsx
    sprint-planning-board.tsx
    burndown-mock.tsx

src/routes/_authenticated/app/
  sprints.tsx               # layout (Outlet)
  sprints.index.tsx         # /app/sprints — list
  sprints.$id.tsx           # /app/sprints/:id — detail (tabs)
```

The Sprints store **delegates** all task mutations (`addTaskToSprint`, `removeTaskFromSprint`) to the existing Tasks store via `updateTask(id, { sprintId })`. There is no parallel task storage and no fork of task ownership logic.

## Data Model

```ts
Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate: ISO;
  endDate: ISO;
  status: "planned" | "active" | "completed";
  goal: string;
  capacity: number; // UI-only story points
  createdAt: ISO;
}

// Existing — unchanged
Task.sprintId: string | null;
```

A Task belongs to **at most one** sprint at a time. Removing a task from a sprint nulls its `sprintId` and returns it to the project backlog.

## Status Lifecycle

`Planned → Active → Completed`. Transitions are manual via primary action in the detail header (`Start sprint`, `Complete sprint`). Deleting a sprint detaches its tasks back to the backlog (tasks are never deleted).

## Screens

### Sprint list — `/app/sprints`

- Sorted: Active → Planned → Completed, then start date desc.
- Filters: search, project, status, date range (start/end overlap).
- Card surfaces goal, progress, task counts (total / done / blocked), date range, days remaining for active sprints.
- Primary action: **New sprint** (modal with project, dates, goal, capacity).

### Sprint detail — `/app/sprints/:id`

Tabs:

| Tab      | Purpose                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------- |
| Overview | Goal, date range, status, completion bar, KPI grid (Total / Done / In progress / To do / Blocked). |
| Tasks    | Filterable grid of `<TaskCard />` rows. **Add existing tasks** dialog + per-card remove.           |
| Planning | Two-column drag-and-drop board: project backlog ↔ sprint. Live capacity + workload indicator.      |
| Progress | Status-distribution bar, per-status counts, story-point capacity bar.                              |
| Reports  | Velocity / completion rate / scope change placeholders + mock burndown SVG.                        |

### Sprint planning (UI only)

- Backlog column = tasks in same project, top-level, no sprint.
- Sprint column = current sprint tasks.
- HTML5 drag-and-drop. Dropping on the sprint calls `addTaskToSprint`; dropping on the backlog calls `removeTaskFromSprint`.
- Capacity bar turns amber > 85% and red > 100%; workload indicator shows points vs `sprint.capacity`. No allocation logic beyond display.

## Reuse Boundaries

- `TaskCard` is consumed as-is. No fork, no copy.
- Project metadata (`name`, `icon`) comes from `features/projects/store`.
- Status badge, filters, dialogs use shared `components/ui/*`.
- Task creation is **not** offered anywhere in the Sprints module — only **add existing tasks**.

## Responsive

- Desktop: full grid (3-up cards, two-column planning board, KPI row of 5).
- Tablet: 2-up cards, single-column planning, KPI row wraps to 2×.
- Mobile: stacked list, scrollable tab strip, dialogs become full-width.

## Mock Data

Three sprints per project (first three projects):

1. **Sprint 1 · Authentication** — Completed, 14 days ending recently.
2. **Sprint 2 · Core Features** — Active, mid-iteration.
3. **Sprint 3 · UI Polish** — Planned, starts next week.

## Future Work

- Replace `store.ts` internals with Supabase (`sprints` table + `tasks.sprint_id` FK) — component surface unchanged.
- Wire real velocity/burndown/completion-rate by emitting sprint events (`sprint.started`, `task.added`, `task.removed`, `sprint.completed`) to the existing event bus and aggregating in the Analytics module.
- Realtime updates via Supabase channels on `sprints` and `tasks.sprint_id` changes.
- Per-sprint retrospective notes and goal-completion checkbox.
