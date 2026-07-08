# Executive Dashboard

Top-of-the-funnel view at `/app/analytics/executive`, designed for owners and exec stakeholders. The dashboard is optimized for a **60-second read**: scan KPIs → scan insights → drill into risks or department / project tables.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ KPIs: Company health · Attendance · Reports · Open risks     │
├──────────────────────────────────────────────────────────────┤
│ Insights (4 cards: positive · negative · warning · neutral) │
├──────────────────────────────────────────────────────────────┤
│ Department health (2/3)         │ Operational risks (1/3)   │
├──────────────────────────────────────────────────────────────┤
│ Dependency trend                │ Report & attendance trend │
├──────────────────────────────────────────────────────────────┤
│ Project health table                                          │
└──────────────────────────────────────────────────────────────┘
```

## Surfaces

### KPIs (`TrendCard`)

- **Company health** — composite score 0-100 from attendance, reporting, dependency flow, sentiment.
- **Attendance compliance** — % of expected sessions present on time.
- **Report compliance** — average of check-in / midday / EoD completion.
- **Open operational risks** — count, lower is better (`positiveIsDown`).

Each card shows: current value, % change vs previous period, comparison label, and the previous value as a secondary hint.

### Department Health

Bar list of departments with a composite score + Progress bar. Headcount and score are displayed side by side so growth and quality can be read together.

### Operational Risks

Severity-ranked list (high / medium / low) with the responsible team. A real implementation would generate these from rules across blockers, late reports, missed targets.

### Dependency Trend

Grouped bar chart, **opened vs resolved per week**. Reading: when the green (resolved) overtakes orange (opened), the team is burning down the backlog.

### Report & Attendance Compliance

Two stacked line charts, both formatted as percent, so the eye can compare slope and convergence.

### Project Health Table

Per-project: status badge, score, open blockers. Sorted manually in mock data by criticality.

## Data Inputs (future)

- `attendance_summary_daily` (materialized view)
- `report_completion_daily`
- `dependency_flow_daily` (opened / resolved counts)
- `project_health` (aggregated from blockers + report compliance scoped to project members)
- `operational_risks` (rules engine output — placeholder today)

## Access Control

Visible only to roles `owner` and members of an `executive` group. The route currently lives under `_authenticated/`; before launch, gate it with `requireRole("owner")` in the route loader once the executive role is defined.

## Why no individual rankings

By policy, the executive dashboard does **not** rank individual employees. Bottom-up metrics (attendance, hours) are aggregated to team / department level. Top performers as a widget is provided as a placeholder elsewhere and intentionally avoids leaderboards.
