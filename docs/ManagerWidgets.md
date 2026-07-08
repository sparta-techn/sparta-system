# Manager Widgets — Reference

All components live under `src/features/manager/components/`.

| Widget                 | File                        | Purpose                                                                                                    |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `KpiGrid`              | `kpi-grid.tsx`              | 10 KPI cards (working, on break, late, absent, pending check-ins/midday/EOD, open/blocked deps, critical). |
| `BlockersPanel`        | `blockers-panel.tsx`        | Sorted blocker list with priority, owner, age.                                                             |
| `NotificationsPanel`   | `notifications-panel.tsx`   | Critical / warning / info alerts.                                                                          |
| `TeamStatusBoard`      | `team-status-board.tsx`     | Searchable, sortable, paginated team table.                                                                |
| `TeamHealth`           | `team-health.tsx`           | Composite score + three rate bars + avg response/working metrics.                                          |
| `ReportCompliance`     | `report-compliance.tsx`     | Check-in / midday / EOD completion rates.                                                                  |
| `AttendanceOverview`   | `attendance-overview.tsx`   | Stacked bar across every attendance state.                                                                 |
| `WorkloadDistribution` | `workload-distribution.tsx` | Open vs done by dept + overloaded/under lists.                                                             |
| `LiveActivityFeed`     | `live-activity-feed.tsx`    | Real-time event stream (mock).                                                                             |
| `TeamCalendar`         | `team-calendar.tsx`         | Leaves, holidays, birthdays, meetings.                                                                     |
| `ManagerQuickActions`  | `manager-quick-actions.tsx` | Reminder / announcement / assign / export.                                                                 |
| `AnalyticsPreview`     | `analytics-preview.tsx`     | Sparkline trends + workload bar chart.                                                                     |
| `EmployeeDrawer`       | `employee-drawer.tsx`       | Tabbed `Sheet` with full employee detail.                                                                  |

## Contracts

All widgets:

- Take **no props** for their data (data comes from `mock-data.ts`). The exception is `TeamStatusBoard`, which takes `onOpen: (id: string) => void` to open the drawer, and `EmployeeDrawer` itself which is controlled.
- Render the same loading/empty/error contract — substitute with `<ListSkeleton />`, `<EmptyState />`, or `<ErrorState />` from `@/components/states` when wiring real data.
- Never use raw colour utilities. All colour comes through the design system tokens (`bg-success`, `bg-warning-soft`, `text-destructive`, etc.).

## Composition recipe

```tsx
<AppShell>
  <PageHeader title="Manager dashboard" />
  <KpiGrid />
  <BlockersPanel /> + <NotificationsPanel />
  <TeamStatusBoard onOpen={setOpenId} />
  <TeamHealth /> + <ReportCompliance /> + <AttendanceOverview />
  <WorkloadDistribution /> + <LiveActivityFeed />
  <TeamCalendar /> + <ManagerQuickActions />
  <AnalyticsPreview />
  <EmployeeDrawer employeeId={openId} ... />
</AppShell>
```

## Wiring to real data

When the backend lands, introduce a single facade hook per widget (e.g. `useTeamStatus()`, `useBlockers()`). The widget JSX should require **no markup changes** — only swap the data source and add `isPending` → `<ListSkeleton />` / `isError` → `<ErrorState />` branches at the top.
