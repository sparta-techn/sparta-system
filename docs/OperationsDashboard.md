# Operations Dashboard — UX Spec

The Manager Dashboard is the operational nerve-center. It is structured around the daily workflow of a remote-team operator.

## Daily ritual

| Time | Manager intent | Widget |
| ---- | -------------- | ------ |
| 09:00 | Who is online, who is late? | KPI Grid · Attendance Overview |
| 09:30 | Who hasn't checked in? | Report Compliance |
| 10:00 | What's blocking my team? | Blockers Panel |
| 12:00 | Are midday reports flowing? | Report Compliance |
| 14:00 | Anyone overloaded? | Workload Distribution |
| 17:00 | Did everyone close out? | Live Activity Feed · Report Compliance |
| Weekly | Trend lines | Analytics Preview |

## Visual signal system

- **Destructive (red)** — needs action today (absent, blocker > 24h, escalated).
- **Warning (amber)** — needs action this shift (late, pending report, blocker > 6h).
- **Info (blue)** — informational (on break, leave).
- **Success (green)** — healthy / completed.
- **Primary** — branded states (finished, completed reports).

## Reusable widgets
See `docs/ManagerWidgets.md`.

## Drill-down model
- Clicking any avatar or name opens the **Employee Drawer** (right-side `Sheet`).
- The drawer is the canonical employee view; no separate full-screen profile is required for v1.
- The drawer is composed of tabbed panes: Today, Attendance, Reports, Dependencies, Notifications.

## Non-goals (v1)
- No backend calls.
- No ClickUp pull.
- No editing of attendance from the dashboard.
- No persistence of filter state.

## Future-ready hooks
- Swap `managerEmployees`, `managerActivity`, `managerBlockers` for live data behind a `useManagerData()` facade.
- WebSocket / Supabase Realtime can drive the Live Activity Feed without touching widget code.
- Role-scoped views (`team-lead` / `pm` / `owner`) gate the data layer only.
