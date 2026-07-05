# Spacing — SpartaFlow Hub

## 1. Scale

We use the Tailwind v4 default 4-px scale (`p-1` = 4 px, `p-2` = 8 px, …). Every spacing decision must land on the scale; off-grid values are forbidden.

Reference (the ones we actually use):

| Token | px | Use |
|---|---|---|
| `0.5` | 2 | hairline pad, badge dot offset |
| `1` | 4 | icon ↔ text in compact rows |
| `1.5` | 6 | between label and field |
| `2` | 8 | base padding inside small chips, button gap |
| `3` | 12 | card inner gap (compact) |
| `4` | 16 | card padding (default), form field spacing |
| `5` | 20 | card padding (StatCard), section gap (compact) |
| `6` | 24 | card padding (roomy), top of page |
| `8` | 32 | between major content sections |
| `10` | 40 | between page sub-sections (lg) |
| `12` | 48 | empty-state vertical padding |
| `16` | 64 | hero spacing (rare in app) |
| `20` | 80 | page max-width gutter (rare) |
| `24` | 96 | full-bleed gutter on large screens |

## 2. Layout Recipes

- **AppShell main padding:** `px-4 py-6 sm:px-6 lg:px-8`.
- **PageHeader:** `pb-6` below title.
- **Section gap:** `mt-8` between sibling sections.
- **Card padding:** default shadcn `p-6`, StatCard `p-5`, dense rows `p-3`.
- **Form field stack:** `space-y-4`; field-and-label group `space-y-1.5`.
- **Grids:** `gap-4` for tight grids (stat cards), `gap-6` for content cards.

## 3. Density Modes

Two densities only:

- **Comfortable** (default) — `p-4` / `p-6`, `text-sm` body, `space-y-4` stacks.
- **Compact** (data tables, dense lists) — `p-2.5` / `p-3`, `text-[13px]` body, `space-y-2` stacks. Triggered by adding `data-density="compact"` on a container; components opt in via CSS attribute selector when needed.

## 4. Touch Targets

Interactive targets ≥ 44 × 44 px on mobile. shadcn `Button` default size meets this; for `size="icon"` we use `size-9` for desktop, bump to `size-11` for primary mobile actions.

## 5. Don't

- Don't invent values like `p-[14px]` or `gap-5.5`.
- Don't pad cards asymmetrically (top 16 / bottom 24) without a reason that's documented in the component.
- Don't rely on `<br />` or empty `<div>` for spacing.
