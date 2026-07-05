# Daily Planning — Architecture Notes

The Morning Check-in is the first of three planned daily touchpoints (Morning → Midday → End-of-Day). This doc covers the shared shape so the later modules can drop in without refactors.

## Feature surface

```
src/features/checkin/
  types.ts              # Domain types + enums + EMPTY_DRAFT
  mock-data.ts          # Departments, employees, planned tasks
  store.ts              # localStorage-backed draft + submission facade
  components/
    mood-picker.tsx
    priorities-editor.tsx
    tasks-picker.tsx
    blockers-editor.tsx
    help-request-editor.tsx
    check-in-summary.tsx
    check-in-wizard.tsx
    check-in-widget.tsx
```

Routes:

- `/app/check-in` — the wizard (new or edit mode via `?edit=1`).
- `/app` — dashboard hosts `CheckInWidget`.

## Store facade (`store.ts`)

The single integration seam. UI never touches `localStorage` directly.

```ts
getDraft() / setDraft(draft) / clearDraft()
getSubmission() / submitCheckIn(draft) / updateSubmission(patch)
canEditSubmission(s)        // 30-minute window
useTodaySubmission()         // reactive hook for widgets
```

When we wire the backend, this file becomes a thin wrapper around three Supabase RPCs (`submit_check_in`, `update_check_in`, `get_today_check_in`) plus a TanStack Query subscription. The component API does not change.

## Data contracts

`CheckInDraft` is the editable shape. `CheckInSubmission` is `CheckInDraft & { id, submittedAt, workDate }`. The DB equivalent will mirror this 1-to-1.

Required server-side rules (future migration):

1. Unique `(user_id, work_date)` — one submission per work session.
2. Update allowed only when `now() - submitted_at <= interval '30 minutes'`.
3. RLS: owner full read/write; manager read on team rows; HR read on participation columns only.
4. Mood note column gated behind a `can_view_mood_notes(viewer, owner)` SECURITY DEFINER helper.

## Autosave

Draft state is debounced 500 ms and persisted to `sf:checkin:draft:<workDate>`. On submission the draft is cleared and the submission stored under `sf:checkin:submission:<workDate>`. The widget hook (`useTodaySubmission`) listens to a tiny in-module pub/sub plus a minute tick to keep "submitted at" + edit-window expiry fresh without polling.

## Validation

Centralised in the wizard via a `useMemo` that derives errors from the draft. Required: `mainGoal`, at least one priority with a non-empty title. Errors surface only after the user attempts to advance, never on first paint.

## Future modules sharing this layer

- **Midday status**: new `src/features/midday/` mirrors the same store pattern. Reuses `MOOD_OPTIONS`, `BlockerItem`.
- **End-of-day report**: same. Adds completion deltas vs. morning priorities.
- **ClickUp sync**: replace `MOCK_PLANNED_TASKS` with a query against the integrations adapter (`src/features/integrations/clickup/*`). The `PlannedTask` shape already carries a `source` discriminator.

## Accessibility

- Wizard is a single `<Card>` with a labelled step nav (`<nav aria-label>` + `<ol>`).
- Mood picker is a real `radiogroup` with `aria-checked`.
- Every input has a `<Label htmlFor>` and required fields announce `aria-invalid` + `aria-describedby` on error.
- All controls reachable via keyboard; primary actions sit at the bottom of the card in tab order.
