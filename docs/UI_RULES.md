# SpartaFlow Hub — UI Rules

Single source of truth for visual and interaction conventions. Every component, page, and feature MUST follow these rules. Tokens live in `src/styles.css`; this doc explains how to apply them.

> **Golden rule.** Never hardcode colors (`text-white`, `bg-black`, `bg-[#...]`). Always use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, etc.).

---

## 1. Colors

Use semantic tokens only. Roles:

| Token                                                                  | Use                                         |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| `background` / `foreground`                                            | App shell base                              |
| `surface`                                                              | Subtle elevated surfaces (panels, toolbars) |
| `card` / `card-foreground`                                             | Card containers                             |
| `popover`                                                              | Menus, dropdowns, tooltips, command palette |
| `primary` (+ `-foreground`, `-soft`)                                   | Brand actions, active states, links         |
| `secondary`                                                            | Low-emphasis surfaces                       |
| `muted` / `muted-foreground`                                           | Quiet backgrounds, secondary text           |
| `accent`                                                               | Hover/selected backgrounds                  |
| `success`, `warning`, `info`, `destructive` (+ `-foreground`, `-soft`) | Status                                      |
| `border`, `border-strong`, `input`, `ring`                             | Lines + focus                               |
| `chart-1..5`                                                           | Charts only                                 |

**Status `-soft` variants** are for badges, callouts, pill backgrounds. Text on `-soft` uses the matching solid color (e.g. `bg-success-soft text-success`).

**Both themes.** Every screen MUST work in light and dark. Never assume one. Test both before shipping.

---

## 2. Typography

Families (already wired via `--font-sans`, `--font-mono`):

- **Sans:** Inter Variable — all UI
- **Mono:** JetBrains Mono Variable — code, IDs, tokens, numeric tables when alignment matters

Scale (Tailwind utilities):

| Use          | Class                                                            |
| ------------ | ---------------------------------------------------------------- |
| Page H1      | `text-2xl font-semibold tracking-tight` (mobile) → `sm:text-3xl` |
| Section H2   | `text-lg font-semibold`                                          |
| Card title   | `text-sm font-medium`                                            |
| Body         | `text-sm` (default)                                              |
| Small / meta | `text-xs text-muted-foreground`                                  |
| Numeric      | add `tabular-nums` for time, money, counts                       |

Rules:

- One `<h1>` per page (SEO + a11y).
- Use `text-muted-foreground` for secondary text, never lighter grays.
- Never use serif fonts. Never load additional Google Fonts.
- Line-height defaults are fine; don't override unless designed for it.

---

## 3. Spacing

Use Tailwind's 4px scale. Standard rhythm:

| Context            | Padding                                | Gap                                           |
| ------------------ | -------------------------------------- | --------------------------------------------- |
| Page container     | `px-4 sm:px-6 lg:px-8 py-6`            | `gap-6` between sections                      |
| Card               | `p-4` or `p-6` (dense vs. comfortable) | `gap-3` internal                              |
| Form fields        | —                                      | `gap-4` between fields, `gap-1.5` label→input |
| Toolbar/header row | `px-4 py-3`                            | `gap-2`                                       |
| List rows          | `px-4 py-3`                            | `gap-3`                                       |

Rules:

- Prefer `gap-*` over margin between siblings inside flex/grid.
- Never mix arbitrary pixel values (`mt-[7px]`). Snap to the scale.
- Vertical rhythm: section→section `gap-6`/`gap-8`; subsection `gap-4`.

---

## 4. Radius & Elevation

| Token                        | When                                  |
| ---------------------------- | ------------------------------------- |
| `rounded-sm`                 | Inputs, badges                        |
| `rounded-md`                 | Buttons, small cards                  |
| `rounded-lg`                 | Cards (default), dialogs              |
| `rounded-xl` / `rounded-2xl` | Hero cards, sheets, modals on desktop |
| `rounded-full`               | Avatars, status dots, icon buttons    |

Shadows (tokens): `shadow-xs` for resting cards, `shadow-sm` for buttons, `shadow-md` for hover lift, `shadow-pop` for popovers/menus, `shadow-xl` for modals. Never use `shadow-2xl` or raw blur values.

---

## 5. Icons

- Library: **`lucide-react`** only. No other icon sets.
- Default size: `h-4 w-4` inline with text; `h-5 w-5` for buttons; `h-6 w-6` for empty states / hero blocks.
- Color: inherit (`currentColor`). Never color icons with hex.
- Pair with text or wrap in `aria-label` when alone.
- `shrink-0` on icons inside flex rows next to truncating text.

---

## 6. Buttons

Use the shared `<Button>` (`src/components/ui/button.tsx`). Never roll a custom button.

