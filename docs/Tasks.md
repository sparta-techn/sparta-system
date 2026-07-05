# Tasks

> Single, scalable unit of work in SpartaFlow Hub. Lives under a Project,
> optionally rolls up to an Epic and/or Milestone, can hold an unlimited
> tree of subtasks, and exposes the full collaboration surface (checklist,
> comments, activity, watchers, dependencies).

This document is the contract for the Tasks module. It is referenced by
every implementation prompt that touches tasks.

---

## 1. Scope

**In scope (this module):** CRUD, status workflow, priority, labels,
checklist, assignee/reporter/watchers, dates, story points, attachments
(UI placeholders), task relations, related cross-team dependencies,
subtask nesting, list/table/cards views, filters, saved filters,
favorites, bulk actions, search, sorting, archive/restore/soft delete,
duplicate, dashboard widgets, mock data.

**Out of scope (later modules):** Kanban board, Sprint planning, time
tracking (timer + timesheets), AI suggestions, real backend
synchronization. Tabs and fields exist as placeholders where relevant.

---

## 2. Data model

The store mirrors the future Supabase tables (`tasks`, `task_checklists`,
`task_watchers`, `task_relations`, `task_comments`, `task_activity`,
`saved_filters`, `task_favorites`). Source of truth lives in
`src/features/tasks/types.ts`.

```
Task
  id, ref ("ETB-142")
  title, description (markdown)
  status (8)        backlog | todo | in_progress | review | qa | done | blocked | cancelled
  priority (4)      low | medium | high | critical
  labels (10)       bug, feature, chore, spike, research, docs, design, tech-debt, security, perf
  projectId         → Project (required)
  epicId            → Epic (nullable)
  milestoneId       → TaskMilestone (nullable)
  sprintId          → Sprint (nullable, future)
  assigneeId        → HrEmployee (nullable)
  reporterId        → HrEmployee (required)
  watcherIds[]      → HrEmployee
  startDate, dueDate, estimatedHours, storyPoints
  checklist[]       ChecklistItem { id, text, done, assigneeId?, dueAt? }
  attachments[]     TaskAttachment (UI-only for now)
  relatedDependencyIds[]   ← Dependency module ref
  parentTaskId      → Task (nullable) — defines the subtask tree
  relations[]       TaskRelation { kind: blocks | blocked_by | relates_to | duplicates }
  createdAt, updatedAt, completedAt, archivedAt, deletedAt
```

### Side tables
- `TaskComment { id, taskId, authorId, body, createdAt }`
- `TaskActivity { id, taskId, at, actorId, kind, summary, meta? }`
- `Epic { id, projectId, name, color, ownerId }`
- `TaskMilestone { id, projectId, name, dueDate }`
- `SavedFilter { id, name, pinned, filters, sort?, createdBy, createdAt }`

### Cross-feature references
- **Project** — `task.projectId → Project.id`. Ref `XYZ-123` is derived
  from project key. Reassigning the project triggers a new ref on
  creation, kept stable on updates.
- **Dependency** — `task.relatedDependencyIds[]`. Weak reference, both
  sides queryable from `/app/dependencies` and the task detail.
- **Sprint** — `task.sprintId` reserved; Sprints module owns reads.

---

## 3. Routes

| Route | Purpose |
|---|---|
| `/app/tasks` | Overview: KPIs + dashboard widgets. |
| `/app/tasks/all` | Full list with filters, sorting, view switcher, bulk actions. |
| `/app/tasks/$id` | Task detail with tabs and side panel. |

The route layout `/app/tasks` provides the page header, top tab nav, and
the global "New task" entry point. Detail page reuses the same shell.

---

## 4. Views

`/app/tasks/all` supports three views — same data, same filters, same
sort:

- **List** (default) — dense rows with multi-select, badges, due date,
  checklist progress, comment count, assignee avatar.
- **Table** — sortable columns for ref, title, status, priority,
  project, assignee, due. Best for ops/QA triage.
- **Compact Cards** — 2–3 columns of summary cards. Best for review
  meetings and small lists.

Selection state persists across view switches within a session.

---

## 5. Task detail

Header: project chip, ref, title, status / priority / label chips,
favorite star, row actions (duplicate, archive, delete).

Tabs:
1. **Overview** — description editor (markdown today, rich text later)
   and comments.
