# Dependency Management

The Dependency module is SpartaFlow Hub's structured replacement for the
"I'm blocked, can someone help?" Slack thread. Instead of writing the same
blocker into a daily report three days in a row, employees create a tracked
**Dependency** — an inter-team ask with an owner, priority, due date, and
audit trail.

## Goals

- Eliminate communication gaps between departments.
- Make every cross-team ask visible and accountable.
- Provide a single source of truth that managers can use to spot bottlenecks.
- Capture an ask in under one minute while still producing useful data.

## Surfaces

| Surface              | Route                          | Purpose                                      |
| -------------------- | ------------------------------ | -------------------------------------------- |
| List / Board / Table | `/app/dependencies`            | Everyone's view, switchable view modes       |
| My Dependencies      | `/app/dependencies` (tab "My") | Personal four-quadrant view                  |
| Detail               | `/app/dependencies/$id`        | Full record, comments, timeline              |
| Manager view         | `/app/dependencies/manager`    | Aggregates, throughput, blocked projects     |
| Dashboard widget     | `/app`                         | Waiting-on-me + waiting-on-others mini lists |

## Views

- **Board** — Kanban with six columns (Pending, Accepted, In Progress, Blocked, Resolved, Closed). Cards are draggable; drop performs `dependencyStore.setState`. Drop targets show a subtle primary highlight on dragover.
- **Table** — sortable (title, priority, due, updated), paginated (10/page), with filters and saved views (All open / Critical & high / Blocked / Backend asks).
- **My Dependencies** — four quadrants: Waiting on others, Waiting on me, Overdue, Recently resolved.

## Filtering

`DepFilters` covers Search, Status, Priority, Type, Department, Owner, Project. Saved views are pinned chips that prefill the filter state. Filters apply to both Board and Table.

## Detail page

- Status & Priority editable inline (`Select` → store).
- Sidebar Details panel — requester, owner, dept, project, created/updated/due/resolved.
- Comments — threaded (root + replies), `@mention` parsing, `Cmd/Ctrl+Enter` submits, status-update flag rendered as a small info pill.
- Timeline — Created / Accepted / Status changed / Priority changed / Comment added / Assigned / Resolved / Closed / Rejected / Cancelled.

## UX target: < 1 minute creation

Creation dialog (`DepCreateDialog`) is intentionally a single scroll:

1. Title (auto-focus, required).
2. Description (optional, 3 rows).
3. Type / Priority / Due (3-up row).
4. Department / Owner (2-up row, Owner defaults to Unassigned).
5. Project / Related task (CU-####, plug-in for future ClickUp).
6. Tags (comma-separated free input).
7. "Save as draft" + "Create" footer.

Defaults are smart (today's department, common project) so an experienced user only needs to type the title, pick an owner, and submit.

## Future integration seams

- `dependencyStore` is the only file that mutates. Swap to Supabase RPCs without touching components.
- `relatedTaskRef` already accepts ClickUp IDs (`CU-####`) — UI shows them as monospace with a "coming soon" hint.
- Notifications are intentionally not wired. The Timeline events (`assigned`, `comment_added`, `status_changed`, `resolved`, plus the derived overdue state) are the trigger surface for a future notification dispatcher.
- Attachments accept the data model now (`attachments: {id,name,size}[]`) but the upload UI is a placeholder.

## Mock data

Realistic software-dev scenarios under `mock-data.ts` — Flutter checkout blocked on backend API, missing Stripe webhook secret on staging, Nova design tokens, regression suite gaps, client pricing approval, etc. All examples reference real personas (Flutter dev, Backend, QA, DevOps, PM, Designer, Product).
