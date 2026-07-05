# Project Health Score

Single 0–100 score shown on Project Analytics. UI only — never persisted, never compared across organizations.

Implemented in `src/features/project-analytics/insights.ts` (`calcProjectHealth(projectId)`).

## Formula

`score = Σ (factor.value × factor.weight)`, rounded.

| Factor                  | Value (0–100)                                     | Weight |
| ----------------------- | ------------------------------------------------- | ------ |
| Task completion         | `completionPct`                                   | 0.35   |
| Blockers & overdue      | `100 − blocked·18 − overdue·10` (clamped ≥ 0)     | 0.30   |
| Sprint progress         | active sprint pct, fallback 60/70                 | 0.20   |
| Time tracking coverage  | `min(100, 40 + logs·2)` else 25                   | 0.15   |

## Bands

| Score   | Level     | Color    |
| ------- | --------- | -------- |
| 75–100  | Good      | Emerald  |
| 50–74   | At Risk   | Amber    |
| 0–49    | Critical  | Red      |

## Display

- Circular SVG gauge with the numeric score and band label.
- Per-factor mini progress bars below the gauge — transparent about *why* the score is what it is.

## Non-goals

- No backend, no history, no per-user breakdown.
- Score is a hint, not a KPI. Numbers are deterministic from current state, not a snapshot over time.