2. **Checklist** — add/check/remove inline items with progress bar.
3. **Subtasks** — nested tree, see `Subtasks.md`.
4. **Activity** — chronological feed driven by the store's activity log.
5. **Files** — attachments list. Upload UI ships with backend sync.
6. **Dependencies** — cross-task relations (`blocks`, `blocked_by`,
   `relates_to`, `duplicates`) and linked cross-team dependencies.
7. **Time logs** — disabled placeholder. Owned by future Time Tracking.

Side panel: status, priority, assignee, reporter, project, start, due,
estimate, story points, labels, watchers, audit footer.

---

## 6. Filters, sorting, saved views

Filters available everywhere lists are rendered:

- search (title / ref / description, case-insensitive)
- status, priority, labels (multi-select)
- project, epic, milestone (single or multi)
- assignee, reporter, watcher
- overdue only · unassigned only · include archived · top-level only · has subtasks

Sort keys: `updated`, `created`, `priority`, `due`, `status`, `title`,
each with ascending/descending.

**Saved filters** persist via the store (mock-backed by `localStorage`,
designed to swap for `saved_filters` table). Pinned saved filters appear
as quick pills above the list. The seed includes "My open tasks",
"Overdue across teams", "Critical & high", "Unassigned backlog".

---

## 7. Bulk actions

Multi-select via row checkboxes activates a sticky bulk bar:

- Set status to any of the 8 workflow states
- Archive (sets `archivedAt`)
- Delete (soft delete via `deletedAt`)

`bulkUpdate` writes through the same `updateTask` codepath, so activity
events fire for every affected row.

---

## 8. Favorites

Per-user list of task ids. UI surfaces a gold star on row, card, and
detail. Future Supabase shape: `task_favorites (user_id, task_id)`.

---

## 9. Dashboard widgets

Exposed from `src/features/tasks/components/dashboard-widgets.tsx` for
reuse on dashboards:

| Widget | Filter |
|---|---|
| `MyTasksWidget` | assigneeIds = current, status ∈ open set |
| `OverdueTasksWidget` | overdueOnly, topLevelOnly |
| `TodayTasksWidget` | dueDate within today |
| `RecentlyUpdatedWidget` | sort updated desc |
| `AssignedToMeWidget` | assigneeIds = current |

Each widget composes the canonical `<TaskRow>` mini-card, so visuals
stay consistent across the product.

---

## 10. RBAC

| Action | employee | team_lead | project_manager | hr | admin/owner |
|---|---|---|---|---|---|
| View tasks in their projects | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create tasks in their projects | ✅ | ✅ | ✅ | — | ✅ |
| Edit assignee / status of own tasks | ✅ | ✅ | ✅ | — | ✅ |
| Bulk update | — | ✅ | ✅ | — | ✅ |
| Archive / restore | — | ✅ | ✅ | — | ✅ |
| Delete | — | — | ✅ | — | ✅ |
| Manage saved filters (personal) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage saved filters (shared) | — | — | ✅ | — | ✅ |

UI gating is UX only; future RLS policies are the source of truth.

---

## 11. Edge cases

- **Reassigning project** never re-keys the ref; project moves are
  rare and the ref carries history value.
- **Deleting a parent** soft-deletes the parent only; subtasks remain
  visible at their own URLs but flagged as "orphaned" in a later pass.
- **Closing a parent** does not close subtasks — explicit, never
  silent.
- **Status changes** for cross-task relations (`blocked_by`) do not
  auto-unblock; the user is the source of truth.
- **Saved filters** referencing a removed project still load — the
  filter simply matches nothing.

---

## 12. Files

```
src/features/tasks/
  types.ts
  mock-data.ts
  store.ts
  utils.ts
  components/
    badges.tsx
    employee-chip.tsx
    create-task-dialog.tsx
    task-row.tsx
    task-card.tsx
    task-table.tsx
    tasks-list.tsx
    tasks-filter-bar.tsx
    task-detail.tsx
    task-checklist.tsx
    task-comments.tsx
    task-activity.tsx
    subtask-tree.tsx
    dashboard-widgets.tsx

src/routes/_authenticated/app/
  tasks.tsx            ← layout
  tasks.index.tsx      ← overview
  tasks.all.tsx        ← list / table / cards
  tasks.$id.tsx        ← detail
```
