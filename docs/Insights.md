# Insights

Auto-generated UI insight cards shown on the **Project Analytics** dashboard. Pure derivations from snapshot data — no ML, no async, no persistence. All copy is deterministic given the same inputs.

Implemented in `src/features/project-analytics/insights.ts` (`generateInsights(projectId)`).

## Rule set

| Trigger                        | Intent     | Sample copy                              |
| ------------------------------ | ---------- | ---------------------------------------- |
| Completion ≥ 70%               | positive   | "Team velocity is strong — 78% complete" |
| Completion < 30% and > 5 tasks | warning    | "Velocity is low — only 21% delivered"   |
| Otherwise                      | neutral    | "Progress steady at 54%"                 |
| `blocked > 0`                  | warn/neg   | "3 tasks are blocking progress"          |
| `overdue > 0`                  | negative   | "5 overdue tasks"                        |
| Top assignee exists            | neutral    | "Most workload assigned to Ahmed"        |
| Active sprint                  | pos/wn/neu | "Sprint 2 is 80% complete"               |
| Time logs > 0                  | neutral    | "126.4h logged across the project"       |

## Intent → visual

- `positive` → emerald border + tint
- `warning` → amber
- `negative` → red
- `neutral` → muted

## Extending

Add a new rule by pushing an `Insight` into `generateInsights`. Keep rules cheap (single pass over already-derived snapshots) and deterministic.
