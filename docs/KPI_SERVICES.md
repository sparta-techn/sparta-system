# SpartaFlow — Executive KPI Services

> Reference for the reusable Executive KPI layer in `src/services/kpi/`.
> Implements the KPIs specified for the Executive Dashboard
> (`docs/EXECUTIVE_DASHBOARD_PLAN.md`) as **pure calculators** plus a
> **service boundary**. No UI is wired to them yet.
> Snapshot date: 2026-07-02.

---

## 1. What this is

A single, reusable place to **calculate** the fifteen executive KPIs across four
groups — Company, Projects, Engineering, Reports. It follows the existing service
conventions (`docs/SERVICES.md`, `src/services/*`): a class singleton is the
boundary, aggregate reads are RPC/view-backed, and components never call it
directly (they consume it inside hooks / TanStack Query functions).

The layer is split so calculation is decoupled from data source:

| File                       | Role                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `kpi-types.ts`             | Minimal input **snapshots**, the `Kpi` output envelope, and per-group DTOs |
| `kpi-calculators.ts`       | **Pure, deterministic** functions — the actual math. No I/O                |
| `executive-kpi.service.ts` | `ExecutiveKpiService` — `compute*` (offline) + `get*` (RPC)                |
| `index.ts`                 | Barrel; re-exports the singleton, calculators, and types                   |
| `kpi-calculators.test.ts`  | 21 unit tests over the calculators (vitest)                                |

Exported from the app service barrel: `import { executiveKpiService } from "@/services"`.

### Why snapshots instead of the domain types

Calculators take **small structural snapshots** (e.g. `ProjectSnapshot`,
`TaskSnapshot`) rather than the heavy feature types (`Project`, `Task`,
`WorkSessionRow`). This keeps them:

- **Pure & dependency-light** — no import of stores, Supabase, or React.
- **Reusable** — the same function runs against a live Supabase row or a mock
  store row; only a thin adapter changes.
- **Testable** — every formula is exercised directly with plain objects.

An adapter that maps live rows / mock stores → snapshots is intentionally _out of
scope_ for this slice (it lands when the dashboard is wired). Until then, feed the
`compute*` methods from a hook that already holds the domain data.

---

## 2. The `Kpi` envelope

Every metric returns a uniform shape so the dashboard can render it generically:

```ts
interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "number" | "percent" | "hours" | "points" | "minutes";
  goodDirection: "up" | "down"; // is a rising value good?
  previous?: number; // set when benchmarked
  delta?: number; // value - previous
  deltaPct?: number; // % change vs previous
  trend?: "up" | "down" | "flat";
}
```

Pass a `previous` map to any `compute*` input to populate the benchmark fields
(`delta` / `deltaPct` / `trend`) — this maps directly onto the `TrendCard`
(current value, % change, previous hint) used by the existing dashboard.

---

## 3. The KPIs

### 3.1 Company — `computeCompany(input)` → `CompanyKpis`

Sources: **HR** (`profiles`/`employment` status), **Attendance** (`work_sessions`).

| KPI                | Function                | Definition                                                                                                                               | Format / good |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Active Employees   | `countActiveEmployees`  | Employees with lifecycle status `active`                                                                                                 | number · up   |
| Employees Online   | `countEmployeesOnline`  | Live sessions (`working` or `on_break`)                                                                                                  | number · up   |
| Employees on Leave | `countEmployeesOnLeave` | Lifecycle status `on_leave`                                                                                                              | number · down |
| Attendance Rate    | `attendanceRate`        | Present ÷ _expected_ employee-days. Present = `on_time`/`in_progress`/`late`; `half_day` = 0.5; non-scheduled days excluded              | percent · up  |
| Productivity Score | `productivityScore`     | 0–100 weighted blend of attendance, report completion, task throughput, utilization (default weights `0.3/0.2/0.3/0.2`, auto-normalized) | number · up   |

### 3.2 Projects — `computeProjects(input)` → `ProjectKpis`

Sources: **Projects** (`projects` / `project_stats`).

| KPI                   | Function                | Definition                                                     | Format / good |
| --------------------- | ----------------------- | -------------------------------------------------------------- | ------------- |
| Active Projects       | `countActiveProjects`   | Status `active`                                                | number · up   |
| Delayed Projects      | `countDelayedProjects`  | Open project flagged `delayed`/`blocked` **or** past `endDate` | number · down |
| Completion Rate       | `projectCompletionRate` | Completed ÷ deliverable (excludes archived + cancelled)        | percent · up  |
| Delivery Success Rate | `deliverySuccessRate`   | Of completed projects, share finished on/before `endDate`      | percent · up  |

