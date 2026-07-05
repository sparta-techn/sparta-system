# Work Session — Model & Lifecycle

## Database

### `public.work_sessions`

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid, owner |
| `work_date` | date in **company timezone** — UNIQUE with `user_id` |
| `started_at` | timestamptz, set on Start Work |
| `finished_at` | timestamptz, set on Finish Work |
| `session_status` | enum: `not_started` / `working` / `on_break` / `finished` |
| `attendance_status` | enum: `in_progress` / `on_time` / `late` / `half_day` / `absent` / `weekend` / `holiday` / `leave` |
| `late_minutes` | int — minutes after `work_start_time` |
| `working_seconds` | int — final value computed at finish |
| `break_seconds` | int — final value computed at finish |
| `overtime_seconds` | int — `max(0, working_seconds - expected)` |
| `timezone`, `device`, `browser`, `ip`, `location` | captured at start |

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

| Function | Returns | Errors |
|---|---|---|
| `start_work_session(_device, _browser, _ip, _location)` | `work_sessions` row | `Work session already started today` (unique violation) |
| `start_break()` | `work_session_breaks` row | `No active work session` / `Already on break` / `Work already finished` |
| `end_break()` | `work_session_breaks` row (closed) | `Not currently on break` |
| `finish_work_session()` | `work_sessions` row (totals computed) | `Already finished` / `Cannot finish a session that never started` |
| `current_work_date()` | `date` in company timezone | — |

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
overtime_seconds   = max(0, working_seconds - expected_work_minutes*60)

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
