# Performance & Analytics

Comprehensive analytics experience for SpartaFlow Hub. Helps employees, team leads, project managers, HR, and owners understand productivity, collaboration, and operational health. The module emphasizes **trends, bottlenecks, and actionable insights** rather than simplistic activity ranking of individuals.

## Scopes & Role Visibility

| Scope        | Route                          | Visible to                          | Focus                                    |
| ------------ | ------------------------------ | ----------------------------------- | ---------------------------------------- |
| Personal     | `/app/analytics`               | Every employee (own data only)      | My attendance, reporting, deps, health   |
| Team         | `/app/analytics/team`          | Team leads, managers                | A team's flow, blockers, workload        |
| HR           | `/app/analytics/hr`            | HR, owners                          | Compliance, lifecycle, hiring funnel     |
| Executive    | `/app/analytics/executive`     | Owners, exec stakeholders           | Company health, risks, project portfolio |
| Saved reports| `/app/analytics/saved`         | All authenticated users             | Pinned dashboards, scheduled exports     |

All routes live under `_authenticated/app/analytics` and share:
- `AnalyticsFiltersProvider` context for filters
- `AnalyticsSubnav` for switching scopes
- `ExportMenu` for PDF / Excel / CSV / Print
- `FiltersBar` (per scope, with role-aware fields)

## Metric Surfaces

### Employee (personal)
- Attendance trend (weekly)
- Working hours trend (daily)
- Morning check-in / Midday / EoD completion rates
- Dependencies created & resolved
- Avg dependency resolution time
- Personal work-health composite trend
- Daily activity heatmap (day × hour intensity)

### Team
- Attendance rate
- Report completion rate
- Open vs resolved dependencies
- Average blocker duration
- Average work-session length
- Workload distribution by member
- Team health composite + breakdown (flow / focus / wellbeing / collaboration)

### HR
- Attendance compliance
- Leave trends (sick / vacation / personal)
- New hires by month
- Retention placeholder
- Department growth
- Invitation funnel (sent → opened → accepted → activated)
- Onboarding completion by cohort

### Executive
- Company health score (composite)
- Department health
- Project health table
- Operational risks (severity-ranked)
- Dependency, report, and attendance compliance trends

## Filters

`FiltersBar` exposes role-aware controls:
- **Date range** — 7d / 30d / QTD / YTD / Custom (placeholder)
- **Benchmark period** — WoW / MoM / QoQ (drives TrendCard comparison labels)
- **Department / Team / Role / Employee / Project** — hidden on `personal`

State lives in `AnalyticsFiltersProvider` (React context). All charts read the **same filter state**; for now they render mock data and ignore actual filter values, but the interfaces are wired so a future analytics pipeline can subscribe.

## Insights

`InsightCard` renders deterministic mock insights from `insightsByScope`. Each entry carries:
- `title`, `description`
- `intent` (positive / negative / warning / neutral)
- optional `delta` (e.g. `+11pp`, `-31%`)

Goal: each scope ships with 4 high-signal insights that highlight **change**, **bottleneck**, or **risk**. Future implementation: replace the mock array with a server-fn that returns the top N pre-computed insights per scope.

## Benchmarks

`TrendCard` accepts `{ current, previous, format }`. The benchmark toggle (WoW / MoM / QoQ) only changes the label today; in production it should drive the `previous` value selected by the analytics pipeline.

## Exports & Saved Reports

`ExportMenu` is a UI placeholder for PDF / Excel / CSV / Print. The Print action is real (`window.print`). The others emit toasts and are ready to be wired to a server-fn generator.

`SavedReportsList` supports:
- Saving the current view as a named report
- Pinning / unpinning
- Deleting
- Optional schedule label (daily / weekly / monthly) — UI placeholder for `analytics_schedule` cron in a later phase

## Accessibility

- All charts have `role="img"` and an `aria-label`.
- Heatmap uses a `<table>` with `<th scope="row">` and per-cell `title`/`aria-label`.
- Filters are keyboard navigable (shadcn `Select`, `Tabs`).
- Color encoding always pairs with a numeric label so it is not the only signal.
- The donut chart legend lists labels + percentages alongside the colored swatch.

## Loading & Empty States

- `LoadingState`, `ListSkeleton`, and `EmptyState` from `@/components/states` are used in saved reports.
- Chart cards fail-safe with empty data (each chart returns `null` or an empty grid on empty input).
- Add `Skeleton`-based chart placeholders when wiring real loaders.

## Responsiveness

- Mobile: KPIs collapse to 2-up, charts span full width.
- Tablet: 2-up chart grid (`xl:grid-cols-2`).
- Desktop: 3 / 4-column KPI rows; side-by-side workload + breakdown panels.

## Mock Data

Single source: `src/features/analytics/mock-data.ts`. All series are deterministic (no Math.random), so screenshots and tests are stable.

## Future Work

- Replace `mock-data.ts` with `server-fn` powered queries (`getPersonalAnalytics`, `getTeamAnalytics`, etc.).
- Promote `FiltersBar` to push state to URL search params (`?range=30d&department=Engineering`) — TanStack search params + zod validator.
- Real PDF / Excel pipeline via background job; emit notifications when ready.
- Insight generation moved to a scheduled job; persisted with `dismissed_at` to dedupe per user.
- Realtime metrics for the executive dashboard via Supabase channels.
