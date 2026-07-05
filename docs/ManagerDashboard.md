# Manager Dashboard

Route: `/app/manager`

A real-time operational dashboard for Team Leads, Project Managers, and Owners. Designed so a manager can identify the most urgent issue **in under 30 seconds**.

## North-star principle
> Surface action, not data.

Every widget answers one of three questions:
1. **What's broken right now?** (Blockers, Notifications, Late/Absent KPIs)
2. **Who needs me?** (Team Status Board, Report Compliance)
3. **Is the team healthy this week?** (Team Health, Analytics Preview, Workload)

## Information hierarchy (top → bottom)

| Tier | Section | Goal |
| ---- | ------- | ---- |
| 1 | KPI Grid | At-a-glance counts of every actionable bucket |
| 2 | Blockers Panel + Notifications Panel | Critical signals first |
| 3 | Team Status Board | Drill into any individual |
| 4 | Team Health · Report Compliance · Attendance Overview | Daily operating health |
| 5 | Workload Distribution + Live Activity Feed | Flow + real-time pulse |
| 6 | Team Calendar + Quick Actions | Planning & one-click ops |
| 7 | Analytics Preview | Weekly trends |

## 30-second test
- Red counts (Late, Absent, Critical) live in the first viewport.
- Blockers are sorted by age (oldest first) and color-coded by priority.
- Critical notifications use the destructive token + icon, never colour alone.

## Mock data
All data is sourced from `src/features/manager/mock-data.ts`. No backend calls. No ClickUp integration. No Supabase queries. Built to be swapped to live data behind a single facade.

## Roles
- **Team Lead** — sees only direct reports (future scope; current mock is whole company).
- **Project Manager** — sees by project (future scope).
- **Owner** — sees everything (current default).

## Responsive
- **Desktop ≥ 1280px:** 3-column composition.
- **Tablet 768–1279px:** 2 columns, KPIs in 2 rows of 5.
- **Mobile < 768px:** single column. Status board scrolls horizontally; filters stack.

## Accessibility
- Every status uses both label + token (never colour alone).
- Table sorts and filters expose `aria-label`.
- Drawer is a `Sheet` with focus trap and ESC dismissal.
- Live region on the activity feed via the pulse indicator.

## Loading / Empty / Error
- `ListSkeleton` for the table loading state.
- `EmptyState` / `NoResultsState` / `ErrorState` from `@/components/states` for every list-based widget.
