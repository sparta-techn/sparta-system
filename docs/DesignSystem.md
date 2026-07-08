# Design System — SpartaFlow Hub

A premium, low-friction operational UI inspired by **Linear, Vercel, Notion, Stripe Dashboard, GitHub, Raycast**. Every screen is built from the same tokens and primitives so new features feel like one product, not an assembly of pages.

## 1. Principles

- **Tokens, not values.** No `text-white`, no `bg-[#...]`. Always semantic utilities backed by `src/styles.css` variables.
- **Calm by default.** Generous whitespace, restrained color, type does the work.
- **Status is structural.** Color always paired with a label, an icon, or a dot — never alone.
- **Light and dark are equals.** Every token has a dark counterpart; we ship dark mode on day one.
- **Keyboard first.** Every interactive surface reachable and operable from a keyboard with a visible `:focus-visible` ring.
- **Defaults win.** Use shadcn primitives. Custom widgets only when no primitive fits.

## 2. Token Layers

1. **Primitive tokens** — raw OKLCH values in `:root` / `.dark` (`--background`, `--primary`, `--success`, etc.).
2. **Semantic tokens** — exposed to Tailwind via `@theme inline` (`bg-card`, `text-muted-foreground`, `ring-ring`).
3. **Component tokens** — `cva` recipes (Button variants, StatusBadge tones, Card styles).

A change at layer 1 ripples through 2 and 3 without touching components.

## 3. Categories

| Category    | Source                                         | Surface in code                             |
| ----------- | ---------------------------------------------- | ------------------------------------------- |
| Colors      | `:root` / `.dark` in `src/styles.css`          | `bg-*`, `text-*`, `ring-*`, `border-*`      |
| Typography  | `--font-sans`, `--font-mono`, `--font-display` | Tailwind size utilities + `.font-display`   |
| Spacing     | Tailwind 4 default scale (`p-2` = 0.5rem)      | `p-*`, `m-*`, `gap-*`                       |
| Radius      | `--radius` + computed scale                    | `rounded-{sm,md,lg,xl,2xl,3xl}`             |
| Elevation   | `--shadow-{xs..xl,pop,focus}`                  | `shadow-*`                                  |
| Motion      | tw-animate-css + custom variants               | `transition-*`, `animate-*`                 |
| Z-index     | Tailwind defaults + reserved layers            | `z-30` topbar, `z-40` overlay, `z-50` toast |
| Breakpoints | Tailwind default `sm/md/lg/xl/2xl`             | responsive prefixes                         |

Detailed docs:

- `Colors.md`, `Typography.md`, `Spacing.md`, `Animations.md`, `Accessibility.md`, `ResponsiveGuidelines.md`, `LayoutGuidelines.md`, `ComponentLibrary.md`.

## 4. File Map

```
src/styles.css                       — all tokens
src/lib/theme.tsx                    — ThemeProvider, useTheme, light/dark/system
src/components/ui/*                  — shadcn primitives (do not fork without reason)
src/components/status-badge.tsx      — canonical status pill (StatusKind enum)
src/components/stat-card.tsx         — KPI card pattern
src/components/states.tsx            — EmptyState / NoResultsState / ErrorState / LoadingState / ListSkeleton
src/components/layout/app-shell.tsx  — SidebarProvider + Sidebar + Topbar + <main>
src/components/layout/app-sidebar.tsx
src/components/layout/topbar.tsx
src/components/layout/page-header.tsx
```

## 5. Do / Don't

- ✅ Compose features from `AppShell + PageHeader + Card + StatCard + Table + StatusBadge`.
- ✅ Add new status types to `StatusKind` so labels and tones stay centralized.
- ✅ Reach for `EmptyState` / `LoadingState` / `ErrorState` instead of inventing one-offs.
- ❌ Hardcoded colors, fonts, or magic spacing.
- ❌ Building a "primary button" from raw Tailwind classes.
- ❌ Skipping the `aria-label` on icon-only buttons.

## 6. Audit Checklist (run before every release)

- [ ] No `bg-[#...]`, `text-white`, `text-black` in feature code (`rg "(bg|text)-\[#" src/features`).
- [ ] Every icon-only button has `aria-label`.
- [ ] Each route's primary container has exactly one `<main>` and one `<h1>`.
- [ ] Tap targets ≥ 44 × 44 px on mobile.
- [ ] Visible `:focus-visible` ring on every interactive surface.
- [ ] Dark and light themes both pass WCAG AA contrast.
- [ ] Empty, loading, and error states present on every list / table.
- [ ] Tabular numbers (`tabular-nums`) on every count, time, and money field.

Cross-references: `ComponentLibrary.md` for primitives, `LayoutGuidelines.md` for shells, `Accessibility.md` for the audit method.