Variants:

| Variant             | Use                               |
| ------------------- | --------------------------------- |
| `default` (primary) | Single primary action per surface |
| `secondary`         | Neutral confirm                   |
| `outline`           | Secondary action next to primary  |
| `ghost`             | Tertiary / toolbar / icon buttons |
| `destructive`       | Delete, remove, irreversible      |
| `link`              | Inline navigation in prose        |

Sizes: `sm` (toolbars), `default` (forms/dialogs), `lg` (hero CTAs), `icon` (icon-only — REQUIRES `aria-label`).

Rules:

- One primary action per dialog/page surface. Everything else is `outline`/`ghost`.
- Order in dialogs: `[Cancel][Primary]`, primary on the right.
- Show loading state via the built-in `disabled` + spinner pattern; never swap text without indicator.
- Full-width buttons only on mobile or single-column forms.

---

## 7. Forms

Stack: `react-hook-form` + `zod` + shadcn `Form` primitives.

Layout:

- Single column on mobile; two columns at `md:` only for related short fields.
- Label above input. `gap-1.5` label→input. Helper text under input in `text-xs text-muted-foreground`.
- Required marker: `*` after label in `text-destructive`.
- Group related fields with a `Card` or a subtle `<fieldset>` (`border rounded-lg p-4`).

Inputs:

- Height: `h-9` default, `h-10` for large forms.
- Use the matching shadcn component for each input type (no native styling).
- Disabled inputs use the built-in disabled styling; never gray manually.

Submission:

- Submit button on the right, aligned with form footer.
- Autosave drafts for long flows (check-ins, EOD, project create) via debounced `localStorage` or server fn.

---

## 8. Validation

- Validate with `zod` schemas shared between client and server functions.
- Show errors **after** first blur or on submit — never on every keystroke.
- Inline error under the field in `text-xs text-destructive`; the field gets `border-destructive ring-destructive/30` via the Form primitive.
- One error per field at a time (the first failing rule).
- Form-level errors render in a top `Alert variant="destructive"` inside the form, above fields.
- On server failure: toast (sonner) + keep form values intact; never wipe input.

---

## 9. Cards

Use `<Card>` / `<CardHeader>` / `<CardTitle>` / `<CardDescription>` / `<CardContent>` / `<CardFooter>`.

- Default: `bg-card text-card-foreground border rounded-lg shadow-xs`.
- Padding: `p-6` for content-rich cards, `p-4` for dense list/stat cards.
- Header row: title left, optional actions right (use grid pattern from Responsive Layout).
- KPI/stat cards: use `<StatCard>`. Never inline a one-off variant.
- Never nest cards more than one level deep.

---

## 10. Tables

Use the shared `<Table>` (`src/components/ui/table.tsx`).

- Row height: `h-11` comfortable, `h-9` dense.
- Header: `text-xs font-medium text-muted-foreground uppercase tracking-wide`.
- Cells: `text-sm`. Numeric columns: `text-right tabular-nums`.
- Zebra striping: NO. Use hover (`hover:bg-muted/50`) and selection (`bg-accent`).
- Sticky header on scroll containers (`sticky top-0 bg-card`).
- Empty: render an `EmptyState` inside `<TableCaption>` area, not an empty `<tbody>`.
- Pagination + filters live in a toolbar above the table (`flex items-center justify-between gap-2 py-3`).
- Mobile: tables that don't fit MUST collapse to a card list — never horizontal-scroll user-critical data without warning.

---

## 11. Dialogs, Sheets, Drawers, Popovers

Pick by intent:

| Component                  | Use                                                                       |
| -------------------------- | ------------------------------------------------------------------------- |
| `Dialog`                   | Focused single task (confirm, short form, destructive action)             |
| `Sheet`                    | Side panel for filters, secondary forms, contextual editing               |
| `Drawer`                   | Mobile-first slide-up (replaces Dialog on small screens for long content) |
| `Popover` / `DropdownMenu` | Lightweight contextual actions                                            |
| `Tooltip`                  | One-line hints; never for tap targets on touch                            |

Rules:

- Always include a title and a description (or `sr-only` description) for a11y.
- ESC closes; backdrop click closes non-destructive dialogs only.
- Destructive confirms use `AlertDialog` with explicit verb (`Delete project`, not `OK`).
- Max width: `Dialog` `sm:max-w-md` default, `sm:max-w-lg` for forms, `sm:max-w-2xl` for rich content.
- Stack body content in `gap-4`; footer actions right-aligned with `gap-2`.

---

## 12. Empty States

Every list, table, board, and chart MUST handle empty.

Anatomy:

