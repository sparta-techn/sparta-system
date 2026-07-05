# Subtasks

Subtasks decompose a task into smaller, independently trackable units.
They are not a separate entity — a subtask is a `Task` row with a
non-null `parentTaskId`. This keeps the data model flat and allows the
tree to nest indefinitely.

---

## 1. Why one entity, not two

A separate `Subtask` table would force two parallel schemas for the
same workflow (status, priority, assignee, due date, checklist,
comments). Every UI improvement to tasks would need to be duplicated.
By treating subtasks as tasks-with-a-parent we get:

- Identical permissions, RLS, activity stream, and notifications.
- Unlimited nesting (subtask of subtask of subtask…) with no schema
  change.
- Free reuse of every filter, view, and bulk action.
- A single `ref` namespace per project (no `ETB-1.2` parsing).

---

## 2. Fields a subtask supports

Per the spec, each subtask carries:

- **Status** — same 8-state machine as tasks (see `TaskLifecycle.md`).
- **Assignee** — independent of the parent's assignee.
- **Due date** — should sit on or before the parent's due date by
  convention; not enforced.
- **Progress** — derived from checklist + status, mirrored to the
  parent's tree progress bar.
- **Checklist** — full checklist support; nested checklists are not
  encouraged — promote checklist items that need their own discussion
  into subtasks.

Subtasks also inherit everything else from `Task`: labels, watchers,
comments, attachments, relations, related dependencies.

---

## 3. UI surface

`src/features/tasks/components/subtask-tree.tsx` renders the
`Subtasks` tab on the task detail page. Behaviour:

- Direct children render as a flat tree; deeper nesting is indented
  16px per level.
- Each row exposes status badge, priority badge, checklist progress,
  due date, assignee avatar, and an inline "add nested subtask" button.
- Expand / collapse is per-row, default expanded.
- The "Add subtask" button at the top opens the canonical
  `CreateTaskDialog` with `parentTaskId` pre-bound and the project
  locked to the root project.
- Progress summary above the tree counts all descendants (not just
  direct children) and reports `done / total` plus a percentage bar.

Subtasks are clickable; clicking opens the same task detail surface,
which itself shows its own subtask tree. There is no special "subtask
view" — the detail page is recursive by design.

---

## 4. Behaviour rules

- Creating a subtask records two activity events: `created` on the
  child and `subtask_added` on the parent.
- Soft-deleting a parent does not soft-delete its children. They keep
  their `parentTaskId` and surface as orphaned in the parent list (the
  future "Trash" view).
- Archiving a parent does not archive children. Bulk actions on the
  tree are done by multi-selecting in the list view.
- Closing the parent does **not** auto-close subtasks; the user is the
  source of truth. The detail page shows a banner when open subtasks
  remain after the parent moves to `done`.
- A subtask cannot have itself or one of its descendants as a parent —
  cycles are rejected by the store (defensive; UI prevents this too).

---

## 5. Querying subtasks

The store exposes:

- `listSubtasks(parentId)` — direct children only.
- `listDescendants(rootId)` — full transitive set.
- `applyFilters(tasks, { topLevelOnly: true })` — hides subtasks from
  list/table/cards views. This is the default for `/app/tasks/all`.
- `applyFilters(tasks, { hasSubtasks: true })` — surfaces parents that
  have any non-deleted children.

Subtasks of a project also count toward project KPIs (open / overdue
/ completed) because they are tasks.

---

## 6. Future considerations

- A "Convert to subtask of…" action that re-parents an existing task.
- A "Promote to top-level" action for the reverse.
- Drag-and-drop reordering within the subtree; today, order is the
  order in which they were created.
