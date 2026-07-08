# Midday Workflow

The Midday Status Report is the second of three daily touchpoints in SpartaFlow Hub. It sits between Morning Check-in and the future End-of-Day Report.

## Daily flow

```
09:00  Start work
       │
       ▼
       Morning Check-in            (mood, main goal, priorities, planned tasks, expected blockers)
       │
       ▼
       Focused work
       │
14:00  Midday reminder fires       (floating banner, surfaces open dependency count)
       │
       ▼
       Midday Status               (≤3 minutes: progress %, completed tasks, focus, blockers, help, outlook)
       │
       ▼
       Continues working
       │
18:00  End-of-day report           (future module — completion deltas vs. morning plan)
```

Only **one** Midday Status is allowed per work session. The 30-minute post-submission edit window lets people fix typos or add context without unlocking a second submission.

## States

| State       | Triggered by                 | Visible to                                                             |
| ----------- | ---------------------------- | ---------------------------------------------------------------------- |
| `pending`   | No submission yet today      | Owner (dashboard widget), Manager (operational view "missing reports") |
| `submitted` | `submitMidday()`             | Owner, Manager, HR (HR sees only the status, not the content)          |
| `editing`   | `?edit=1` within 30 minutes  | Owner only                                                             |
| `locked`    | >30 minutes after submission | All viewers (content frozen)                                           |

## Reminder logic

Default trigger time: **14:00 local**.

```ts
shouldRemind(now) =
  now.hour >= MIDDAY_REMINDER_HOUR &&
  now.hour < 18 &&
  getMiddaySubmission() === null &&
  !dismissedToday();
```

- Snooze / dismiss is sticky for the day (one key per work date).
- A successful submission silently hides the banner.
- The banner shows count of open dependencies — that count will pre-fill the blockers step, removing duplicate typing.

## Field-by-field reasoning

| Field                   | Why it earns the 30 seconds                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| Overall progress        | One number is the fastest manager scan in the company.                    |
| Completed since morning | Closes the loop on the morning plan; surfaces partials.                   |
| Current focus           | Lets a manager interrupt with confidence — or choose not to.              |
| Blockers                | Links to dependencies the team can act on; no free-text duplication.      |
| Help                    | Routes a specific ask to a specific person. Optional by design.           |
| Outlook                 | Single most useful signal for "will the day land?" — drives at-risk view. |

## Manager view (`?view=manager`)

What managers do here:

1. Glance at submission rate to spot reporting gaps.
2. Scan at-risk count — anyone in `blocked` or `need_manager_help` is one click away.
3. Read common blockers — recurring themes drive process change, not 1:1s.
4. Inspect by-department progress to balance load.

## HR view (`?view=hr`)

HR sees participation only — submitted? on time? completion rate? Work content (`currentFocus`, `taskProgress`, `blockerLinks`, `help`) is hidden by RLS and visually replaced with em-dashes. This is enforced at the route level and (in production) by RLS policies on the `midday_status` table.

## Anti-patterns to avoid

- ❌ Reporting tools that demand a paragraph. The wizard cap is one sentence per field.
- ❌ Surveillance optics. Outlook = "Need manager help" routes to leadership; it does not score the employee.
- ❌ Duplicate work. Blockers link to existing dependencies — never retype.
- ❌ Forced rituals. The reminder is dismissible; missing a Midday is visible but never punitive in the UI copy.

## Future workflow hooks

- `outlook === 'need_manager_help'` → notification to direct manager.
- `help.enabled` → notification to the chosen teammate.
- New blocker note + "Create dependency" hand-off → opens the Dependencies module with prefilled context.
- End-of-Day Report will diff `taskProgress` against its own submission to compute "shipped today" + carry-over.
