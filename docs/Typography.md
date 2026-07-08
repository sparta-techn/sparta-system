# Typography — SpartaFlow Hub

## 1. Families

- **Sans / Display:** Inter Variable. Bundled via `@fontsource-variable/inter` — no Google Fonts request.
- **Mono:** JetBrains Mono Variable. Used for code, IDs, durations, monospaced numeric tables when `tabular-nums` isn't enough.
- **Serif:** none. Reject editorial serifs unless explicitly requested.

Font stacks declared in `@theme inline` (`--font-sans`, `--font-mono`, `--font-display`). Use Tailwind's `.font-sans`, `.font-mono`, `.font-display`.

## 2. Scale

Use Tailwind's default size utilities; do not invent new sizes. Map for SpartaFlow:

| Role              | Class                                                               | Size / leading | Weight | Tracking |
| ----------------- | ------------------------------------------------------------------- | -------------- | ------ | -------- |
| Display           | `text-4xl sm:text-5xl font-display font-semibold tracking-tight`    | 36/40 → 48/52  | 600    | tight    |
| H1 (page)         | `text-2xl sm:text-3xl font-display font-semibold tracking-tight`    | 24/32 → 30/36  | 600    | tight    |
| H2                | `text-xl font-display font-semibold`                                | 20/28          | 600    | normal   |
| H3                | `text-lg font-semibold`                                             | 18/26          | 600    | normal   |
| H4                | `text-base font-semibold`                                           | 16/24          | 600    | normal   |
| Body Large        | `text-base`                                                         | 16/24          | 400    | normal   |
| Body              | `text-sm`                                                           | 14/20          | 400    | normal   |
| Small             | `text-xs`                                                           | 12/16          | 400    | normal   |
| Caption / Eyebrow | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | 12/16          | 500    | wide     |
| Label             | `text-sm font-medium`                                               | 14/20          | 500    | normal   |
| Button            | `text-sm font-medium`                                               | 14/20          | 500    | normal   |
| Code              | `font-mono text-[13px]`                                             | 13/20          | 400    | normal   |

Defaults: body is `text-sm text-foreground` in dense ops UIs; pages can opt into `text-base` for marketing-style content.

## 3. Numeric

- Every count, time, percentage, money, duration, or table cell holding numbers gets `tabular-nums` (or the `[data-tabular]` attribute) so digits stay aligned across rows.
- Latin numerals only.

## 4. Line Length

- Body copy max width: ~70ch (`max-w-2xl` ≈ 65ch is fine).
- Form helper text and descriptions: same.
- Page titles can run wider; `truncate` if they share a row with controls.

## 5. Rhythm

- Vertical rhythm follows the spacing scale, not type. Use `space-y-*` or `gap-*` between blocks; don't rely on default margin on headings.
- Section gap: `mt-8` between major sections in a page; `mb-6` after `PageHeader`.

## 6. Hierarchy Rules

- One `<h1>` per route — provided by `PageHeader`.
- Card titles use `<CardTitle>` (renders as `<h3>` semantically appropriate to context).
- Never skip a level (H1 → H3 jump is OK only when H2 would carry no content).

## 7. Don't

- Don't use ALL CAPS for body copy. Eyebrows only.
- Don't go below `text-xs` for any content humans need to read.
- Don't rely on weight alone to signal hierarchy in critical states — pair with size + spacing.
- Don't disable font smoothing.