- Centered block, `py-12`.
- Icon in a soft circle: `h-12 w-12 rounded-full bg-muted text-muted-foreground` with a `lucide` icon `h-6 w-6`.
- Title: `text-base font-medium`.
- Description: `text-sm text-muted-foreground max-w-sm`.
- Primary CTA below (when an action makes sense).

Never show a blank area or "No data".

---

## 13. Loading States

- Initial route data: TanStack Query loader + suspense → render **skeletons** matching final layout. Never spinners on first paint.
- In-place refresh: subtle top progress bar or a `RefreshCw` spinning icon in the toolbar.
- Buttons in flight: `disabled` + small spinner replacing the leading icon; keep label visible.
- Skeletons: use `<Skeleton>` (`bg-muted animate-pulse rounded`). Match height and width of the real element.
- Charts: skeleton with the chart's bounding box + axis ticks placeholders.
- Never block the whole screen for a partial update.

---

## 14. Error States

- Route-level: `errorComponent` with title, description, `Try again` button that calls `router.invalidate()` AND `reset()`.
- Inline (widget): `Alert variant="destructive"` with concise message + retry.
- Form: see Validation §8.
- Network failures: toast + offer retry. Never silently swallow.
- 404 inside a route: render `notFoundComponent`, not a redirect.

---

## 15. Badges & Status

Use `<StatusBadge>` for entity status. Color mapping:

| Status family            | Token         |
| ------------------------ | ------------- |
| Success / done / online  | `success`     |
| In progress / info       | `info`        |
| Blocked / urgent / error | `destructive` |
| Warning / waiting        | `warning`     |
| Neutral / draft          | `muted`       |

Pattern: `bg-{role}-soft text-{role} border border-{role}/20 rounded-full px-2 py-0.5 text-xs font-medium`.

Status dots: use the `status-dot` utility from `styles.css`.

---

## 16. Navigation & Layout

- All authenticated screens render inside `AppShell` (sidebar + topbar + outlet).
- Page header pattern (responsive — see Responsive Layout below):
  - Left: title + breadcrumb / subtitle.
  - Right: primary action + secondary actions.
- Breadcrumbs for any page deeper than 2 levels.
- Active sidebar item: `bg-sidebar-accent text-sidebar-accent-foreground`.
- Command Palette (`⌘K`) is the universal quick-nav — every new feature registers its actions.

---

## 17. Responsive Behavior

Breakpoints (Tailwind): `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.

Rules:

- Mobile-first. Write base styles for mobile; layer `sm:`/`md:`/`lg:` for larger.
- Page header rows containing both text and widgets MUST follow the pattern:
  ```tsx
  <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
  ```
  with `min-w-0` on text containers, `shrink-0` on fixed widgets, `truncate` on single-line titles.
- Tables → card lists below `md`.
- Sidebar collapses to a sheet under `lg`.
- Dialogs become Drawers under `sm` for long content.
- Touch targets ≥ 40×40px on mobile (`h-10 w-10` minimum for icon buttons).
- Never rely on hover-only affordances on mobile; mirror with an explicit control.

---

## 18. Motion

- Library: `tw-animate-css` + Radix data attributes. Keep motion subtle.
- Duration: 150–200ms for micro, 250–300ms for panels/sheets, never above 400ms.
- Easing: default (`ease-out` for enter, `ease-in` for exit).
- Respect `prefers-reduced-motion`: disable non-essential transitions.
- Never animate layout-shifting properties (`top`, `left`, `width`) — use transform/opacity.

---

## 19. Accessibility

- All interactive elements reachable by keyboard, visible focus ring (`:focus-visible` token already wired).
- Icon-only buttons need `aria-label`.
- Form inputs always paired with `<Label>`.
- Color is never the only signal — add icon or text for status.
- Modal traps focus; ESC restores focus to opener.
- Tables: `<th scope>` set correctly; sortable headers announce sort state.
- Target contrast: WCAG 2.1 AA (4.5:1 body, 3:1 large text).

---

## 20. Don'ts (hard fails)

- ❌ Hardcoded colors (`text-white`, `bg-[#fff]`, hex in JSX).
- ❌ Inline styles for layout or color.
- ❌ Custom button/input markup outside the shared primitives.
- ❌ Duplicated component variants — extend the existing one.
- ❌ Spinners for initial route load.
- ❌ Empty `<div>` when data is missing — always an `EmptyState`.
- ❌ Breaking the AppShell layout for one-off pages.
- ❌ New icon libraries, new font families, new shadow scales.
- ❌ Tables that horizontal-scroll critical data on mobile without a card fallback.
- ❌ Removing focus rings.

---

Update this file whenever a new shared pattern is introduced. If a request would violate a rule above, raise it before implementing.
