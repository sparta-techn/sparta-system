# Kanban

> Visualization layer on top of the existing **Tasks** module. The Kanban
> board reads from `src/features/tasks/store.ts` and updates a task's
> `status` via the existing `updateTask` API when it is dragged between
> columns. It does **not** own task data, create tasks, edit fields beyond
> status, or duplicate task pages.

---

## 1. Scope

**In scope**

- Render existing tasks grouped by `Task.status`.
- Drag and drop a card between columns → write the new status through
  `updateTask(taskId, { status })`.
- Manual reorder within a column (UI-only ordering kept in the Kanban
  store).
- Horizontal scrolling on desktop / tablet, stacked vertical lists on
  mobile.
- Light task card: title, priority badge, assignee avatar, due date.
  Clicking the title navigates to `/app/tasks/$id` (the existing detail
  page).
- Filters: project, assignee, priority, epic, free-text search.
- Board settings (UI only): show/hide columns, reorder columns, WIP
  limit per column (visual indicator, never blocks a move).

**Out of scope (owned elsewhere)**

- Task CRUD, checklist, comments, subtasks, activity — Tasks module.
- Sprint planning — future Sprints module.
- Time tracking — future Time Tracking module.
- Analytics, workflows, automation.

---

## 2. Routes

| Route               | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `/app/tasks/kanban` | Kanban board view, accessible from the Tasks tab nav. |

The page mounts inside the existing `tasks.tsx` layout, so the page
header, "New task" entry point, and global tab nav stay consistent with
Overview and All tasks.

---

## 3. Columns

Default columns (in order), each backed by a `TaskStatus`:

1. Backlog
2. Todo
3. In progress
4. Review
5. QA
6. Done

`Blocked` and `Cancelled` are valid task statuses but hidden by default
to keep the board focused on the happy path. Users can show them from
Board settings.

---

## 4. Files

```
src/features/kanban/
  types.ts                              // KanbanSettings, KanbanFilters, defaults
  store.ts                              // UI-only: visible columns, order, WIP limits, manual reorder
  components/
    kanban-board.tsx                    // grouping + DnD + responsive layout
    kanban-card.tsx                     // light task card
    kanban-filters.tsx                  // search + project/assignee/priority/epic
    kanban-settings-sheet.tsx           // show/hide, reorder, WIP limits

src/routes/_authenticated/app/
  tasks.kanban.tsx                      // route entry
```

---

## 5. Data flow

```
Tasks store (existing)        Kanban store (UI only)
─────────────────────         ─────────────────────
listTasks()                   settings.columns      ← show/hide + order
updateTask(id,{status})       settings.wipLimits    ← visual only
                              order[status][]       ← manual reorder per column
```

- Reads: `listTasks()` filtered to `parentTaskId === null` + active
  filters. Tasks are grouped by `status` into visible columns.
- Writes (status change): `updateTask(id, { status: column })` — same
  codepath used everywhere else, so activity events fire automatically.
- Writes (reorder): `placeInColumn(taskId, column, index, visibleIds)` —
  Kanban-store only. Tasks not yet ordered fall back to the default
  sort (priority desc, then updated desc).

---

## 6. Filters

All filters operate on the in-memory result of `listTasks()`:

- `search` — substring match on `title` and `ref`
- `projectIds[]`
- `assigneeIds[]`
- `priorities[]`
- `epicIds[]` (only shown when epics exist)

A "Clear" button appears when any filter is active.

---

## 7. Board settings (UI only)

Sheet opened from the filters bar:

- Toggle a column's visibility.
- Move a column up/down to reorder.
- Set a numeric WIP limit per column. When `count > limit` the column
  counter turns destructive red — moves are never blocked.
- Reset returns columns and limits to defaults.

Settings persist in `localStorage` (`spartaflow:kanban:v1`).

---

## 8. Responsive

- **Desktop / tablet (`md+`)** — horizontal scrolling board with 288 px
  columns; cards are drag sources and drop targets.
- **Mobile (`<md`)** — stacked vertical list per column, no drag and
  drop. Cards remain links to the detail page.

---

## 9. RBAC

Kanban inherits Tasks module permissions:

- View board → anyone who can see the underlying tasks.
- Move a card between columns → same permission as editing status on a
  task (employee on their own tasks, lead/PM on team tasks, admin/owner
  on everything). UI gating is UX only; future RLS is the source of
  truth.

---

## 10. Edge cases

- Hiding a column with cards in it removes them from the board view —
  the underlying tasks are not modified. They reappear when the column
  is shown again or via other views.
- Setting a WIP limit lower than current count flags the column but
  does not block moves; the limit is a hint, not a constraint.
- Reordering is per-column and per-browser; it is not synced anywhere
  and never affects task fields.
- Filters apply before grouping, so column counters always reflect
  what is visible.
