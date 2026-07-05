# Component Library — SpartaFlow Hub

Every component belongs to one of three rings:

1. **Primitives** — `src/components/ui/*` (shadcn/Radix). Don't fork without a written reason.
2. **System components** — `src/components/*` (StatusBadge, StatCard, states, layout). Reusable across features.
3. **Feature components** — `src/features/<feature>/components/*` (future). Built from rings 1 and 2.

Each entry below: **Purpose · Variants · Sizes · States · A11y**.

## 1. Primitives in use (shadcn)

`Button, Input, Textarea, Label, Select, Combobox (cmdk), Checkbox, RadioGroup, Switch, Slider, Calendar, Popover, HoverCard, Tooltip, Dialog, AlertDialog, Drawer (vaul), Sheet, Toast (sonner), Alert, Progress, Skeleton, Avatar, Tabs, Accordion, Breadcrumb, Pagination, Table, Card, Sidebar, DropdownMenu, ContextMenu, NavigationMenu, Command (Cmd-K), ScrollArea, Separator, Toggle, ToggleGroup, AspectRatio, ResizablePanels, Chart (recharts wrapper).`

All keyboard, focus, and ARIA behavior comes from Radix — do not annotate around it. Customizations live in Tailwind classes against semantic tokens.

## 2. Button

- **Purpose:** all clickable actions; never use a `<div onClick>`.
- **Variants:** `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`.
- **Sizes:** `sm`, `default`, `lg`, `icon`.
- **States:** hover, active, focus-visible, disabled, loading (`aria-busy` + spinner via icon swap).
- **A11y:** icon-only buttons require `aria-label`. Use visible text whenever possible.

## 3. Input / Textarea / Select / Combobox

- **Purpose:** data entry.
- **Variants:** plain, with leading icon (`Input` + absolute icon), with trailing slot (button).
- **Sizes:** default (`h-9`), large (`h-10`).
- **States:** focus ring (`ring-3 ring-ring`), invalid (`aria-invalid` → `border-destructive`), disabled, read-only.
- **A11y:** always paired with `<Label htmlFor>`. Error message linked via `aria-describedby`.

## 4. Checkbox / Radio / Switch

- **Purpose:** boolean / single-of-many.
- **States:** checked, indeterminate (checkbox), disabled, focus.
- **A11y:** label clickable; group inputs need a `<fieldset>` + `<legend>` (visually hidden if needed).

## 5. Date / Time Picker

- **Purpose:** dates (calendar via react-day-picker) and times (custom).
- **Variants:** single date, range, time-only.
- **A11y:** keyboard nav inside calendar; announces selected date.

## 6. Command Palette

- **Purpose:** Cmd/Ctrl-K global navigation and quick actions. Powered by `cmdk` + shadcn `Command`.
- **A11y:** combobox semantics, focus-trapped while open.

## 7. Badge / StatusBadge

- **Purpose:** state pills.
- **`Badge` (primitive):** generic, free-form variants.
- **`StatusBadge` (system):** typed `StatusKind` → label + tone + dot. Use for any operational status.
- **Variants:** `working, offline, late, on_break, remote, pending, approved, rejected, resolved, blocked, completed, cancelled, escalated, acknowledged`.
- **Sizes:** `sm | md | lg`.
- **A11y:** `role="status"`, `aria-label` set to label.

## 8. Avatar

- **Purpose:** profile imagery + initials fallback.
- **Sizes:** `size-6, size-8, size-10, size-12`.
- **A11y:** `<AvatarImage alt>` describes the person; fallback initials are not announced as image content.

## 9. Tooltip / Popover / HoverCard

- **Purpose:** Tooltip = short hint (≤ 5 words); Popover = interactive panel; HoverCard = preview on hover.
- **A11y:** tooltips appear on focus, not only hover.

## 10. Dialog / AlertDialog / Sheet / Drawer

- **Purpose:** focused tasks, confirmations, side panels.
- **A11y:** focus trap, restore focus on close, Escape to dismiss (except AlertDialog destructive).

## 11. Toast (sonner)

- **Purpose:** transient notifications.
- **Variants:** default, success, warning, error, action (with button).
- **A11y:** `aria-live="polite"`. Never the only channel for critical info.

## 12. Alert

- **Purpose:** persistent inline messages within a section.
- **Variants:** `default`, `destructive` (extend with `success/warning/info` via tone classes).

## 13. Progress / Skeleton / Spinner

- `Progress` — determinate; expose `aria-valuenow/min/max`.
- `Skeleton` — visual placeholder; mark container `aria-hidden`.
- `Spinner` — re-uses Lucide `Loader2 + animate-spin`; pair with text in `LoadingState`.

## 14. Card / StatCard / Domain Cards

- **Card** — generic surface (Header / Content / Footer).
- **StatCard** — KPI with label, value, optional icon and trend.
- **Domain cards** (future feature-level): EmployeeCard, AttendanceCard, DependencyCard, AnnouncementCard, NotificationCard, EventCard — composed from Card + StatusBadge + Avatar.

## 15. Timeline / Activity Feed

- Vertical list with left rail, dot per item, time + actor + body.
- Empty state mandatory.

## 16. Tabs

- **Purpose:** switch between sibling views with shared context.
- **A11y:** Radix Tabs (`role="tablist"`, arrow-key nav).

## 17. Accordion

- **Purpose:** progressive disclosure.
- **A11y:** Radix Accordion (`aria-expanded`, keyboard).

## 18. Breadcrumb / Pagination

- **Breadcrumb:** last item is the current page (no link), aria-current="page".
- **Pagination:** cursor-based UX (Prev / Next + page label) — avoid raw page numbers for unbounded lists.

## 19. Data Table

- **Purpose:** filterable, sortable rows of structured data.
- **Features:** column header sort (`aria-sort`), column visibility, search, bulk actions, density toggle (`comfortable | compact`), horizontal scroll on mobile.
- **States:** loading (skeleton rows), empty (`EmptyState` inside `<TableCell colSpan>`), error (`ErrorState`).
- **A11y:** semantic `<table>`, `<th scope>`, caption when context isn't obvious.

## 20. Charts (recharts)

- Use the existing `Chart` wrapper for tooltips and legends.
- Colors via `--chart-1..5` tokens.
- Always include a fallback `<table>` for screen readers when conveying critical data.

## 21. Calendar

- Day-picker primitive for date selection; full month view for the Calendar feature page (future).

## 22. Empty / Error / NoResults / Loading

System components in `states.tsx`. Use everywhere; never improvise.

## 23. PageHeader

System component. One per route. Provides `<h1>` and primary actions slot.

## 24. AppShell / Sidebar / Topbar

Layout components — see `LayoutGuidelines.md`.

## 25. Icons

- **Library:** `lucide-react` (already bundled). One icon set; do not mix.
- **Sizes:** `size-3.5` (inline with `text-xs`), `size-4` (default), `size-5` (card icons), `size-6` (empty-state).
- **Color:** inherit from `text-*`. Decorative icons get `aria-hidden`.

## 26. Adding a New Component

1. Confirm no primitive already covers the case.
2. Place it in `src/components/<name>.tsx`. Feature-scoped components go under `src/features/<f>/components/`.
3. Use `cva` for variants when more than one tone/size exists.
4. Document Purpose · Variants · Sizes · States · A11y in this file.
5. Add to the showcase route while it's still the only live route.
