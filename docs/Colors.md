# Colors — SpartaFlow Hub

All color decisions live in `src/styles.css`. Components consume them through semantic Tailwind utilities (`bg-card`, `text-muted-foreground`). Raw values are forbidden in feature code.

## 1. Format

OKLCH everywhere. OKLCH gives perceptual control over lightness, so light/dark counterparts stay visually balanced and contrast is predictable.

```css
--primary: oklch(0.55 0.21 268); /* light theme */
.dark {
  --primary: oklch(0.7 0.18 268);
} /* dark theme, lifted lightness */
```

## 2. Semantic Roles

| Role                                    | Light                | Dark                   | Use                                                                       |
| --------------------------------------- | -------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `background`                            | near-white warm gray | near-black blue        | app canvas                                                                |
| `surface`                               | off-white            | lifted black           | sidebar/subtle sections                                                   |
| `card`                                  | pure white           | one step above surface | content surfaces                                                          |
| `popover`                               | white                | further lifted         | menus, dialogs                                                            |
| `foreground`                            | near-black indigo    | near-white             | body text                                                                 |
| `muted-foreground`                      | mid-gray             | warm light gray        | secondary text                                                            |
| `primary`                               | vivid indigo         | brighter indigo        | brand, primary CTAs                                                       |
| `primary-soft`                          | tinted indigo        | dim indigo             | badge/pill backgrounds                                                    |
| `secondary`                             | neutral surface      | neutral surface        | secondary buttons                                                         |
| `accent`                                | muted indigo tint    | dark indigo tint       | hover surfaces                                                            |
| `border`                                | cool gray            | white/8%               | hairlines                                                                 |
| `border-strong`                         | darker gray          | white/16%              | structural divides                                                        |
| `input`                                 | matches border       | white/10%              | form fields                                                               |
| `ring`                                  | primary              | primary                | focus rings                                                               |
| `destructive` / `-foreground` / `-soft` | red                  | red                    | errors, deletions                                                         |
| `success` / `-foreground` / `-soft`     | green                | green                  | positive states                                                           |
| `warning` / `-foreground` / `-soft`     | amber                | amber                  | attention                                                                 |
| `info` / `-foreground` / `-soft`        | blue                 | blue                   | informational                                                             |
| `chart-1..5`                            | brand sequence       | brand sequence         | recharts series                                                           |
| `sidebar*`                              | dedicated set        | dedicated set          | sidebar uses its own scope so theming the sidebar doesn't affect the page |

## 3. Status Mapping

| Operational state                      | Tone    | Reason                |
| -------------------------------------- | ------- | --------------------- |
| Working, Approved, Resolved, Completed | success | positive              |
| Late, Pending                          | warning | needs attention       |
| Blocked, Rejected, Escalated           | danger  | blocking / negative   |
| On break, Acknowledged                 | info    | neutral-positive      |
| Remote                                 | primary | branded informational |
| Offline, Cancelled                     | neutral | inactive              |

All canonicalized in `src/components/status-badge.tsx` (`StatusKind`).

## 4. Contrast

- All `text-foreground` on `bg-background`, `text-card-foreground` on `bg-card`, etc. meet WCAG AA in both themes.
- `text-muted-foreground` is for secondary information only, never the only signal.
- `*-soft` backgrounds always paired with their matching `text-*` (e.g. `bg-success-soft text-success`) to maintain AA contrast.

## 5. Adding a Color

1. Add the OKLCH value to `:root` (light) and `.dark` (dark).
2. Map it inside `@theme inline` as `--color-<name>: var(--<name>)`.
3. Add `-soft` and `-foreground` variants if it's a status color.
4. Use it via `bg-<name>` / `text-<name>` — never as a raw value.

## 6. Don't

- Don't pick a color from outside the palette ("just this once").
- Don't darken with `text-foreground/50` for emphasis; use `text-muted-foreground` instead.
- Don't use `success`/`destructive` for non-status decoration.
- Don't theme components by overriding token vars inline — fork the token instead.
