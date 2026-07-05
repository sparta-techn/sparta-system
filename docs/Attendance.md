# Attendance & Work Session

The Attendance module is the operational spine of SpartaFlow Hub. Every
working day starts by opening a **Work Session** and ends by closing it.
All downstream features — reports, payroll, performance, late detection,
team visibility — read from this single source of truth.

## Surfaces

| Path | Audience | Purpose |
|---|---|---|
| `/app` (dashboard widget) | All employees | Live "today" status card embedded in the dashboard. |
| `/app/attendance` | All employees | Personal attendance page: today's status + paginated history. |
| `/app/attendance/team` | Manager / Team Lead / HR / Owner | Real-time team view of who's working, on break, late, finished. |

The Team view is enforced **server-side** by RLS (`sessions_read_managers`).
The link is hidden in the UI for non-privileged roles via `hasAnyRole(...)`.

## Company settings (no hardcoded rules)

All rules come from the singleton `public.company_settings` row:

| Setting | Default | Used in |
|---|---|---|
| `work_start_time` | 09:00 | Late calculation, reminder schedule |
| `grace_period_minutes` | 60 | Late/on-time classification |
| `expected_work_minutes` | 480 | Progress, remaining, overtime |
| `max_break_minutes` | 60 | Break-allowance warning |
| `timezone` | Africa/Cairo | `current_work_date()` anchor |
| `weekend_days` | {5,6} (Fri, Sat) | Weekend status (future) |

HR / Super Admin / Owner can change these. Changes propagate immediately
to every running session card (TanStack Query refetch on stale).

## States

`work_session_status`: `not_started`, `working`, `on_break`, `finished`.

`attendance_status`: `in_progress`, `on_time`, `late`, `absent`, `weekend`,
`holiday`, `half_day`, `leave`.

The legal transitions are enforced inside the SECURITY DEFINER functions —
the client can't fabricate impossible state. See `AttendanceFlow.md`.

## What this phase ships

- **Database** — enums, `company_settings`, `holidays`, `work_sessions`,
  `work_session_breaks`, RLS, state-machine RPCs, realtime publication.
- **API layer** — typed wrappers around RPCs + reads in `api.ts`.
- **Hooks** — `useTodaySession` (with realtime), `useLiveElapsedSeconds`,
  `useAttendanceReminders` (browser toast schedule).
- **Components** — `TodayStatusCard`, `FinishSummaryDialog`,
  `AttendanceHistoryTable`, `TeamTodayGrid`, `AttendanceBadge` /
  `SessionStatusBadge`.
- **Reminders** — local toasts at +30 min after start, 17:30, 18:00, fired
  at most once per day per browser, idempotent via `localStorage`.

## What this phase does NOT ship (by design)

- Morning Check-in, Midday Report, End-of-Day Report — separate phases.
  Integration points exist: hooks return today's session shape that reports
  will read from.
- Leave & holiday application UI — `holidays` table exists for status
  evaluation; admin CRUD comes with the HR phase.
- Server-pushed reminders (email/Slack/Push) — current reminders are
  browser-local; a cron + notification fan-out will replace them.
- Manual attendance corrections — HR override flow is the next iteration.

## Edge cases handled

- **Double start** → blocked by `UNIQUE (user_id, work_date)` + explicit
  error.
- **Break before clock-in / Resume without break / Finish before start** →
  blocked by state checks in the RPCs.
- **Open break at finish** → automatically closed before totals are
  computed.
- **Timezone drift** → "today" always comes from `current_work_date()`,
  which uses the company timezone.

## Performance

- Live ticking is centralized in `useLiveElapsedSeconds` (1s tick when
  running, paused otherwise). Header clock uses a shared `useNow` so the
  whole card re-renders together once per second.
- Realtime channel scoped to the current user for the dashboard card; team
  view subscribes to all `work_sessions` events but only refetches the
  aggregated query, not per-row.

## Accessibility

- Every action button has an `aria-label`.
- Status badges expose `role="status"` with the visible label.
- Break-over warning is `role="alert"` so screen readers announce it.
- Table has explicit headers; pagination controls have labels.
