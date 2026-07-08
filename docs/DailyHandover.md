# Daily Handover

Status: implemented (UI scaffolding).
Owner: Workflow Systems.
Related: `EndOfDayReport.md`, `MorningCheckin.md`, `MiddayStatus.md`,
`Attendance.md`.

## What "handover" means at SpartaFlow

A handover is the moment an employee transfers the state of their work to
**tomorrow's self**, **their teammates**, and **their manager** without
needing a meeting. The EOD report is the artefact. Done well, it removes the
need for status updates in chat, async pings, and standups about yesterday.

A good handover is **closed-form**: anyone reading it can decide what to do
next without asking a follow-up question.

## The handover loop (one work session)

```
┌────────────────────┐   ┌─────────────┐   ┌─────────────────┐   ┌──────────┐
│ Morning check-in   │ → │ Midday      │ → │ End-of-day      │ → │ Checkout │
│ Intent for the day │   │ Reality at  │   │ Handover for    │   │ Session  │
│                    │   │ ~midday     │   │ tomorrow        │   │ closes   │
└────────────────────┘   └─────────────┘   └─────────────────┘   └──────────┘
        plan                progress           handover               state
```

Each step is intentionally lightweight:

- **Morning** sets intent (mood, main goal, planned tasks, known blockers).
- **Midday** confronts intent with reality and reroutes if needed.
- **EOD** captures what actually happened and prepares tomorrow.
- **Checkout** is purely an attendance event; it is _not_ a place to update
  status.

## Work-session lifecycle (where EOD fits)

```
not_started ─▶ working ─▶ on_break ⇄ working ─▶ ready_for_checkout ─▶ finished
                                                       ▲
                                                       │  submit EOD report
                                                       │  (this module)
```

- A session enters `ready_for_checkout` the moment an EOD report exists for it.
- A session cannot become `finished` without that state transition.
- Exactly one EOD report is allowed per session; resubmission goes through
  the 30-minute edit window (see below).

## Handover contract

A submitted EOD report guarantees the following, in this order of importance:

1. **A reader can act in under 60 seconds.** Summary + tomorrow priorities
   are surfaced first in every consumer view (widget, manager overview,
   history).
2. **Open dependencies are accurate.** Every item the employee is waiting on
   is either pinned (with a current note) or marked resolved.
3. **Asks are routed.** Anything required from another team tomorrow is
   captured under _Need from others_ with a department and priority.
4. **Tomorrow is set up.** At least one priority exists; the employee can
   walk away from the laptop.

## Roles and what they consume

| Role     | Default view              | What they get                                                                     |
| -------- | ------------------------- | --------------------------------------------------------------------------------- |
| Employee | Wizard + widget + history | Drafts, edit window, personal history.                                            |
| Teammate | (future) Team feed        | Public-facing summary + tomorrow priorities.                                      |
| Manager  | `/app/eod?view=manager`   | Submission rate, common blockers, tomorrow risks, help requests, completion bars. |
| HR       | `/app/eod?view=hr`        | Submission rate + missing reports only. Work content is hidden by design.         |

The HR view is the test: if HR can answer "did everyone hand off?" without
seeing any work content, the privacy boundary is correct.

## The edit window

- **30 minutes** after submission.
- After the window closes the report is immutable. Corrections happen in
  tomorrow's report.
- Edits never re-trigger session state transitions — the work session is
  already `ready_for_checkout`.

This is deliberately tight to keep handovers honest. A multi-day editable
report invites rewriting history.

## Privacy and "operational vs personnel"

EOD reports are **operational data**, not personnel records:

- HR view hides work content (see above).
- Manager view aggregates blockers and risks, but the per-person bars only
  show completion percentage — not the qualitative reflection.
- The _Reflection_ section is shown to the employee and their direct
  manager only (when backend lands; today it is local-only).

## Rituals this replaces

| Ritual                               | Replaced by                                 |
| ------------------------------------ | ------------------------------------------- |
| "What did you do today?" Slack pings | Submitted EOD report.                       |
| Daily standup "yesterday" segment    | Common blockers + tomorrow risks panels.    |
| End-of-day handoff email             | Today's Summary section.                    |
| Manager 1:1 status interrogation     | Reflection (_for manager_) + tomorrow plan. |

It does **not** replace:

- 1:1s (used for coaching and growth, not status).
- Sprint reviews (used for outcome and demo, not handover).
- Incident postmortems (separate, governed by its own template).

## Failure modes & UX countermeasures

| Failure                                           | Countermeasure                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Employee submits a vague summary to "get it done" | Live char counter + placeholder example; tomorrow plan is required so the form can't be one-line.              |
| Open dependencies go stale                        | Section auto-loads from the Dependencies module; pinning is one click; resolving inline avoids context-switch. |
| Asks routed without a department                  | Department is a select with eight fixed options — no free text for routing.                                    |
| Manager has to read prose                         | Operational view aggregates blockers and risks; no manager workflow requires reading a summary.                |
| HR sees performance data                          | Dedicated HR view strips work content.                                                                         |
| Time-pressured user skips reflection              | Reflection is fully optional and last in the wizard.                                                           |

## Time budget

Target: **< 5 minutes** for a typical day.

Section budgets (P50):

- Summary: 60s.
- Completed: 30s (toggles only, notes optional).
- In progress: 45s.
- Open dependencies: 30s (auto-loaded; notes optional).
- Need from others: 30s if there is anything to route.
- Tomorrow: 60s.
- Reflection: 0–60s.
- Review + submit: 15s.

The wizard's autosaving draft means a partial fill at 16:00 carries forward
when the user returns at 17:45 to submit.

## Open questions (for the next milestone)

- Should resolving a dependency inside the EOD wizard write back to the
  Dependencies module immediately, or only at submit time? _(Today: local
  to the report.)_
- Should the team feed show the summary verbatim, or a shortened version?
- Should the EOD report carry attachments (PR links, dashboards)? Likely
  yes via the Dependencies attachment model, but out of scope for the
  current milestone.
