# Projects — SpartaFlow Hub

The **Project** is the highest-level organizational unit in SpartaFlow Hub. Every future task, milestone, epic, dependency, and report rolls up to a project. This document covers the Project layer only; Tasks, Kanban, and Sprints are deferred to the next phase but the architecture below is shaped to accept them without rework.

## Mental model

- A **Workspace** holds shared company-wide settings (timezone, working days, default statuses, default template).
- A **Client** is an external (or "internal") organization a project is delivered for.
- A **Project** has identity (name, key, color, icon), governance (manager, members, department), timeline (start, end), state (status, health, priority), resources (repo, designs, docs, environments), and rolled-up signals (progress, open/done/overdue tasks, dependencies).
- A **Template** seeds a project with default statuses, milestones, and roles so new projects start in seconds.

```
Workspace  ─→  Clients  ─→  Projects  ─→  (Milestones · Members · Files · Activity · Reports)
                                ↑
                          ProjectTemplate
```

## Lifecycle (status)

`planning → active → on_hold → completed → archived`  (or `cancelled` at any point)

Status is editable from project settings. Archiving hides the project from the active list but preserves all data; a future "Show archived" toggle on the list view surfaces them again.

## Health signal

`healthy · at_risk · blocked · delayed · completed`

Health is independent of status — an `active` project can be `at_risk`. It will be derived in the next phase from task overdue %, blocker count, and dependency aging; it is currently editable for demo purposes.

## Information architecture

```
/app/projects              Overview dashboard (KPIs · health mix · favorites · upcoming deadlines)
/app/projects/all          List view (grid + table, search, filters, sort, favorites, archive toggle)
/app/projects/$id          Project detail (tabbed)
/app/projects/templates    Project templates
/app/projects/clients      Client directory
/app/projects/clients/$id  Client detail (info + linked projects)
/app/projects/workspace    Workspace settings
```

The Projects detail page exposes nine tabs:

| Tab | Phase | Notes |
| --- | --- | --- |
| Overview | shipped | Progress, KPIs, milestones, recent activity, info, resources, files |
| Tasks | next | Disabled placeholder — built on the Task layer |
| Milestones | next | Disabled placeholder |
| Epics | next | Disabled placeholder |
| Files | shipped | Table of attachments with kind, owner, size |
| Members | shipped | Roles, workload, add/remove |
| Reports | shipped (stub) | Wired to UI; live aggregations land with the Task layer |
| Activity | shipped | Chronological event log |
| Settings | shipped | Rename, change manager, manage links, duplicate, archive |

## Create flow — under 60 seconds

The "New project" dialog is intentionally short:

1. **Identity** — icon, name, project key (auto-generated from the name; editable).
2. **Description** (one line).
3. **Template** — optional, pre-fills statuses/milestones/roles.
4. **Color**.
5. **People** — manager, client, department, priority.
6. **Timeline** — start date, end date (defaults: today and +60 days).
7. **Advanced (collapsed)** — repo / Figma / docs URLs, environments, initial status.

Only **name** and **key** are required. Sensible defaults cover everything else. The form opens with focus on the name input.

## Reusable architecture

The store is a thin facade over `localStorage` with the exact shape future Supabase repositories will expose:

```ts
listProjects() / getProject(id)
createProject(input) / updateProject(id, patch)
toggleFavorite(id) / archiveProject(id) / duplicateProject(id)
listClients() / getClient(id) / createClient(input)
listTemplates() / getTemplate(id) / createTemplate(input)
getWorkspace() / updateWorkspace(patch)
activityFor(projectId) / milestonesFor(projectId) / filesFor(projectId)
```

`useProjectsState(selector)` is a `useSyncExternalStore` hook that lets components subscribe to slices without a global context. Swapping the store for TanStack Query backed by Supabase will not touch any component.

## Project Dashboard

The `/app/projects` overview is built for a 20-second read:

- 4 KPI cards: active projects, average progress, at-risk count, overdue tasks.
- **Active project health** list — quick-link rows with progress and health badge.
- **Health mix** bar — proportional breakdown across all active projects.
- **Favorites** — the projects the current user has starred.
- **Upcoming deadlines** — soonest end dates first.

## Members & workload

Each member has a `projectRole` (`lead`, `contributor`, `reviewer`, `stakeholder`) independent of their company-level role. Workload is shown as a horizontal bar with traffic-light colors — currently mocked; in the next phase it will be computed from assigned open tasks vs. capacity.

## Accessibility

- All interactive controls are keyboard-reachable (`Tab`, `Shift+Tab`, `Enter`).
- Icon-only buttons have `aria-label`s; toggle buttons use `aria-pressed`.
- Tabs use shadcn `Tabs` with managed roving focus.
- Status / health / priority badges use both color and text — never color alone.

## Responsive

- Grid view of projects collapses 3 → 2 → 1 columns.
- Detail page header re-flows below sm breakpoint.
- Members table becomes horizontally scrollable on narrow screens.

## What ships next

The Task layer will plug into:

- `project.totalTasks/openTasks/completedTasks/overdueTasks` (currently mocked).
- `project.openDependencies` (currently mocked, dependencies module already exists).
- The disabled `Tasks`, `Milestones`, `Epics` tabs.
- Live reports in the `Reports` tab.
- Real workload bars in the Members tab.

No project component needs to change to enable any of the above — only the store getters swap from mock to real queries.
