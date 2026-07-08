# SpartaFlow — Project Dashboard

> The at-a-glance widget grid on a project's detail page (the **Dashboard** tab,
> `features/projects/components/project-dashboard.tsx`). It composes **real data**
> from the projects store and **reuses the existing Analytics module** — no
> analytics is recomputed or duplicated. Snapshot: 2026-07.

---

## 1. Where it lives

- Component: `ProjectDashboard({ projectId })` —
  `src/features/projects/components/project-dashboard.tsx`.
- Surfaced as the first tab in `project-detail.tsx` (`defaultValue="dashboard"`),
  alongside the existing Overview / Analytics / Time / Activity tabs. Nothing was
  removed; the deep **Analytics** tab (`ProjectAnalyticsDashboard`) is unchanged.

## 2. Reuse, not duplication

The dashboard is a **composition layer**. Every analytical figure comes from the
already-built modules:

| Source module                           | Reused for                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@/features/project-analytics/utils`    | `snapshotTasks` (blocked/overdue/completed), `sprintProgressList`, `projectTimeLogs` + `totalHours`, `unifiedActivity`, `filterProjectTasks`, `employeeName` |
| `@/features/project-analytics/insights` | `calcProjectHealth` (score + level + factors)                                                                                                                |
| `@/features/projects/store`             | `project.progress` (milestone-derived), `members`, `milestonesFor`, `risksFor`                                                                               |
| `@/services/projects/rules`             | `highestOpenRiskSeverity` (Risk Level)                                                                                                                       |

No new chart math, health formula, or task aggregation is written — the widgets
call the same functions the Analytics tab uses, so the two stay consistent by
construction.

## 3. Widgets → data source

| Widget                 | Source                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **Project Progress**   | `project.progress` (R7: completed milestones, from the store) + `snapshotTasks` mini-stats |
| **Team Members**       | `project.members` resolved via `personById` (Supabase `profiles`)                          |
| **Sprint Progress**    | `sprintProgressList(projectId)` (Analytics)                                                |
| **Milestones**         | `milestonesFor(projectId)` (store → `milestones` table)                                    |
| **Upcoming Deadlines** | open milestones sorted by `dueDate`, with days-remaining / overdue                         |
| **Blocked Tasks**      | `snapshotTasks().blocked` + the `status === "blocked"` task list (Analytics)               |
| **Recent Activity**    | `unifiedActivity(projectId, 6)` (Analytics — tasks/comments/files/sprints)                 |
| **Time Logged**        | `totalHours(projectTimeLogs(projectId))` + tracked-task count (Analytics)                  |
| **Risk Level**         | `highestOpenRiskSeverity(risksFor(projectId))` over the live `project_risks` register      |
| **Project Health**     | `calcProjectHealth(projectId)` score + level + weighted factors (Analytics)                |

## 4. Real data wiring

- The **risk register** was added to the projects store: hydration now loads
  `projectRiskRepository.listForProject` per project, mapped by `riskRowToDomain`
  into a `Risk` domain type, exposed via `risksFor(projectId)`.
- **Risk Level** logic lives in the tested rules layer
  (`highestOpenRiskSeverity` / `isOpenRisk` / `OPEN_RISK_STATUSES` in
  `services/projects/rules.ts`) — the highest severity among open
  (`open`/`mitigating`/`accepted`) risks, `null` when none.
- The component subscribes to `useProjectsState`, `useTasksState`,
  `useSprintsState`, `useTimeState` so widgets refresh live.

### Data origin today

- Projects / members / milestones / activity / risks → **Supabase**
  (project-execution tables, via the projects store).
- Tasks / sprints / time logs → the **existing Analytics module's** stores
  (still mock-backed until those modules are connected). The dashboard reads them
  through the Analytics utils, so it upgrades automatically when they move to
  Supabase. Task-derived widgets (Sprint/Blocked/Time/Health) read 0/empty for a
  project that has no tasks yet.

## 5. Tests

Risk-level rules are unit-tested in `src/services/projects/rules.test.ts`
(`highestOpenRiskSeverity`, `isOpenRisk`): highest-open-severity selection,
ignoring resolved/closed, and the empty case. Full suite: **48 passing**.
`tsc --noEmit` clean · `eslint` clean.

## 6. Files

```
src/features/projects/types.ts            # + Risk / RiskStatus
src/features/projects/mappers.ts          # + riskRowToDomain
src/features/projects/store.ts            # hydrate risks + risksFor()
src/services/projects/rules.ts            # + highestOpenRiskSeverity / isOpenRisk / OPEN_RISK_STATUSES
src/services/projects/rules.test.ts       # + risk-level tests
src/features/projects/components/project-dashboard.tsx   # NEW — the widget grid
src/features/projects/components/project-detail.tsx      # + Dashboard tab (default)
```
