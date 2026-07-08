# Employee Dashboard

The Employee Dashboard is the **landing surface after login** at `/app`. It is intentionally a "single calm screen" that answers the six questions every employee asks at the start of the day:

1. What should I do today?
2. Am I working or late?
3. What tasks am I responsible for?
4. Who do I depend on?
5. What is blocking me?
6. What did I do today so far?

## UX Principles

- **Action-first.** Every section either reports a status or invites a single action.
- **One H1 per page.** `PageHeader` owns the greeting; subsequent sections use `CardTitle`.
- **Status is structural.** Each status uses `StatusBadge` with a label — never color alone.
- **Real-time ready.** The clock + working/break timers tick locally; data hooks can later swap mock for live queries without touching layout.
- **Non-overwhelming.** Sections degrade to single column on mobile in a deliberate vertical reading order.

## Information Hierarchy (top → bottom)

1. **Greeting + page-level actions** — `PageHeader`.
2. **Today Status + Quick Actions** — the only screen elements above the fold required to act.
3. **Quick Summary** — 6 KPI cards.
4. **Current Tasks (2/3) + Check-in & Midday (1/3)** — work + rituals.
5. **Dependencies (2/3) + Team Snapshot (1/3)** — collaboration.
6. **Activity Timeline (2/3) + Notifications (1/3)** — context + inbox.

## Responsive Layout

| Breakpoint       | Layout                                                     |
| ---------------- | ---------------------------------------------------------- |
| `< 640` (mobile) | Single column, vertical stack.                             |
| `≥ 640` (sm)     | KPIs become 2-up.                                          |
| `≥ 1024` (lg)    | KPIs 3-up.                                                 |
| `≥ 1280` (xl)    | Multi-column grids activate (2/3 + 1/3 splits, 6-up KPIs). |

## State Handling (UI only)

- **Loading** — `LoadingState` / `ListSkeleton` from `@/components/states`.
- **Empty** — `EmptyState` (dependencies widget already wired).
- **Error** — `ErrorState` with retry slot.

## Mock Data

All values come from `src/features/dashboard/mock-data.ts`. Real Supabase / ClickUp hookup will replace these constants with `useSuspenseQuery` calls without changing component props.

## Accessibility

- `aria-label` on each `<section>` so screen readers can navigate by region.
- All icon-only buttons have `aria-label`.
- Avatars in Team Snapshot are focusable buttons with descriptive labels and tooltips.
- Focus rings inherit from the design system (`focus-visible:ring-ring`).
- Tabular numerics (`tabular-nums`) on every time, count, and percentage.

## Files

```
src/routes/_authenticated/app/index.tsx        — page composition
src/features/dashboard/mock-data.ts            — mock data layer
src/features/dashboard/components/
  today-status-card.tsx
  quick-summary.tsx
  check-in-card.tsx
  current-tasks.tsx
  dependencies-widget.tsx
  midday-status-card.tsx
  activity-timeline.tsx
  team-snapshot.tsx
  notifications-widget.tsx
  quick-actions.tsx
```

## Not implemented (out of scope for this phase)

- Backend reads/writes (attendance, reports, ClickUp sync) — UI only.
- Real role-aware variants (PM/HR/TeamLead surfaces) — separate dashboards later.
- Realtime websockets — sockets attach to the same component props later.
