# End-of-Day Report

Status: implemented (UI scaffolding, mock store).
Owner: Workflow Systems.
Route: `/app/eod` · history at `/app/eod/history`.

## Purpose

The End-of-Day (EOD) Report is the **official daily handover** for every
employee. It belongs to the current Work Session — exactly one report per
session — and it gates checkout. The report answers five questions:

1. What did I complete today?
2. What is still in progress?
3. What remains blocked?
4. What should happen tomorrow?
5. Does another employee need something from me?

It exists alongside, but does not replace, ClickUp. SpartaFlow Hub tracks the
**operating layer** (attendance, handover, blockers, communication).

## Position in the daily workflow

```
Morning check-in → Work → Midday status → Work → EOD report → Checkout
```

The Work Session becomes `ready_for_checkout` once an EOD report has been
submitted for it. The checkout action itself remains in the Attendance module.

## Form structure

Seven sections + a final review. Required fields are marked.

| #   | Section                   | Required        | Notes                                                                                                           |
| --- | ------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Today's Summary           | ✓               | Free-text, max 500 chars. Live counter.                                                                         |
| 2   | Completed Today           | —               | Per planned task: `completed` / `partial` / `not_started` + optional note.                                      |
| 3   | Work Still In Progress    | —               | Dynamic list with title, priority, ETA, notes.                                                                  |
| 4   | Open Dependencies         | —               | Auto-loaded from the Dependencies module. Per-item note + inline "Mark resolved". Link out to create a new one. |
| 5   | Need From Others Tomorrow | —               | Department · description · priority · due date · related dependency.                                            |
| 6   | Tomorrow's Plan           | ✓ (1+ priority) | Chip-list editors for priorities, tasks, meetings, expected blockers.                                           |
| 7   | Daily Reflection          | —               | Three optional prompts: went well / slowed me down / for my manager.                                            |
| ✓   | Review                    | —               | Read-only render of all sections + work-session summary.                                                        |

### Validation rules

- `summary.trim() !== ""` and `summary.length ≤ 500`.
- `tomorrow.priorities.length ≥ 1`.
- Everything else is optional.

The wizard surfaces these the moment the user tries to advance past the
relevant step; the Submit button stays disabled until both pass.

### Need-from-others departments

`Backend`, `Flutter`, `QA`, `DevOps`, `UI/UX`, `Product`, `Manager`, `Client`
(see `src/features/eod/types.ts → NEED_DEPARTMENTS`).

## Work-session auto summary

Rendered on the review step and persisted with the submission. Fields:

- `checkIn`, `checkOut` (estimated as "now" at submission time)
- `workedMinutes`, `breakMinutes`
- `morningCheckInDone`, `middayStatusDone` (booleans)
- `dependenciesCreated`, `dependenciesResolved` (counts for this session)

In this UI-only milestone the summary is synthesised in
`src/routes/_authenticated/app/eod.index.tsx → buildSessionSummary()`. When
the backend lands it must be replaced with a single RPC
(`select_today_work_session_summary`) so the figures are authoritative.

## After submission

- `submitEod(draft, sessionSummary)` writes the submission, clears the draft,
  and pushes the work date into the submissions index.
- Dashboard widget flips to `Submitted` with the time.
- Checkout becomes available (Attendance module).
- A 30-minute edit window opens, exposed via `?edit=1` from the widget.

## Dashboard widget (`EodWidget`)

States, in priority order:

1. **Pending, no draft** — CTA `Submit report`.
2. **Pending, draft in progress** — progress bar (`eodCompletionPct`), CTA
   `Resume report`, badge `Draft`.
3. **Submitted, edit window open** — submission time, completion %, top
   tomorrow priority, completed count, CTA `Edit (window open)`.
4. **Submitted, window closed** — same readout, CTA `View history`.

## Manager dashboard (`/app/eod?view=manager`)

Operational view designed for ≤30-second scanning:

- KPIs: submission rate, average completion, total work shipped today,
  total open dependencies pinned today.
- Missing reports (avatar, role, "Pending" badge).
- Most completed work (top 5 by `completedCount`).
- Common blockers (`topBlocker` aggregated and counted).
- Tomorrow risks (employees who flagged a `tomorrowRisk`).
- Open help requests routed across teams.
- Completion-by-person bars.

## HR view (`/app/eod?view=hr`)

Same shell, but **all qualitative work content is suppressed**. HR sees:

- Submission rate.
- Missing reports list (name, role, status).
- Other KPIs render as `—` with the hint _Hidden in HR view_.

This implements the principle that operational reports are not personnel
records.

## Report history (`/app/eod/history`)

- Accordion list, newest first.
- Search across summary, completed titles, tomorrow plan.
- Range presets (7d / 30d / 90d) plus a from/to date picker.
- Per-row badge with `done` count; expansion reveals summary, tomorrow
  priorities, and the work-session KV grid.

When no local submissions exist, the page renders a seven-row mock seed so the
UX can be demoed end-to-end.

## Accessibility

- Step navigation is a real `<ol>` with `aria-label`.
- Required-field errors carry `aria-describedby` and inline `AlertCircle`
  icons, never colour alone.
- All interactive choice rows expose `aria-pressed` / `aria-checked`.
- The chip-list editor accepts both `Enter` to commit and a visible `Add`
  button; remove buttons carry `aria-label="Remove {value}"`.

## Responsive

- Wizard collapses from `[240px | content]` two-column to a single column
  below `lg`. The step list stays at the top so users can still skip around.
- Multi-input rows (need-from-others, in-progress) collapse from
  `[department · priority · ✕]` to a stacked layout below `sm`.
- Manager and history pages use `xl:grid-cols-2` / `xl:grid-cols-4`,
  collapsing gracefully on tablet and mobile.

## Out of scope (explicitly)

- No ClickUp integration. Planned tasks are read from the morning check-in
  store (see `Attendance.md` and `MorningCheckin.md`).
- No AI summary or auto-generated paragraphs.
- No backend notifications. The interfaces are clean enough to wire push or
  email later without UI changes.
- No automatic checkout. Submitting only flips the session to
  `ready_for_checkout`; the actual checkout remains an explicit user action.

## Future integration points

| Concern              | Today (mock)                              | Backend swap-in                                                  |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Persistence          | `localStorage` via `store.ts`             | `submit_eod_report`, `update_eod_report`, `get_session_eod` RPCs |
| Planned tasks        | Morning check-in store                    | ClickUp sync                                                     |
| Work-session summary | Synthesised in route                      | `select_today_work_session_summary` RPC                          |
| Dependencies         | `useDependencies()`                       | Existing dependency tables                                       |
| History              | `listEodSubmissions` (localStorage index) | RLS-protected `eod_reports` view                                 |

## File map

```
src/features/eod/
  types.ts                            Domain types, defaults, NEED_DEPARTMENTS
  store.ts                            Draft + submission + history facade
  mock-data.ts                        Manager team data + history seed
  components/
    eod-wizard.tsx                    7-step + review wizard
    eod-summary.tsx                   Review screen
    eod-widget.tsx                    Dashboard card
    eod-history-list.tsx              History page contents
    manager-eod-overview.tsx          Manager / HR view
src/routes/_authenticated/app/
  eod.index.tsx                       Form + manager/hr view (?view=)
  eod.history.tsx                     History page
docs/
  EndOfDayReport.md                   (this file)
  DailyHandover.md                    Workflow, states, handover rituals
```
