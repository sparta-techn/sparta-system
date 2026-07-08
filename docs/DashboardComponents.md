# Dashboard Components

All widgets live in `src/features/dashboard/components/`. They consume props (or, for now, the mock layer) and render with design-system primitives only — no hardcoded colors.

## Inventory

| Component             | Purpose                                                                                      | Key primitives                                        |
| --------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TodayStatusCard`     | Live clock, work status, start/break/finish actions, working + break timers.                 | `Card`, `Button`, `StatusBadge`                       |
| `QuickSummary`        | Six KPI cards: today's tasks, completed, pending, dependencies, notifications, hours worked. | `StatCard`                                            |
| `CheckInCard`         | Morning ritual preview (mood, focus, blockers) + CTA.                                        | `Card`, `Button`, `StatusBadge`                       |
| `CurrentTasks`        | List of ClickUp-style tasks with status, priority, deadline, progress, assignee.             | `Card`, `Progress`, `StatusBadge`, `Avatar`           |
| `DependenciesWidget`  | Tabbed view: waiting vs blocking, with owner, department, priority.                          | `Tabs`, `Card`, `StatusBadge`, `Avatar`, `EmptyState` |
| `MiddayStatusCard`    | Progress %, blockers list, since-morning delta, submit CTA.                                  | `Card`, `Progress`, `StatusBadge`                     |
| `ActivityTimeline`    | Today's events on a vertical timeline (clock-in → clock-out).                                | `Card`, ordered list with rail                        |
| `TeamSnapshot`        | Grid of teammate avatars with online dot + tooltip; counts per status.                       | `Avatar`, `Tooltip`                                   |
| `NotificationsWidget` | Latest notifications with kind icon, unread highlight, count badge.                          | `Card`, `Button`                                      |
| `QuickActions`        | 6 primary call-to-actions in a 2-column grid.                                                | `Button`                                              |

## Conventions

- Each widget is a self-contained `Card` so it can be re-arranged without layout breakage.
- Headers use `CardTitle` (not `<h1>`) so the page has a single H1 in `PageHeader`.
- Status pills go through `StatusBadge` (`@/components/status-badge`) for tone consistency.
- Numbers, times, and percentages get `tabular-nums` to prevent shifting.
- Icon-only buttons (start work, mark all read) always pair with `aria-label`.
- Hover affordances use `hover:bg-accent/40` for rows; never custom colors.

## Mock data contract

`src/features/dashboard/mock-data.ts` exports typed shapes:

- `WorkStatus`, `mockToday`, `WORK_STATUS_META`
- `mockSummary`
- `mockCheckIn`, `mockMidday`
- `MockTask[]`, `MockDependency[]`, `MockActivity[]`, `MockTeammate[]`, `MockNotification[]`

When wiring to the backend, replace each `mock*` import with a `useSuspenseQuery` returning the same shape. No component prop changes are required.

## Extending

To add a new widget:

1. Drop a component in `src/features/dashboard/components/`.
2. Add a typed mock entry in `mock-data.ts`.
3. Compose it into a `<section aria-label="…">` in `routes/_authenticated/app/index.tsx`, using the existing 2/3 + 1/3 grid pattern.

## Accessibility checklist (per widget)

- [ ] One semantic heading via `CardTitle`.
- [ ] All status colors paired with a text label.
- [ ] Tap targets ≥ 36px (buttons default to `h-9`/`h-10`).
- [ ] Focus ring visible (`focus-visible:ring-ring`).
- [ ] Loading + empty states defined where lists exist.
