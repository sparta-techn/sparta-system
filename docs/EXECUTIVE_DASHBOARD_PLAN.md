# SpartaFlow — Executive Dashboard Plan

> **Design document only. No application code was modified.** This is the target
> design for the owner/executive dashboard, derived from `CLAUDE.md`,
> `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, the existing
> `src/features/analytics` implementation, and the ten source feature domains.
> Snapshot date: 2026-07-02.

## 0. Context — what exists today

The Executive Dashboard is **not greenfield**. It already ships as a mock-backed
surface and must be _extended, not regenerated_ (CLAUDE.md: "Never regenerate
completed modules").

| Asset        | Location                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Component    | `src/features/analytics/components/executive-dashboard.tsx`                                                                            |
| Route        | `src/routes/_authenticated/app/analytics.executive.tsx` (`/app/analytics/executive`)                                                   |
| Charts       | `src/features/analytics/charts/` — `TrendCard`, `BarChart`, `LineChart`, `DonutChart`, `Heatmap`, `Timeline`                           |
| Cards        | `analytics/components/` — `ChartCard`, `InsightCard`/`InsightGrid`, `FiltersBar`, `ExportMenu`, `analytics-subnav`                     |
| Filters      | `analytics/filters-context.tsx` (`AnalyticsFiltersProvider` / `useAnalyticsFilters`)                                                   |
| Types        | `analytics/types.ts` (`AnalyticsScope`, `DateRange`, `BenchmarkPeriod`, `AnalyticsFilters`, `TrendPoint`, `Insight`, `BenchmarkValue`) |
| Mock source  | `analytics/mock-data.ts` (`executiveAnalytics`, `insightsByScope.executive`)                                                           |
| Existing doc | `docs/ExecutiveDashboard.md` (the current 60-second-read spec)                                                                         |

Today's surface covers **4 KPIs, department health, operational risks, dependency
trend, report/attendance compliance, project health table**. This plan keeps that
skeleton and expands it into a true cross-module executive view over all ten
domains, plus the live-data contract to replace the mock store.

### Design constraints inherited

- **Composition over duplication** — reuse `analytics/charts`, `ui/` primitives,
  `stat-card`, `states`. No new chart or card primitives.
- **60-second read** — scan KPIs → scan AI insights → drill into risks / tables.
- **No individual leaderboards** — bottom-up metrics aggregate to team/department
  level only (existing policy in `docs/ExecutiveDashboard.md`).
- **Data access through a feature module** — a new `analytics/api.ts` +
  `analytics/queries.ts` (the `attendance` pattern), never inline fetches.

---

## 1. Purpose & audience

A single-screen operating picture of the company for **owners and executives**.
It answers three questions in order:

1. **Is the company healthy right now?** (composite KPIs, AI company-health read)
2. **What is at risk?** (operational risks, blocked dependencies, at-risk projects,
   overdue sprints, compliance gaps)
3. **Where is capacity going?** (attendance, tracked hours, workload by department)

It is **read-first**: every widget links to the owning module for drill-down but
the executive never edits operational data here.

---

## 2. Source modules → what the dashboard pulls

Ten domains feed the dashboard. Each maps to a live table/view from
`DATABASE_DESIGN.md` and a mock store today.

| #   | Module            | Source (target)                                                        | Feeds                                                            |
| --- | ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **HR**            | `profiles`, `employment`, `departments`, `teams`                       | Headcount, department rollups, new hires, offboarding, birthdays |
| 2   | **Attendance**    | `work_sessions`, `work_session_breaks`, `company_settings`, `holidays` | Present/late/absent, on-time %, overtime, attendance trend       |
| 3   | **Daily Reports** | `daily_checkins`, `midday_reports`, `eod_reports`                      | Report compliance %, sentiment/mood, help requests               |
| 4   | **Projects**      | `projects`, `project_members`, `milestones`, `project_stats` view      | Project count by status/health, progress, at-risk projects       |
| 5   | **Tasks**         | `tasks`, `task_activity`                                               | Open/overdue/completed counts, throughput, cycle time            |
| 6   | **Sprint**        | `sprints`, `sprint_burndown` view                                      | Active sprints, on-track vs at-risk, committed vs done           |
| 7   | **Time Tracking** | `time_logs`, `time_log_totals` view                                    | Logged hours, utilization, billable split                        |
| 8   | **Notifications** | `notifications`                                                        | Critical/unresolved signal count, escalations                    |
| 9   | **AI**            | `AIAssistantService` → `executive-summary`, `company-health` features  | Narrative summary, generated insights, anomaly callouts          |
| 10  | **Analytics**     | `analytics_*` views, `saved_reports`                                   | Benchmarks (WoW/MoM/QoQ), trend series, saved exec reports       |

> All ten already exist as mock stores under `src/features/*`. The AI owner
> features `executive-summary` and `company-health` (surface `analytics`) are
> defined in `src/ai/features/` per `docs/AI_FEATURES.md`.

---

## 3. Layout

Extends the current composition (top KPIs → insights → 2/3+1/3 → charts → table)
with an AI narrative band and capacity/sprint rows.

```
┌──────────────────────────────────────────────────────────────────────┐
│ FiltersBar: range · benchmark · department · team · project · export │
├──────────────────────────────────────────────────────────────────────┤
│ KPI Grid (6): Company health · Attendance · Report · Delivery ·      │
│               Utilization · Open risks                               │
├──────────────────────────────────────────────────────────────────────┤
│ AI Executive Summary (narrative + generated insights)  [full width]  │
├──────────────────────────────────────────────────────────────────────┤
│ Department health (2/3)                 │ Operational risks (1/3)     │
├──────────────────────────────────────────────────────────────────────┤
│ Dependency flow trend                   │ Report & attendance trend   │
├──────────────────────────────────────────────────────────────────────┤
│ Delivery throughput trend               │ Utilization / hours trend   │
├──────────────────────────────────────────────────────────────────────┤
│ Sprint status board (active sprints, on-track vs at-risk)            │
├──────────────────────────────────────────────────────────────────────┤
│ Project health table (status · health · progress · blockers · owner) │
├──────────────────────────────────────────────────────────────────────┤
│ HR pulse strip: headcount · new hires · offboarding · birthdays      │
└──────────────────────────────────────────────────────────────────────┘
```

Grid: `grid gap-4 xl:grid-cols-3` for the 2/3+1/3 band; `xl:grid-cols-2` for
paired charts; KPI grid `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`.

---

## 4. KPIs

Rendered with the existing `TrendCard` (`analytics/charts/trend-card.tsx`): current
value, % change vs previous period, comparison label, previous value hint. Each is
a `BenchmarkValue` (`{ current, previous, unit?, format }`) driven by the selected
`benchmark` (WoW/MoM/QoQ).

| KPI                        | Definition                                                                                              | Format  | Good direction              | Source                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------- | --------------------------- | ----------------------------------- |
| **Company health**         | Composite 0–100 = weighted blend of attendance, report compliance, dependency flow, delivery, sentiment | number  | up                          | AI `company-health` + `analytics_*` |
| **Attendance compliance**  | % expected sessions present & on-time                                                                   | percent | up                          | `work_sessions`                     |
| **Report compliance**      | Avg of check-in / midday / EoD completion                                                               | percent | up                          | `daily_*`                           |
| **Delivery**               | % sprint-committed points completed (or on-time task completion %)                                      | percent | up                          | `sprint_burndown`, `tasks`          |
| **Utilization**            | Logged hours ÷ expected capacity                                                                        | percent | up (band)                   | `time_log_totals`                   |
| **Open operational risks** | Count of active risks (blockers + overdue + compliance gaps)                                            | number  | **down** (`positiveIsDown`) | rules over all modules              |

Company-health composite (default weights, tunable in `company_settings`):

```
health = 0.25*attendance + 0.20*reportCompliance + 0.20*deliveryOnTime
       + 0.15*dependencyFlow + 0.10*utilizationBand + 0.10*sentiment
```

Each factor normalized 0–100; `dependencyFlow = resolved / max(opened, 1)` capped
at 100; `sentiment` from check-in mood distribution.

---

## 5. Widgets

Reuse existing components where noted; new widgets follow the same
`ChartCard` / `Card` + `states` pattern.

| Widget                                        | Reuses                               | Modules                 | Content                                                                                                                            |
| --------------------------------------------- | ------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **KPI Grid**                                  | `TrendCard`                          | all                     | 6 benchmarked KPIs (§4)                                                                                                            |
| **AI Executive Summary**                      | `Card` + `InsightGrid`               | AI, Analytics           | Narrative paragraph from `executive-summary`; 4 generated `Insight` cards (positive/negative/warning/neutral); "Regenerate" action |
| **Department Health**                         | `Card` + `Progress`                  | HR, Attendance, Reports | Per-dept composite score + headcount bar list                                                                                      |
| **Operational Risks**                         | `Card` + `Badge`                     | all (rules)             | Severity-ranked (high/medium/low) risk list with owner + deep-link                                                                 |
| **Dependency Flow Trend**                     | `ChartCard` + `BarChart`             | Dependencies            | Opened vs resolved per week (grouped bars)                                                                                         |
| **Report & Attendance Trend**                 | `ChartCard` + `LineChart`            | Reports, Attendance     | Two % line charts stacked                                                                                                          |
| **Delivery Throughput Trend**                 | `ChartCard` + `LineChart`/`BarChart` | Tasks, Sprint           | Tasks completed per week / points burned                                                                                           |
| **Utilization Trend**                         | `ChartCard` + `LineChart`            | Time Tracking           | Logged vs expected hours per week                                                                                                  |
| **Sprint Status Board**                       | `Card` + `Table`/`Badge`             | Sprint                  | Active sprints, % complete, on-track/at-risk, days left                                                                            |
| **Project Health Table**                      | `Card` + `Table` + `Badge`           | Projects, Tasks, Deps   | Project · status · health · progress · open blockers · manager                                                                     |
| **HR Pulse Strip**                            | `stat-card`                          | HR                      | Headcount · new hires (30d) · offboarding · birthdays this week                                                                    |
| **Signal / Escalations** (optional, in Risks) | `Badge`                              | Notifications           | Count of unresolved critical notifications feeding risk list                                                                       |

**Reuse-first note:** Department Health, Operational Risks, Dependency Trend,
Report/Attendance Trend, and Project Health table already exist in
`executive-dashboard.tsx`. This plan **adds** the AI Summary band, Delivery &
Utilization trends, Sprint board, and HR pulse strip, and rebinds all of them to
live queries.

---

## 6. Charts

Only the existing chart library (`src/features/analytics/charts/`) is used — no new
chart primitives (UI Rules: never duplicate components).

| Chart                               | Primitive                      | Series                                             | Format        |
| ----------------------------------- | ------------------------------ | -------------------------------------------------- | ------------- |
| Dependency flow                     | `BarChart`                     | opened (`fill-warning`), resolved (`fill-success`) | count         |
| Report compliance                   | `LineChart` (`stroke-primary`) | weekly %                                           | percent       |
| Attendance compliance               | `LineChart` (`stroke-success`) | weekly %                                           | percent       |
| Delivery throughput                 | `LineChart`/`BarChart`         | completed tasks / points                           | count         |
| Utilization                         | `LineChart`                    | logged vs expected hours                           | hours/percent |
| Department distribution (optional)  | `DonutChart`                   | headcount by dept                                  | count         |
| Attendance heatmap (optional drill) | `Heatmap`                      | day × week presence                                | percent       |
| Activity/AI events (optional)       | `Timeline`                     | recent exec-relevant events                        | —             |

All series use the `TrendPoint[]` (`{ label, value }`) shape already defined in
`analytics/types.ts`; grouped charts pass `series` as in the current component.

---

## 7. Filters

Reuse `AnalyticsFilters` + `AnalyticsFiltersProvider` + `FiltersBar` verbatim.
The executive scope wraps its content in the provider (as the analytics section
already does) and every query keys off the filter object.

| Filter     | Field         | Values                                  | Applies to                    |
| ---------- | ------------- | --------------------------------------- | ----------------------------- |
| Date range | `range`       | `7d` / `30d` / `qtd` / `ytd` / `custom` | all trends + KPIs             |
| Benchmark  | `benchmark`   | `wow` / `mom` / `qoq`                   | KPI deltas                    |
| Department | `department?` | dept id                                 | department/project/HR scoping |
| Team       | `team?`       | team id                                 | attendance/reports scoping    |
| Project    | `project?`    | project id                              | delivery/sprint/task scoping  |
| Role       | `role?`       | app_role                                | HR pulse (optional)           |

- Executive scope **excludes** `employee` filter (no per-person drill — policy §0).
- Export via existing `ExportMenu` (CSV/PNG of the current filtered view); exports
  are `audit_action = 'export'` audited (`DATABASE_DESIGN.md §18`).
- Saved views persist through `saved_reports (created_by, scope='executive',
filters jsonb)`.

---

## 8. Permissions

Two-tier, DB-authoritative (`docs/ARCHITECTURE.md §12`).

- **Frontend gate (UI only):** the route requires `owner:access`. Gate in the
  route `beforeLoad`/`loader` using `useAuth().hasPermission("owner:access")`;
  redirect non-owners to `/unauthorized`. Today only `owner` carries
  `owner:access` in `features/auth/permissions.ts`; when an `executive` role is
  introduced, add it to the matrix + `role_permissions` seed rather than
  hardcoding.
- **Backend (authoritative):** every aggregate query runs under RLS. Company-wide
  reads require `has_any_role(owner, super_admin)` (or the future `executive`).
  Cross-tenant aggregation that must bypass per-row RLS (company rollups) runs
  through **`SECURITY DEFINER` analytics RPCs / views** — never a client
  service-role key.
- **Data minimization:** the executive view returns **aggregates only**. No raw
  individual attendance rows, report bodies, or names in ranking widgets. Drill-down
  links route to the owning module, which re-checks RLS at that grain.
- **Audit:** exports and (if added) manual refreshes of materialized analytics log
  to `audit_events`.

| Role                        | Executive dashboard          |
| --------------------------- | ---------------------------- |
| owner                       | Full                         |
| super_admin                 | Full (ops)                   |
| executive (future)          | Full                         |
| project_manager / team_lead | ❌ (use `/app/manager`)      |
| hr                          | ❌ (use `/app/analytics/hr`) |
| employee / viewer           | ❌                           |

---

## 9. Refresh strategy

TanStack Query is the cache layer (`router.tsx` QueryClient). Introduce
`analytics/queries.ts` with a key hierarchy and per-query `staleTime` (the
`attendance/queries.ts` template).

```
analyticsKeys = {
  all: ['analytics'],
  executive: (filters) => [...all, 'executive', filters],
  kpis / departmentHealth / trends / projectHealth / sprints / aiSummary: (filters) => [...]
}
```

| Data class                           | staleTime | refetch                   | Rationale                  |
| ------------------------------------ | --------- | ------------------------- | -------------------------- |
| KPI benchmarks                       | 5 min     | on focus + interval 5 min | Board-level, slow-moving   |
| Trend series                         | 10 min    | on focus                  | Weekly buckets from views  |
| Department / project / sprint tables | 5 min     | on focus                  | Rollups                    |
| Operational risks                    | 2 min     | interval 2 min            | Time-sensitive             |
| AI Executive Summary                 | manual    | **on demand** (button)    | Expensive; never auto-poll |
| HR pulse                             | 30 min    | on focus                  | Rarely changes intraday    |

- **Realtime (selective):** subscribe only to high-signal, low-volume streams —
  `notifications` (critical count) and `dependencies` (state changes) — via the
  `src/features/realtime` layer, and invalidate the affected query key rather than
  re-rendering per event. Do **not** subscribe `tasks`/`work_sessions` at the exec
  grain (too chatty — rely on staleTime + interval).
- **Manual refresh:** a header "Refresh" control invalidates `analyticsKeys.executive`.
- **AI band:** cache the last completion in the `ai` store keyed by `(scope, period)`;
  show generated-at timestamp; regenerate is explicit.

---

## 10. Performance considerations

Follows CLAUDE.md Performance + `DATABASE_DESIGN.md §20` (derived numbers are views).

- **Aggregate in the database, not the client.** All rollups come from
  views/materialized views (`project_stats`, `sprint_burndown`, `time_log_totals`,
  `analytics_*`). The client never fetches raw `tasks`/`work_sessions`/`time_logs`
  rows to aggregate in JS.
- **Materialized + scheduled refresh** for heavy trend/benchmark views (daily
  buckets refreshed on a cron / Edge Function); cheap views stay live. Serve
  KPIs from small pre-aggregated rowsets.
- **Route-level data loading + code-splitting.** Lazy-load the executive route
  (heavy `recharts` charts) and prefetch with
  `queryClient.ensureQueryData(queryOptions)` in the route loader
  (`ARCHITECTURE.md §15.6`).
- **Parallel, independent queries.** Each widget owns its query so one slow module
  (e.g. AI) never blocks the KPI grid; render through the shared `states`
  (skeleton/empty/error) module per widget.
- **Memoize** composite computations (health blend, severity sort) and chart data
  transforms; `TrendCard`/`ChartCard` are pure over their props.
- **Virtualize** the project health table if project count is large; cap
  operational risks to top-N with "view all" deep-link.
- **Bounded payloads.** Trends return ≤ ~26 weekly points; tables paginate;
  AI summary is a single bounded completion, not streamed row-by-row.
- **Isolate failures.** AI/analytics view errors degrade gracefully (widget-level
  error card via `states`), reported to `reportLovableError`; the rest of the
  dashboard still renders.

---

## 11. Data-access contract (implementation shape)

No code here — the target module layout, consistent with the `attendance` reference
and `ARCHITECTURE.md §15.1`:

```
src/features/analytics/
  api.ts        # Supabase reads: getExecutiveKpis(filters), getDepartmentHealth(filters),
                #   getDependencyFlow, getComplianceTrends, getDeliveryTrends,
                #   getUtilizationTrends, getSprintStatus, getProjectHealth, getHrPulse
  queries.ts    # queryOptions factories + analyticsKeys + per-query staleTime
  aggregations.ts (optional) # pure composite/severity helpers (unit-tested)
  components/executive-dashboard.tsx  # EXTEND existing — bind widgets to queries
```

- AI summary flows through `AIAssistantService` (`executive-summary` /
  `company-health`), **not** a direct provider call (`docs/AI_FEATURES.md`).
- Mutations are out of scope (read-only dashboard); saved views/exports are the
  only writes and go through guarded RPCs + audit.

---

## 12. Build order

1. **Extend types** — add `ExecutiveKpis`, `DepartmentHealth`, `ProjectHealthRow`,
   `SprintStatusRow`, `HrPulse` to `analytics/types.ts` (reuse `BenchmarkValue`,
   `TrendPoint`, `Insight`).
2. **Widgets on mock** — add AI Summary band, Delivery & Utilization trends, Sprint
   board, HR pulse to `executive-dashboard.tsx`, sourced from `mock-data.ts`.
   (Ships value immediately, no backend.)
3. **Land analytics views** — `analytics_*` materialized views + `saved_reports`
   (`DATABASE_DESIGN.md §20`, migration wave P3) with RLS + definer RPCs.
4. **`api.ts` + `queries.ts`** — swap each widget from mock store to `useQuery`,
   keeping the component layer stable (selector → query hook).
5. **Route gate + loader** — enforce `owner:access`, prefetch via
   `ensureQueryData`, lazy-load the route.
6. **Realtime + refresh** — wire selective `notifications`/`dependencies`
   invalidation and the manual refresh control.
7. **Audit + export** — ExportMenu → audited CSV/PNG; saved exec views.

---

_This document describes the target design. Update it as the analytics views land
and the mock store is retired in favor of `analytics/api.ts` + `analytics/queries.ts`._
