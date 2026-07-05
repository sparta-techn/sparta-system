# Midday Status Report

A 2–3 minute progress update employees submit once per work session (default reminder: **14:00**). It gives managers operational visibility without interrupting the maker's flow, and chains cleanly with Morning Check-in → Midday → End-of-Day.

## Feature surface

```
src/features/midday/
  types.ts                   # Domain types (MiddayDraft, MiddaySubmission, outlook, task-progress)
  mock-data.ts               # Team midday entries for the manager view
  store.ts                   # localStorage-backed draft + submission facade
  components/
    midday-wizard.tsx        # 7-step stepper (progress → completed → focus → blockers → help → outlook → review)
    midday-summary.tsx       # Pre-submission summary card
    midday-widget.tsx        # Dashboard widget (employee view)
    midday-reminder.tsx      # Floating reminder banner after 14:00
    manager-midday-overview.tsx  # Manager + HR overview (HR mode hides work content)
```

Routes:

- `/app/midday` — wizard (new or `?edit=1`).
- `/app/midday?view=manager` — manager operational view.
- `/app/midday?view=hr` — HR view, participation only.
- `/app` — dashboard hosts `MiddayWidget` and `MiddayReminder`.

## Form sections

| # | Section | Component | Required |
| - | - | - | - |
| 1 | Overall progress (0–100, 10% steps) | `ProgressStep` (Slider + 10% chips + visual bar) | ✓ |
| 2 | Completed since morning | `CompletedStep` (pulls morning tasks → completed / partial / not started + note) | — |
| 3 | Current focus | `Input` (≤140 chars) | ✓ |
| 4 | Current blockers | `BlockersStep` (link to open dependencies, mark resolved, new-blocker note + "Create dependency" hand-off) | — |
| 5 | Need assistance | `HelpStep` (toggle → Department / Person / Description / Priority) | — |
| 6 | End-of-day outlook | `OutlookStep` (radiogroup: On track / Need more time / Blocked / Need manager help) | ✓ |
| 7 | Review | `MiddaySummary` | — |

## Store facade (`store.ts`)

The single integration seam. UI never touches `localStorage` directly.

```ts
getMiddayDraft() / setMiddayDraft(d) / clearMiddayDraft()
getMiddaySubmission() / submitMidday(d) / updateMiddaySubmission(patch)
canEditMidday(s)             // 30-minute window
useTodayMidday()              // reactive widget hook
shouldRemind()                // reminder logic (default 14:00, stops at 18:00)
```

When wired to the backend this file becomes a thin wrapper around three Supabase RPCs (`submit_midday_status`, `update_midday_status`, `get_today_midday`) plus a TanStack Query subscription. The component API does not change.

## Persistence contracts (future backend)

`MiddayDraft` and `MiddaySubmission` will map 1-to-1 to the `midday_status` table.

Server-side rules (future migration):

1. Unique `(user_id, work_session_id)` — one report per work session.
2. Update allowed only when `now() - submitted_at <= interval '30 minutes'`.
3. RLS:
   - Owner: full read/write.
   - Manager: read on team rows.
   - HR: read of `submitted` + `submitted_at` only — no `current_focus`, `task_progress`, `blocker_links`, `help`.
4. `outlook = 'need_manager_help'` triggers a notification to the direct manager.
5. Blocker links are FK references to `dependencies(id)` — no duplicate typing.

## Reminder UI

`MiddayReminder` is a floating, dismissible banner rendered on the dashboard. It only appears when:

- Local time ≥ `MIDDAY_REMINDER_HOUR` (default 14) and < 18.
- No submission exists for today.
- It hasn't been dismissed today (`sf:midday:reminder-dismissed` key).

The banner surfaces the count of open dependencies (which the wizard will pre-fill) and a one-tap "Submit now" CTA.

## Dashboard widget

`MiddayWidget` swaps state based on submission:

- **Pending**: shows "2 minutes. Keep your team in sync." + Submit CTA.
- **Submitted**: shows progress bar, current focus, top unresolved blocker, outlook badge, and an Edit CTA while the 30-minute window is open.

The widget refreshes every minute via `useMinuteTick` so submitted-at timestamps and edit-window expiry stay live without polling.

## Manager / HR visibility

`ManagerMiddayOverview` renders:

- KPI grid: submission rate, average progress, at-risk count, help requests.
- Missing reports list.
- Common blockers (frequency).
- By-department progress + outlook distribution.
- Outlook breakdown.

`hrMode` (the `?view=hr` route) hides every qualitative column — only submission and completion rates remain. This mirrors the RLS rule above.

## Accessibility

- Wizard is a single `<Card>` with labelled step nav (`<nav aria-label>` + `<ol>`).
- Progress slider has a visible numeric value and `aria-label`.
- Outlook step is a real `radiogroup` with `aria-checked` per option.
- Every input has a `<Label htmlFor>` and required fields announce `aria-invalid` + `aria-describedby` on error.
- The reminder uses `role="status"` + `aria-live="polite"`.
- All controls reachable via keyboard; primary actions sit at the bottom of the card in tab order.

## Interfaces prepared for future integrations

- **ClickUp**: `MOCK_PLANNED_TASKS` (re-used from the check-in module) carries a `source` discriminator. Swap with an adapter query from `src/features/integrations/clickup/*`.
- **Dependencies**: blocker links already store `dependencyId` + a `titleSnapshot` so historical reports stay readable when the source dependency is renamed or closed.
- **AI summaries**: `MiddaySubmission` is structured (not freeform), so a future "summarise my day so far" pass has clean inputs (`progress`, `taskProgress[]`, `currentFocus`, `outlook`).
- **Notifications**: the `outlook === 'need_manager_help'` and `help.enabled` flags are the trigger points; no UI changes will be needed when the notification module lands.
