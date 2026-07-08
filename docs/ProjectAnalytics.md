# Project Analytics

Read-only visualization layer over existing Tasks, Sprints, Time Logs, Comments, and Files. **No business logic, no writes, no new data models.** Lives at `src/features/project-analytics/`.

## Surface

- **Project Detail → Analytics tab** (`/app/projects/$id`) — single comprehensive dashboard per project.
- Subscribes to all five source stores so charts refresh as users add tasks/logs/comments anywhere.

## Sections

1. **Filters** — Sprint · Member · Date range (7/14/30/90 days).
2. **Overview KPIs** — Total · Completed · Open · Overdue · Blocked.
3. **Health + Insights** — Score donut + auto-generated insight cards.
4. **Progress analysis** — Cumulative completion area, status distribution bar.
5. **Task flow** — Created vs Completed per day, bottleneck stage, mock cycle time, throughput.
6. **Team performance** — Per-user progress bars, workload donut, contribution bar.
7. **Time analytics** — Total hours, avg/task, top time-consuming tasks.
8. **Sprint analytics** — Velocity bar, completion bars, mock burndown.
9. **Dependency insights** — Counts + visual chain of blocked tasks.
10. **Unified activity timeline** — Task activity + comments + files + sprint events.

## Data sources (read-only)

| Source                              | Used for                               |
| ----------------------------------- | -------------------------------------- |
| `features/tasks/store`              | All task stats, flow, status, activity |
| `features/sprints/store`            | Sprint progress, velocity, burndown    |
| `features/time-tracking/store`      | Hours, per-user time, top tasks        |
| `features/task-communication/store` | Comments + files in timeline           |
| `features/hr/mock-data`             | Member names for filters & charts      |

All selectors live in `utils.ts`. The dashboard never mutates any store.

## Charts

Reuses the existing chart primitives from `features/analytics/charts/` (`LineChart`, `BarChart`, `DonutChart`, `AreaChart`). Burndown and dependency chain are local SVGs because they have shape unique to this module.

## Responsive

- Desktop (≥ xl): two-column chart grids, five-column KPI row.
- Tablet (≥ sm): two-column KPIs, charts stack to single column.
- Mobile: every section collapses to a single stack; charts are SVG `viewBox` scalable.

## Rules enforced

- No imports from a feature's `store.ts` that call write methods.
- All "mock" values (velocity, burndown, cycle time) are deterministic — no `Math.random` at render time.
- Module exports nothing back into Tasks/Kanban/Sprints/Time/Comments/Files.
