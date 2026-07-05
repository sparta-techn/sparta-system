# Accessibility — SpartaFlow Hub

Target: **WCAG 2.1 AA** across every shipped surface. Verified by the audit checklist (`DesignSystem.md` §6) on every release.

## 1. Foundations

- One `<main>` per route — provided by `AppShell`, not by individual pages.
- One `<h1>` per route — provided by `PageHeader`.
- Landmark sanity: `header > nav` in sidebar, `main` for content, `footer` only where intentional.
- `html lang="en"` set in the root shell.
- Document title set per route via `head()` — also used by screen readers and tab switchers.

## 2. Color & Contrast

- All token pairs meet AA contrast (4.5:1 body, 3:1 large text and UI components) in both themes.
- Status is never conveyed by color alone — always paired with a label, icon, or dot (`StatusBadge` enforces this).
- `text-muted-foreground` is for secondary content; not for required information.

## 3. Keyboard

- Every interactive element reachable in logical tab order.
- Visible `:focus-visible` ring globally via the base CSS rule (`box-shadow: var(--shadow-focus)`).
- Custom widgets must implement keyboard semantics — but we prefer Radix/shadcn primitives, which already do.
- Escape closes overlays. Arrow keys navigate menus. Enter / Space activate.
- Skip-to-content link should be added when content density warrants it (`<a href="#main" className="sr-only focus:not-sr-only ...">`).

## 4. Focus Management

- Dialogs/sheets trap focus while open and restore it on close (Radix handles this).
- After destructive actions, focus moves to the next logical control (or back to the trigger).
- Do not use `autoFocus` outside of dialogs or first-field-in-a-modal contexts.

## 5. Icons & Buttons

- Icon-only buttons MUST have `aria-label`. The `Topbar` examples are linted in code review.
- Decorative icons inside labelled buttons are `aria-hidden`.
- Use the shadcn `Button` size — its default tap target is ≥ 44 × 44 px; bump `size="icon"` to `min-h-11 min-w-11` for primary mobile actions.

## 6. Forms

- Every `<input>`, `<textarea>`, `<select>` has an associated `<Label htmlFor>`.
- Errors surface inline next to the field with `aria-describedby` linking to the message; the field gets `aria-invalid="true"`.
- Required fields are marked both visually (`*` after label) and via `required` on the input.
- Submit buttons receive `aria-busy` while pending; their label changes to reflect state ("Saving…").

## 7. Lists & Tables

- Tables use `<thead>` / `<tbody>` / `<th scope>`.
- Sortable headers expose `aria-sort` (`ascending` / `descending` / `none`).
- Empty / loading / error states are always provided (`states.tsx`) so a screen-reader user never lands on a silent region.
- Filter controls have visible labels; iconography is supplementary.

## 8. Dynamic Content

- Toasts (`sonner`) announce via `aria-live="polite"`.
- Long-running operations expose progress (`<Progress>` with `aria-valuenow`).
- Background updates that change visible counts use `aria-live="polite"` on the containing region; never `assertive` for non-critical updates.

## 9. Motion

- Respect `prefers-reduced-motion`. See `Animations.md` §6.
- No flashes faster than 3 / second.

## 10. Mobile

- Tap targets ≥ 44 × 44 px.
- Inputs do not zoom on focus: use `text-base` or set `font-size: 16px` on inputs at the smallest breakpoint.
- Avoid hover-only affordances; provide an equivalent for touch.

## 11. Testing

- Manual: keyboard-only run-through of every primary flow per release.
- Automated: axe-core via Playwright on the showcase route in CI; will extend to feature routes as they ship.
- Real assistive tech: VoiceOver (macOS / iOS), NVDA (Windows), TalkBack (Android) at least once per major release.

## 12. Anti-patterns (forbidden)

- `onClick` on `<div>` without `role="button"` + keyboard handlers — use `<button>` or the shadcn `Button`.
- `tabIndex` > 0.
- Disabling `:focus-visible`.
- `aria-hidden="true"` on a container that holds focusable children.
- Color-only error indicators ("the border is red, you'll figure it out").
- Auto-focusing inputs on top-level pages.
