# Time Tracking

A lightweight extension over the existing **Tasks** module. Time tracking is
**not** a standalone product — every `TimeLog` belongs to exactly one task
and one user. There is no billing, no payroll, no approval workflow.

## Scope

- **In:** Start/stop timer, manual time entry, per-task totals, per-user
  aggregations (today / week / month), per-project rollup.
- **Out:** Billing, invoicing, payroll, approvals, server-side time
  enforcement, idle detection.

## Data Model

```ts
TimeLog {
  id: string
  taskId: string         // FK → Task
  userId: string         // FK → User
  startTime: string      // ISO
  endTime: string | null // null = active timer
  durationMinutes: number | null  // calculated on stop
  description: string | null
  source: "timer" | "manual"
  createdAt: string
}
```

Single-active-timer policy: starting a timer while one is already running
for the same user automatically stops the previous one.

## Architecture

```
src/features/time-tracking/
  types.ts                       # TimeLog, TimeRange, ManualEntryInput
  mock-data.ts                   # seedTimeLogs + CURRENT_USER_ID
  store.ts                       # localStorage-backed reactive facade
  utils.ts                       # formatters + aggregations
  hooks/use-now.ts               # live tick for running timers
  components/
    start-stop-button.tsx        # Primary timer control
    manual-entry-dialog.tsx      # "Log time" form
    time-logs-list.tsx           # Reusable entries list
    task-time-tab.tsx            # Task Detail → "Time tracking" tab
    task-time-summary.tsx        # Compact chip (total + active indicator)
    project-time-summary.tsx     # Project Detail → "Time" tab
    my-time-logs.tsx             # /app/tasks/time page
    floating-active-timer.tsx    # Global running-timer pill in AppShell
```

Mirrors the future Supabase repository surface. Replacing the localStorage
store with server functions is a drop-in swap — UI components are unchanged.

## Store API

```ts
startTimer(taskId, userId, description?) → TimeLog
stopTimer(logId)
stopActiveTimerForUser(userId)
addManualEntry({ taskId, userId, date, hours, description? }) → TimeLog
deleteLog(logId)
updateLogDescription(logId, description)
getActiveLogForUser(userId) → TimeLog | null
getActiveLogForTask(taskId, userId) → TimeLog | null
```

Reactive selector hook:

```ts
const logs = useTimeState((s) => s.logs.filter(l => l.taskId === id));
```

## UI Surfaces

| Surface | Where | What |
|---|---|---|
| Time chip | Task header (Task Detail) | Total hours · active indicator |
| Time tab | Task Detail | Totals, daily breakdown, entries list, start/stop, manual entry |
| My time logs | `/app/tasks/time` | Today / Week / Month totals, daily bars, top tasks, entries |
| Project time | Project Detail → Time tab | Project total, contributors, active timers, top tasks |
| Floating timer | AppShell (global) | Active-timer pill — link to task, live duration, stop |

## Responsive Behavior

- **Desktop**: full Task Time tab (4-up stat row, 7-day bar chart, full entry rows).
- **Tablet**: stat row collapses to 2 columns, list rows shrink.
- **Mobile**: stat row stacks to 1 column; floating-active-timer becomes a
  compact pill anchored bottom-right with the stop control always visible.

## Live Timers

`useNow(intervalMs)` ticks every second when an active timer exists, and
every 30–60s otherwise. Components only re-render their own subtree.

## Mock Data

`mock-data.ts` seeds ~80 time logs across the first 24 seeded tasks and 10
employees, spread across the past 30 days. The current user (`emp_001`)
has fresh entries in today, this-week, and this-month buckets, plus a
single **running timer** so the live UI is exercised on first load.

## Integration Rules

- **Tasks module is not modified** beyond enabling the existing
  "Time tracking" tab in `task-detail.tsx` and inserting a single
  `<TaskTimeSummary />` chip into the task header. No store, types, or
  domain logic in `src/features/tasks/` is touched.
- **Kanban and Sprint modules are not modified.**
- No edits to `src/integrations/supabase/*`.

## Future Backend Mapping

When Supabase lands:

| Client call | Server function | Notes |
|---|---|---|
| `startTimer` | `start_time_log` | RLS: `auth.uid() = user_id`; stops prior active timer in same txn |
| `stopTimer` | `stop_time_log` | Calculates duration server-side |
| `addManualEntry` | `add_time_log` | Validates `hours > 0`, date ≤ today |
| `deleteLog` | `delete_time_log` | Soft-delete (`deleted_at`) recommended |
| Per-task totals | View `task_time_totals` | Materialized for hot paths |
| Per-user range | RPC `user_time_summary(uid, range)` | Server-computed today/week/month |

## Non-Goals (Important)

- No timesheet approval flow.
- No billable/non-billable split.
- No project budget enforcement.
- No idle/away auto-stop.
- No cross-task time conflict detection.

These belong to a future "Billing" or "Workforce" feature, not Time Tracking.
