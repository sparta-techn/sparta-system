# Morning Check-in

The Morning Check-in is the first thing an employee does after starting work.
It's the planning ritual that turns "I'm online" into "this is my day".

## Goals

- Help employees focus by forcing one explicit goal and ranked priorities.
- Surface blockers and help-requests before they hurt the day.
- Give managers signal (mood trend, workload, blockers) without surveillance.
- **< 2 minutes** to complete. Anything longer kills adoption.

## When it runs

1. Employee starts a work session (`/app/attendance` → Start work).
2. Dashboard widget switches to "Not submitted" + CTA.
3. Employee opens `/app/check-in`, walks the wizard, submits.
4. Widget flips to "Completed" with timestamp + summary.
5. Edit is allowed for **30 minutes** after submission. After that the check-in is frozen.

One check-in per work session. Re-opening the wizard during the edit window loads the previous submission instead of a blank form.

## Sections (steps)

| #   | Step          | Required | Notes                                             |
| --- | ------------- | -------- | ------------------------------------------------- |
| 1   | Mood          | No       | 5 options + optional manager-visible note         |
| 2   | Main goal     | **Yes**  | One sentence, max 140 chars                       |
| 3   | Priorities    | **Yes**  | 1–5 items, with level + effort, reorderable       |
| 4   | Planned tasks | No       | Pick from mocked ClickUp list                     |
| 5   | Blockers      | No       | Presets + custom + optional note                  |
| 6   | Help request  | No       | Toggle. If on: department, person, desc, priority |
| 7   | Review        | —        | Read-only summary, then submit                    |

Validation triggers when leaving a required step; the wizard never silently swallows missing data.

## UX guardrails

- **Friendly tone**, but the copy never asks "how do you really feel?" — that's surveillance.
- The mood note is explicitly labelled as visible to the direct manager.
- Autosave runs every 500 ms while typing; banner shows draft state.
- Stepper is clickable (jump back), keyboard-navigable, and the progress bar mirrors step index.
- Mobile collapses the side stepper into a compact progress strip at the top of the card.

## Manager / HR views

- **Manager**: mood (anonymous in aggregate, attributed only when employee writes a note), today's goals, expected blockers, help requests, priority distribution.
- **HR**: participation only — who submitted, when. Mood detail and notes are gated behind explicit permission.

(Manager / HR pages are tracked in `/docs/DailyPlanning.md` and will be built after the read API lands.)

## Out of scope for this milestone

- Midday status update.
- End-of-day report.
- Real ClickUp integration (mock data only).
- Backend persistence — submissions live in `localStorage` keyed by work date.
- Manager / HR aggregation pages.
