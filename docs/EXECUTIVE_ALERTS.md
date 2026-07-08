# SpartaFlow — Executive Alert Engine

> Reference for the Executive Alert Engine: a pure rules engine
> (`src/services/alerts/`) that raises alerts from operational snapshots, plus a
> reactive lifecycle store and dashboard UI (`src/features/executive/`).
> Snapshot date: 2026-07-02.

---

## 1. What it does

Turns operational state into ranked, actionable alerts and manages their
lifecycle. Seven conditions are covered:

| #   | Condition                | Alert type                 | Category    | Source signal                           |
| --- | ------------------------ | -------------------------- | ----------- | --------------------------------------- |
| 1   | Project overdue          | `project_overdue`          | project     | open project past `endDate`             |
| 2   | Sprint delayed           | `sprint_delayed`           | engineering | active sprint past end with work left   |
| 3   | Employee missing reports | `employee_missing_reports` | reports     | expected reports unfiled                |
| 4   | Attendance anomalies     | `attendance_anomaly`       | attendance  | repeated lateness / absence             |
| 5   | High workload            | `high_workload`            | engineering | open tasks per person over threshold    |
| 6   | Critical blocker         | `critical_blocker`         | engineering | critical / aged high-priority blocker   |
| 7   | AI detects risk          | `ai_risk`                  | ai          | risk from the AI risk-detection feature |

Every alert supports **priority**, **severity**, **dismiss**, **archive**, and
**history**.

---

## 2. Architecture

```
operational snapshots (AlertEngineInput)
        │
        ▼
executiveAlertEngine.evaluate(input)     ← pure, deterministic, ranked   (src/services/alerts)
        │  Alert[]
        ▼
alert-store.sync(alerts)                 ← reactive lifecycle + history   (src/features/executive/alerts)
        │  active / dismissed / archived / history
        ▼
useExecutiveAlerts → AlertsSection       ← UI: tabs + dismiss/archive/restore
```

- **Engine = what's wrong.** Stateless rules over typed input; same `now` → same
  output. No I/O, no store, no clock reads (a `now` is injected).
- **Store = what the user did about it.** Lifecycle state + append-only history,
  `localStorage`-backed via the standard `useSyncExternalStore` store pattern.

### Files

```
src/services/alerts/
  alert-types.ts        # Alert, severity/priority/state, rule inputs, thresholds, rank maps
  alert-rules.ts        # 7 pure rule functions (one per condition)
  alert-engine.ts       # ExecutiveAlertEngine.evaluate() + compareAlerts()
  index.ts
  alert-rules.test.ts   # 9 unit tests
src/features/executive/
  alerts/alert-store.ts # reactive lifecycle store (sync / dismiss / archive / restore / history)
  alerts/mock-data.ts   # seed AlertEngineInput (swap for a live adapter)
  hooks/use-executive-alerts.ts   # runs engine → store, exposes lifecycle
  components/alerts-section.tsx    # Active / Archived / History tabs
```

Exported: `executiveAlertEngine` from `@/services` and `@/services/alerts`;
`AlertsSection` / `useExecutiveAlerts` from `@/features/executive`.

---

## 3. Priority & severity

- **Severity** — impact of the condition: `critical | high | medium | low`. Set by
  each rule from its evidence (e.g. a project >14 days overdue or `blocked` health
  → `critical`; a report streak ≥3 days → `high`).
- **Priority** — triage urgency: `urgent | high | normal | low`. Defaults from
  severity via `priorityForSeverity`, but rules may escalate or cap. Example: an
  **AI-detected `critical`** risk is capped to `high` priority because AI risks are
  advisory, not confirmed.
- **Ranking** — `compareAlerts` orders by priority, then severity, then recency.
  `evaluate()` returns the list already sorted.

`SEVERITY_RANK` / `PRIORITY_RANK` are exported for any UI that needs the numeric
order.

---

## 4. Rules & thresholds

Thresholds are tunable per evaluation (`input.thresholds`), each with a default:

| Threshold             | Default | Used by                                         |
| --------------------- | ------- | ----------------------------------------------- |
| `missingReportsMin`   | 2       | missing reports                                 |
| `attendanceLateMin`   | 3       | attendance anomaly                              |
| `attendanceAbsentMin` | 2       | attendance anomaly                              |
| `highWorkloadTasks`   | 12      | high workload (escalates at 1.5×)               |
| `blockerAgeDays`      | 2       | critical blocker (escalates aged high-priority) |

Each alert carries a stable **dedupe id** `` `${type}:${entityId}` `` so re-running
the engine updates an existing alert rather than duplicating it — which is what
lets lifecycle state survive re-evaluation.

---

## 5. Lifecycle: dismiss / archive / history

The store (`alert-store.ts`) owns state; the engine never mutates it.

- **`sync(alerts)`** — reconcile a fresh evaluation. New ids are added as
  `active` and logged `raised`; existing ids refresh content but **keep their
  lifecycle state** (a dismissed alert stays dismissed; a resolved condition
  simply stops being re-raised).
- **`dismiss(id)`** — remove from the active set (kept for history).
- **`archive(id)`** — retain as a record, out of the working set; `clearArchived()`
  purges archived rows (history preserved).
- **`restore(id)`** — return a dismissed/archived alert to `active`.
- **History** — every transition (`raised | updated | dismissed | archived |
restored`) is appended to an immutable log (capped at 500), surfaced in the
  History tab. This is the client mirror of a future `executive_alert_events`
  audit table.

The `useExecutiveAlerts(input)` hook evaluates the engine on mount, syncs the
store, and exposes `active / dismissed / archived / history` plus the actions.

---

## 6. UI

`AlertsSection` (wired into the Executive Dashboard right after Overview) renders
three tabs built from reused primitives (`Tabs`, `Card`, `Badge`, `Button`,
`states`):

- **Active** — ranked alerts with severity + priority badges, category, evidence,
  and per-alert **archive** / **dismiss** actions. A **Re-evaluate** button reruns
  the engine.
- **Archived** — archived alerts with **restore**, plus **Clear archived**.
- **History** — the transition log with timestamps.

Accessibility: severity uses a labelled `Badge` (never colour alone); icon buttons
carry `aria-label`; empty states go through `@/components/states`.

---

## 7. Going live

Replace `alerts/mock-data.ts` with an adapter mapping Supabase rows / feature
stores → `AlertEngineInput`. The engine, store, hook, and UI are untouched. The
AI-risk input is fed from the AI risk-detection feature (`docs/EXECUTIVE_AI.md`).
Suggested backing tables: `executive_alerts` (lifecycle) + `executive_alert_events`
(history), evaluated server-side on a schedule or via triggers, with the same rule
logic reusable in an Edge Function.

---

## 8. Verification

```
npx tsc --noEmit                       # clean
npx eslint src/services/alerts src/features/executive   # clean
npx vitest run src/services/alerts     # 9 passed
npx vitest run                         # 123 passed (full suite)
```

`alert-rules.test.ts` covers each rule's raise/skip boundaries, severity
escalation, engine aggregation + ranking, and dedupe-id stability.

---

_Next: gate the dashboard route on `owner:access`, feed live snapshots via the
adapter, and (optionally) push `critical`/`urgent` alerts into the notifications
pipeline so they reach owners outside the dashboard._
