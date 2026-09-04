# Work Session — Model & Lifecycle

## Database

### `public.work_sessions`

| Column                                            | Notes                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                              | uuid PK                                                                                            |
| `user_id`                                         | uuid, owner                                                                                        |
| `work_date`                                       | date in **company timezone** — UNIQUE with `user_id`                                               |
| `started_at`                                      | timestamptz, set on Start Work                                                                     |
| `finished_at`                                     | timestamptz, set on Finish Work                                                                    |
| `session_status`                                  | enum: `not_started` / `working` / `on_break` / `finished`                                          |
| `attendance_status`                               | enum: `in_progress` / `on_time` / `late` / `half_day` / `absent` / `weekend` / `holiday` / `leave` |
| `late_minutes`                                    | int — minutes after `work_start_time`                                                              |
| `working_seconds`                                 | int — final value computed at finish                                                               |
| `break_seconds`                                   | int — final value computed at finish                                                               |
| `overtime_seconds`                                | int — always `0` on new rows; overtime is removed. Historical values retained                      |
| `check_out_type`                                  | enum: `manual` / `auto` — how the session was closed; `NULL` on rows predating the column          |
| `timezone`, `device`, `browser`, `ip`, `location` | captured at start                                                                                  |

### `public.work_session_breaks`

One row per break. `user_id` is denormalized for cheap RLS. `duration_seconds`
is null while the break is open and computed when the break ends or the
session finishes.

## RLS

- **Read self** — every authenticated user sees their own session / breaks.
- **Read managers** — `owner`, `super_admin`, `hr`, `project_manager`,
  `team_lead` can read every session / break.
- **No direct INSERT/UPDATE/DELETE** — all writes go through SECURITY
  DEFINER functions that enforce the state machine.

## State machine

```
              start_work_session
not_started ─────────────────────► working
                                     │  ▲
                          start_break│  │ end_break
                                     ▼  │
                                  on_break
                                     │
                          finish_work_session
                                     │
                                     ▼
                                  finished

finish_work_session also reachable from `working`.
Any other transition raises an exception with a human-readable message.
```

## RPCs (all `SECURITY DEFINER`, granted to `authenticated`)

| Function                                                | Returns                               | Errors                                                                  |
| ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `start_work_session(_device, _browser, _ip, _location)` | `work_sessions` row                   | `Work session already started today` (unique violation)                 |
| `start_break()`                                         | `work_session_breaks` row             | `No active work session` / `Already on break` / `Work already finished` |
| `end_break()`                                           | `work_session_breaks` row (closed)    | `Not currently on break`                                                |
| `finish_work_session()`                                 | `work_sessions` row (totals computed) | `Already finished` / `Cannot finish a session that never started`       |
| `current_work_date()`                                   | `date` in company timezone            | —                                                                       |

## Computed fields

At **Start Work** the RPC computes:

```
late_minutes = max(0, ceil((now_local - (today + work_start_time)) / 60s))
attendance_status = late_minutes > grace_period_minutes ? 'late' : 'on_time'
```

At **Finish Work** the RPC closes any open break, sums break durations, then:

```
total_seconds      = now - started_at
working_seconds    = max(0, total - break_seconds)
day_progress       = working_seconds + min(break_seconds, break_credit)
overtime_seconds   = 0                       -- overtime removed from the product
check_out_type     = 'manual'

attendance_status  = late_minutes > grace_period_minutes
                       ? 'late'
                   : working_seconds < expected_work_minutes*60 / 2
                       ? 'half_day'
                   : 'on_time'
```

## Realtime

`work_sessions` and `work_session_breaks` are in the `supabase_realtime`
publication. The client subscribes per-user for the dashboard and
team-wide for the manager view; both invalidate their TanStack Query keys
rather than mutating cache in-place, keeping reconciliation simple.

## Code surface

```
src/features/attendance/
  api.ts                              — RPC + read wrappers
  queries.ts                          — TanStack Query options
  types.ts                            — narrow typed enums + Row aliases
  hooks/
    use-today-session.ts              — query + realtime channel
    use-timer.ts                      — useNow, useLiveElapsedSeconds, formatters
    use-attendance-reminders.ts       — browser-local reminder schedule
  components/
    today-status-card.tsx             — primary widget (live)
    finish-summary-dialog.tsx
    attendance-history-table.tsx
    team-today-grid.tsx
    attendance-status-badge.tsx
```

## Auto-finish

A session does not need a click to end. When **day progress** reaches the
employee's target it is closed automatically at the exact instant it got there:

```
finished_at    = session_target_threshold_ts(session, target, break_credit)
session_status = 'finished'
check_out_type = 'auto'

target / break_credit  ← session_day_target(user_id)
    full-time  → company_settings.expected_work_minutes, credit = max_break_minutes
    part-time  → 240 min,                                credit = 0
```

`day_progress = working_seconds + min(break_seconds, break_credit)`, so a
full-time day is 8h **on the clock** (7h worked + 1h break) and a break at or
under the allowance closes the day exactly 8h after check-in. Part-time has no
credit, so their 4h is real work and a break pushes the close out.

The mechanism is a `pg_cron` sweep, `spartaflow-auto-finish-sessions`, running
`job_auto_finish_sessions()` every 10 minutes — sessions close whether or not
anyone has the app open. The threshold is derived from real timestamps, so a
sweep firing minutes late still writes the true crossing instant; the cadence
affects only *when the row changes*, never what `finished_at` says.

Only a day's **first** session auto-finishes. Once a session for that
`work_date` has closed, the target is spent: an employee may check in again,
which opens a **second** `work_sessions` row for the same day. That row carries
`late_minutes = 0` (a 19:00 top-up is not "10 hours late"), never restates the
day as a half day, never auto-finishes, and accrues plain regular time at the
ordinary rate — there is no premium, because overtime has been removed.