`countDelayedProjects` accepts an injected `now` (default `new Date()`) for
deterministic tests.

### 3.3 Engineering — `computeEngineering(input)` → `EngineeringKpis`

Sources: **Sprint** (`sprints`), **Tasks** (`tasks`), **Time Tracking** (`time_logs`),
**Dependencies** (blocked count).

| KPI                   | Function               | Definition                                                                                                   | Format / good |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------- |
| Sprint Velocity       | `sprintVelocity`       | Avg completed story points over the last N completed sprints (default 3)                                     | points · up   |
| Blocked Tasks         | `countBlockedTasks`    | Tasks in `blocked` status + blocked dependencies                                                             | number · down |
| Team Capacity         | `teamCapacity`         | Utilization = logged hours ÷ (headcount × expected hours). May exceed 100 (overtime)                         | percent · up  |
| Workload Distribution | `workloadDistribution` | Open-task load per assignee + **balance index** (0–100, from coefficient of variation; 100 = perfectly even) | number · up   |

`EngineeringKpis` also returns the supporting breakdowns `capacity`
(`TeamCapacity`) and `workload` (`WorkloadDistribution` with per-assignee
`buckets`) for the capacity / workload widgets. The headline `workloadBalance`
KPI is the balance index.

### 3.4 Reports — `computeReports(input)` → `ReportKpis`

Sources: **Daily Reports** (`daily_checkins` / `midday_reports` / `eod_reports`).

| KPI                     | Function                | Definition                                                              | Format / good  |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------- | -------------- |
| Daily Report Completion | `dailyReportCompletion` | Submitted ÷ expected slots (3/day: check-in, midday, EoD)               | percent · up   |
| Missing Reports         | `countMissingReports`   | Count of expected-but-unfiled slots                                     | number · down  |
| Average Response Time   | `averageResponseTime`   | Mean minutes between prompt and submission; negative/bad deltas ignored | minutes · down |

`ReportKpis.byType` exposes per-type completion (`checkin`/`midday`/`eod`) for
drill-down.

---

## 4. Usage

### Now — offline, snapshot-based (works against mock stores)

```ts
import { executiveKpiService } from "@/services";

// Assemble snapshots from whatever data the caller already holds
const company = executiveKpiService.computeCompany({
  employees, // EmployeeStatusSnapshot[]
  presence, // PresenceSnapshot[]
  attendance, // AttendanceDaySnapshot[]
  productivity: { attendanceRate, reportCompletion, taskThroughput, utilization },
  previous: { activeEmployees: 42 }, // optional → benchmark deltas
});

company.attendanceRate.value; // e.g. 91.5
company.attendanceRate.trend; // "up" | "down" | "flat"
```

Compute a whole dashboard payload in one call:

```ts
const kpis = executiveKpiService.computeAll({ company, projects, engineering, reports });
```

Calculators are also exported directly for one-off reuse in hooks/tests:

```ts
import { sprintVelocity, attendanceRate } from "@/services/kpi";
```

### Target — server-backed (production path)

```ts
const kpis = await executiveKpiService.getAll(filters); // AnalyticsFilters
```

`get*` methods call Supabase RPCs (`kpi_company`, `kpi_projects`,
`kpi_engineering`, `kpi_reports`) so aggregation runs in the database — mirroring
the existing `AnalyticsService` (`analytics_metric` / `analytics_trend`). These
RPCs land with the analytics-views migration (`docs/DATABASE_DESIGN.md §20`).
Errors normalize to `ServiceError` via `toServiceError`.

---

## 5. Design notes

- **Reuse-first (CLAUDE.md):** built on the existing service `core` (`db` client,
  `toServiceError`) and the analytics `AnalyticsFilters` / benchmark model. No new
  state library, no duplicated primitives.
- **Strict TypeScript, no `any`.** All inputs/outputs typed; loose casts stay
  inside `services/core/client`.
- **Deterministic.** The only clock read is an injectable `now`; everything else
  is a pure function of its inputs — hence the 21-test suite runs with fixed data.
- **No UI changes.** This slice ships the calculation layer only; wiring into the
  Executive Dashboard widgets (§5 of `EXECUTIVE_DASHBOARD_PLAN.md`) is the next
  step, behind a snapshot adapter and/or the `get*` RPCs.

---

## 6. Verification

```
npx vitest run src/services/kpi   # 21 passed
npx tsc --noEmit                  # clean
```

---

_Next: add `kpi-adapters.ts` (live rows / mock stores → snapshots), then bind the
KPI groups to the dashboard widgets via TanStack Query using `analyticsKeys`._
