# Task Lifecycle

The status machine every task and subtask follows from creation to
closure. Status is one of eight values and is the only field that
drives the workflow.

---

## 1. States

| State         | Tone    | Meaning                                        |
| ------------- | ------- | ---------------------------------------------- |
| `backlog`     | neutral | Captured but not yet planned.                  |
| `todo`        | neutral | Planned and ready to be picked up.             |
| `in_progress` | primary | Actively being worked on.                      |
| `review`      | info    | Awaiting peer / code review.                   |
| `qa`          | info    | Awaiting verification by QA.                   |
| `done`        | success | Verified and complete.                         |
| `blocked`     | danger  | Cannot progress; reason explained in comments. |
| `cancelled`   | neutral | Closed without completing. Out of scope.       |

Display labels and tones live in `src/features/tasks/types.ts`
(`STATUS_LABEL`, `STATUS_TONE`).

---

## 2. Allowed transitions

The UI does not lock transitions — any state can move to any other —
because real-world workflows often need to jump (e.g. straight from
`todo` to `blocked`, or from `done` back to `in_progress` for a hotfix).
The recommended forward path is:

```
backlog → todo → in_progress → review → qa → done
                       ↘ blocked ↙
                       cancelled (terminal)
```

Backward moves (`done → in_progress`, `qa → in_progress`) are first-
class and emit a clear activity event.

---

## 3. Side effects per transition

The store handles these automatically inside `updateTask`:

- **`updatedAt`** is touched on every change.
- **`completedAt`** is set when status becomes `done` and cleared when
  the status moves away from `done`.
- **Activity** events are logged for `status_changed`,
  `priority_changed`, `assignee_changed`, `due_date_changed`,
  `checklist_updated`, `comment_added`, `subtask_added`, `archived`,
  `restored`, `duplicated`, `linked_dependency`.

Future automation (notifications, SLA timers) will subscribe to these
events; the activity log is intentionally the single source.

---

## 4. Open vs closed

For the purposes of KPIs and "overdue" calculations:

- **Open** = status is one of `backlog`, `todo`, `in_progress`,
  `review`, `qa`, `blocked`.
- **Closed** = status is `done` or `cancelled`.
- **Overdue** = open AND `dueDate < now`.

`isOverdue(task)` in `src/features/tasks/utils.ts` enforces this rule
consistently across rows, cards, table, and widgets.

---

## 5. Archive vs delete vs cancel

These look similar but behave differently:

| Operation     | Field                | Visible in list?                | Recoverable?             | Use when…                                             |
| ------------- | -------------------- | ------------------------------- | ------------------------ | ----------------------------------------------------- |
| Cancel        | `status = cancelled` | yes (with cancelled badge)      | yes (change status)      | The work is no longer needed.                         |
| Archive       | `archivedAt = now`   | hidden unless `includeArchived` | yes (Restore)            | Done/completed work that should not clutter the list. |
| Delete (soft) | `deletedAt = now`    | hidden everywhere               | yes (Trash view, future) | Created in error or sensitive content.                |

Hard delete is admin-only and out of scope for this module.

---

## 6. Subtasks and the lifecycle

Subtasks follow the exact same machine. A parent moving to `done` does
not auto-close its subtasks — see `Subtasks.md`. The detail page warns
when a parent is marked `done` while open subtasks remain so the user
can act intentionally.

---

## 7. Blocked is not a terminal state

`blocked` always implies there is a reason and an owner of unblocking:

- The reason belongs in a comment. UX will enforce a one-line reason
  on transition when the comments module supports inline prompts.
- The unblock owner is the `assigneeId` by default. If the blocker is
  cross-team, link a row from the Dependencies module via the
  task's "Dependencies" tab.
- Time spent in `blocked` is tracked for SLA reporting (future work).

---

## 8. Future hooks

- Status changes will publish `event-bus` events
  (`task.status_changed`, `task.blocked`) so the automation engine can
  notify watchers and managers.
- Status policies per project (e.g. "block transition to `done` if
  open subtasks exist") will live in workspace settings.
- Sprint module will introduce a `committed` flag orthogonal to
  status; it does not change the state machine.
