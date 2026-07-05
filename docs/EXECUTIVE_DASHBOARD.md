# SpartaFlow — Executive Dashboard

> Reference for the implemented Executive Dashboard (owner cockpit) in
> `src/features/executive/`. Built on the reusable KPI services
> (`docs/KPI_SERVICES.md`) and the shared analytics charts — no metric math or
> chart primitives are duplicated.
> Snapshot date: 2026-07-02.

---

## 1. What shipped

A single-screen leadership view at **`/app/executive`** composed of **nine
sections** from reusable widgets. Every KPI is **computed** by
`executiveKpiService.computeAll(...)` from one snapshot — the dashboard file only
assembles sections; it does no arithmetic.

| Section | Sources | Key widgets |
| --- | --- | --- |
| **Overview** | all groups + AI summary | `StatCard` highlight strip · AI summary card |
| **Company KPIs** | HR, Attendance | `KpiCard` × 5 |
| **Projects** | Projects, Tasks | `KpiCard` × 4 · `LineChart` throughput · health `Table` |
| **Engineering** | Sprint, Tasks, Time Tracking, Dependencies | `KpiCard` × 4 · `BarChart` velocity · workload `Progress` bars |
| **HR** | HR | `StatCard` × 4 · `DonutChart` by department |
| **Attendance** | Attendance | `StatCard` × 4 · `LineChart` on-time trend |
| **AI Insights** | AI, Analytics | `InsightGrid` · Regenerate action |
| **Activity Timeline** | cross-module events | `Timeline` |
| **Upcoming Risks** | rules across all modules | severity-ranked `Badge` cards |

---

## 2. Files

```
src/features/executive/
  executive-dashboard.tsx     # composition — computes KPIs, renders 9 sections
  types.ts                    # section view-models (ExecRisk, HrPulse, …)
  mock-data.ts                # KPI snapshot + section extras (swap for a live adapter)
  utils.ts                    # Kpi → TrendCard/StatCard adapters
  index.ts                    # barrel
  components/
    dashboard-section.tsx     # reusable titled section wrapper
    kpi-card.tsx              # reusable KPI widget (wraps TrendCard) + KpiCardGrid
    overview-section.tsx
    company-section.tsx
    projects-section.tsx
    engineering-section.tsx
    hr-section.tsx
    attendance-section.tsx
    ai-insights-section.tsx
    activity-timeline-section.tsx
    upcoming-risks-section.tsx
src/routes/_authenticated/app/executive.tsx   # route: AppShell + PageHeader + dashboard
```

Sidebar entry added under **Team → Executive** (`app-sidebar.tsx`).

---

## 3. Reuse — nothing duplicated

Per CLAUDE.md ("reuse components / hooks / services", "never duplicate UI") and
the task's "reuse existing chart components / do not duplicate analytics":

- **KPI math** → `@/services/kpi` (`executiveKpiService`). The dashboard imports
  the service; it re-implements no metric. See `docs/KPI_SERVICES.md`.
- **Charts** → `@/features/analytics/charts` (`TrendCard`, `LineChart`,
  `BarChart`, `DonutChart`, `Timeline`) and `analytics/components/chart-card`
  (`ChartCard`), `analytics/components/insight-card` (`InsightGrid`). No new chart
  component was created.
- **Shared widgets** → `@/components/stat-card` (`StatCard`), `@/components/states`
  (`EmptyState`), and `ui/` primitives (`Card`, `Table`, `Badge`, `Progress`,
  `Button`).
- **Types** → `Insight`, `TrendPoint`, `BenchmarkValue` from
  `analytics/types`; `TimelineEvent` from `analytics/charts`; `Kpi`/group DTOs
  from `@/services/kpi`.

The only **new** reusable widgets are `KpiCard`/`KpiCardGrid` (a thin adapter over
`TrendCard`) and `DashboardSection` (a heading/spacing wrapper) — both generic and
exported from the feature barrel.

### Relationship to the analytics executive view

`/app/analytics/executive` remains the **analytics-scoped** deep-dive (filters +
benchmark charts inside the Analytics section). `/app/executive` is the **owner
cockpit** — a broader operating picture across HR, Projects, Engineering, People,
AI, and Risk. They share the same charts and KPI layer; neither re-implements the
other.

---

## 4. Data flow

```
mock-data.ts (executiveKpiInput snapshot)
        │
        ▼
executiveKpiService.computeAll(input)   ← pure calculators, memoized in the component
        │  → { company, projects, engineering, reports }  (typed Kpi groups)
        ▼
section components  ──►  KpiCard / charts / tables
        ▲
section extras (trends, insights, timeline, risks)  ← mock-data.ts, shared analytics types
```

`useMemo` computes the KPI groups once. Section-specific series (throughput,
velocity, attendance trend), insights, timeline events, and risks are seed data
in `mock-data.ts` typed with the shared analytics types, so they flow straight
into the reused charts.

### Going live

Replace `mock-data.ts` with an adapter that maps Supabase rows / feature stores
onto the KPI snapshot + section view-models. Widgets, sections, KPI math, and
charts are untouched. The service's `getAll(filters)` (RPC-backed) is the eventual
server path (`docs/KPI_SERVICES.md §4`).

---

## 5. KPI adapters (`utils.ts`)

- `kpiToBenchmark(kpi)` — `Kpi` → `BenchmarkValue` for `TrendCard` (`points`
  renders as a number; missing `previous` falls back to current = flat delta).
- `kpiHint(kpi)` — optional unit hint (e.g. "story points").
- `formatKpiValue(kpi)` / `kpiStatTrend(kpi)` — `Kpi` → `StatCard` value string +
  trend badge, with direction respecting each KPI's `goodDirection` (so "lower is
  better" metrics colour correctly).

---

## 6. Accessibility & responsiveness

- Each section is a landmark `<section aria-label>` via `DashboardSection`.
- KPI/stat grids collapse `sm:2-col → lg:3–5-col`; chart+table bands are
  `xl:grid-cols-2/3` and stack on smaller screens.
- Status/severity use a `Badge` label **and** colour token (never colour alone);
  charts pass `ariaLabel`.
- Empty states route through `@/components/states` (`EmptyState`).

---

## 7. Verification

```
npx tsc --noEmit                 # clean
npx eslint src/features/executive src/services/kpi   # clean (prettier-enforced)
npx vitest run src/services/kpi  # 21 passed (KPI calculators)
```

Route registered by the router plugin at `/_authenticated/app/executive`
(`routeTree.gen.ts`, auto-generated — not hand-edited).

---

*Next: gate the route on `owner:access`, wire the AI Insights "Regenerate" to the
`executive-summary` AI feature, and add the live snapshot adapter + TanStack Query
refresh (`docs/EXECUTIVE_DASHBOARD_PLAN.md §9`).*
