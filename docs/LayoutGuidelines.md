# Layout Guidelines — SpartaFlow Hub

## 1. AppShell

The authenticated app uses a single `AppShell` (`src/components/layout/app-shell.tsx`) that composes:

```
SidebarProvider
├── AppSidebar          ← navigation
└── SidebarInset
    ├── Topbar          ← trigger, search, theme, notifications, profile
    └── <main id="main">  ← route content
```

- `SidebarProvider` owns open/collapsed state and exposes `useSidebar`.
- `SidebarTrigger` lives in the Topbar so it's always visible (icon-collapsible sidebar still benefits; offcanvas mobile sidebar requires it).
- `<main>` is the only top-level main element on the page — never nest one inside route content.
- `id="main"` allows a skip-to-content link from any future global header.

## 2. Sidebar

- `collapsible="icon"` — collapses to a 56-px icon strip on desktop, slides off-canvas on mobile.
- Three sections: **Workspace** (Dashboard, Attendance, Workflow, Dependencies, Announcements, Notifications), **Team** (Directory, Reports), **System** (Settings, Help).
- Active route highlighted via TanStack `useRouterState` pathname match (exact for `/`, prefix for others).
- Brand mark in `SidebarHeader`; version footer in `SidebarFooter`.

## 3. Topbar

- Sticky, `h-14`, translucent background with `backdrop-blur-md`.
- Left: sidebar trigger + divider.
- Center: global search (`Cmd/Ctrl + K` reserved for the future Command Palette).
- Right: theme toggle, notifications bell with unread dot, user avatar.

## 4. PageHeader

`src/components/layout/page-header.tsx`. Use at the top of every route.

- `eyebrow` (optional) — small uppercase context label.
- `title` — `<h1>`, truncates on small screens.
- `description` — single paragraph, max-w-2xl.
- `actions` — primary + secondary buttons at most. Push tertiary actions into a kebab menu.
- Follows the responsive header pattern (`grid` on mobile → `flex` on `sm`).

## 5. Section Composition

Standard order per page:

1. `PageHeader`.
2. KPI row (`StatCard` × 1–4) — `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`.
3. Primary panel grid (`xl:grid-cols-3`, main content spans 2).
4. Supporting lists / tables.
5. Optional footer note.

Between sections: `mt-8`.

## 6. Cards

- Always `Card` + `CardHeader` + `CardContent` (and `CardFooter` when needed).
- `CardTitle` is the section heading; `CardDescription` provides a one-liner.
- Don't nest cards more than one level deep. Use sub-headings inside the same card for groupings.

## 7. Empty / Loading / Error

Every list, table, or chart MUST handle three states:

- `<LoadingState />` or `<ListSkeleton />` while data is fetching.
- `<EmptyState />` / `<NoResultsState />` when there's nothing to show.
- `<ErrorState />` when fetch fails, with a retry action.

All four live in `src/components/states.tsx`.

## 8. Modals, Drawers, Sheets

- **Dialog** — focused tasks ≤ 1 screen tall (create, confirm).
- **Drawer / Sheet** — secondary contexts and details panels.
- **Toast (sonner)** — transient feedback only; never use for blocking decisions.

Mounted at the root via `<Toaster richColors closeButton />` in `__root.tsx`.

## 9. Responsive Behaviour

See `ResponsiveGuidelines.md` for the breakpoint matrix and table/sidebar specifics.

## 10. Don't

- Don't introduce a second `<main>` in a route component.
- Don't render an unwrapped page without `PageHeader` (degrades title hierarchy).
- Don't add a second SidebarProvider; there's exactly one per app.
- Don't put the SidebarTrigger inside the sidebar only — it disappears with offcanvas.
