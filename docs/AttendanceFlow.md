# Attendance Flow (End-to-End)

## Daily timeline (employee)

```
08:55  Login                                         → /app
09:04  Click "Start work" on TodayStatusCard
         → start_work_session()
         → work_sessions row created (status=working,
           late_minutes computed, attendance_status=on_time)
         → realtime broadcasts; manager team view updates live

12:20  Click "Start break"
         → start_break()  → work_session_breaks row open
         → session_status=on_break, break timer ticks

12:48  Click "Resume work"
         → end_break() → break.duration_seconds set
         → session_status=working

17:36  Click "Finish work"
         → finish_current_session() → finish_work_session()
         → any open break is closed
         → working_seconds, break_seconds, attendance_status computed
         → check_out_type = 'manual'
         → FinishSummaryDialog opens with the totals

  ── or, with no click at all ──

17:00  Day target reached (8h on the clock; part-time 4h worked)
         → job_auto_finish_sessions() (pg_cron, every 10 min)
         → auto_finish_session_if_due()
         → any open break is closed AT the threshold instant
         → finished_at = the exact instant the target was reached
           (back-dated, so a late sweep never inflates the day)
         → session_status = 'finished', check_out_type = 'auto'

19:00  Employee needs to work more → "Start another session"
         → start_work_session() opens a SECOND row on the same work_date
         → late_minutes = 0, no auto-finish, ordinary hours
```

## Reminder rhythm (per browser, max once/day)

```
work_start_time + 30 min   "Have you started work?"      if not_started
17:30                       "Submit your end-of-day…"     if not finished
18:00                       "You haven't checked out…"    if not finished
```

State persisted in `localStorage` keyed by today's date — a refresh
won't re-fire fired reminders, and tomorrow they reset automatically.

## Error responses surfaced as toasts

| RPC exception                      | Toast text                                   |
| ---------------------------------- | -------------------------------------------- |
| Unique violation on start          | "Work session already started today"         |
| Start break with no session        | "No active work session"                     |
| Start break while finished         | "Work already finished"                      |
| Start break while already on break | "Already on break"                           |
| Resume when not on break           | "Not currently on break"                     |
| Finish a never-started session     | "Cannot finish a session that never started" |
| Finish a finished session          | "Work already finished"                      |

The TodayStatusCard surfaces these via `sonner` and the cached session
re-reads from realtime, so the UI immediately reflects the actual
server state — there is no client-managed state machine to drift.

## Manager flow

```
HR / Manager opens /app/attendance/team
  → useQuery(teamTodayQuery)
       → SELECT * FROM work_sessions
         JOIN profiles ON profiles.id = user_id
         WHERE work_date = current_work_date()
       (RLS: sessions_read_managers passes)

Realtime channel "attendance:team-today" subscribed
  → any postgres_changes on work_sessions invalidates the query
  → grid + KPI cards refresh
```

## Integration points for future phases

| Phase             | Integration                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Morning Check-in  | Reads `useTodaySession()` to require a started session before allowing submit; writes a `check_ins` row keyed by `session_id`.                     |
| Midday Report     | Reads `useTodaySession()` for `working_seconds`/`break_seconds` mid-day; writes a `midday_reports` row.                                            |
| End-of-Day Report | Triggered from FinishSummaryDialog or 17:30 reminder; writes a `eod_reports` row keyed by `session_id`.                                            |
| HR analytics      | Aggregates `work_sessions` by `work_date`, `user_id`, joined to `departments`/`teams`.                                                             |
| Payroll export    | Sum of `working_seconds` across **all** sessions per user per month (a day may hold several rows). Overtime is removed and never priced.           |
| Leave management  | When a leave is approved for a date, a `work_sessions` row is created with `attendance_status='leave'` and zero seconds, blocking double check-in. |
| Holidays          | A row in `holidays` for that date → background job pre-creates `work_sessions` rows with `attendance_status='holiday'`.                            |

## Invariants

1. At most one **open** (`working`/`on_break`) `work_sessions` row per user, on
   any date — enforced by the partial unique index
   `work_sessions_one_open_per_user_idx`. A `(user_id, work_date)` may hold
   several rows: the auto-finished day plus any re-check-in after it.
2. `session_status='on_break'` ⇒ exactly one `work_session_breaks` row with `ended_at IS NULL` for that session.
3. `session_status='finished'` ⇒ `finished_at IS NOT NULL` and no open breaks exist for that session.
4. `working_seconds + break_seconds ≤ finished_at - started_at` (slack absorbs rounding).
5. The client never writes to these tables directly — only via the RPCs.
