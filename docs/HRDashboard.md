# HR Dashboard

The HR Dashboard is the landing surface for People Ops, Super Admins, and the Owner. It is optimised for the 30-second "what changed in the company today?" scan, not for deep project execution.

## Audience

- HR Generalists / People Partners
- Super Admin
- Owner

## Layout

1. **KPI strip** — 10 cards covering headcount, attendance compliance, pending approvals, and engagement signals (birthdays, anniversaries).
2. **People signals** — `NewEmployeesWidget`, `AttendanceAlertsWidget`, `UpcomingLeaveWidget`. These are the three lists HR opens every morning.
3. **Engagement** — `BirthdaysWidget`, `AnniversariesWidget`, `PendingInvitationsWidget`.
4. **Policy acknowledgements** — progress bar for the latest mandatory policy.

## KPIs

| KPI                   | Source                               | Notes                                   |
| --------------------- | ------------------------------------ | --------------------------------------- |
| Total employees       | `employees.length`                   | Includes all statuses                   |
| Active                | `status === "active"`                | Headcount that can work today           |
| On leave              | `status === "on_leave"`              | Approved leave only                     |
| New hires (30d)       | `joinedAt` within 30d                | Trend pill vs prior 30d                 |
| Late today            | attendance issues `type === "late"`  | Reset daily                             |
| Attendance compliance | `100 - issues/employees`             | Rolls to monthly view in compliance tab |
| Pending invitations   | `invitations.status === "pending"`   | Click → /app/hr/invitations             |
| Pending leave         | `leaveRequests.status === "pending"` | Click → /app/hr/leave                   |
| Birthdays (30d)       | `birthday` within 30d                | Used to plan celebrations               |
| Anniversaries (30d)   | derived from `joinedAt`              | Tenure milestones                       |

## Widgets (deep links)

All widgets ship with built-in `EmptyState` fallbacks and link to the relevant management page. They are pure presentational components that take no props — swap in real loaders by passing a `data` prop in a later iteration.

## Interaction notes

- Header actions: "Export" (placeholder), "New announcement" (cross-cut to /app/hr/announcements).
- Sub-nav is sticky-by-position under the page header; horizontal scroll on small screens.
- Cards collapse from 3-column to 1-column at `md` breakpoint.
