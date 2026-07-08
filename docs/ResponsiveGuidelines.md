# Responsive Guidelines — SpartaFlow Hub

The product is desktop-first (most users work on laptops) but every screen must remain usable on tablet and phone for managers on the go.

## 1. Breakpoints (Tailwind defaults)

| Token | Min width | Target                                |
| ----- | --------- | ------------------------------------- |
| `sm`  | 640 px    | large phones landscape, small tablets |
| `md`  | 768 px    | tablets portrait                      |
| `lg`  | 1024 px   | small laptops, tablets landscape      |
| `xl`  | 1280 px   | standard laptops, desktops            |
| `2xl` | 1536 px   | large desktops                        |

## 2. Layout Behaviour

| Surface          | Mobile                                     | Tablet                          | Desktop          |
| ---------------- | ------------------------------------------ | ------------------------------- | ---------------- |
| Sidebar          | offcanvas, opened via `SidebarTrigger`     | collapsible icon strip (`w-14`) | full sidebar     |
| Topbar           | trigger + search hidden inline if needed   | full                            | full             |
| Page padding     | `px-4 py-6`                                | `sm:px-6`                       | `lg:px-8`        |
| Stat cards grid  | 1 col                                      | `sm:grid-cols-2`                | `xl:grid-cols-4` |
| Dashboard panels | stacked                                    | `md:grid-cols-2`                | `xl:grid-cols-3` |
| Data tables      | horizontal scroll within rounded container | same                            | full             |
| Forms            | full-width fields                          | 2-col when fields are short     | 2-col            |

## 3. Header / Row Pattern (mandatory)

Multi-item header rows MUST use the grid + min-w-0 + shrink-0 pattern (see project standard). The `PageHeader` component already does this:

```tsx
className =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between";
```

Title gets `truncate`; actions get `shrink-0`.

## 4. Typography Scaling

- Page titles: `text-2xl sm:text-3xl`.
- Body stays `text-sm` — readable at every breakpoint.
- Display surfaces (rare empty hero, branding) scale `text-4xl sm:text-5xl`.

## 5. Touch & Pointer

- Tap targets ≥ 44 × 44 px on mobile (see `Accessibility.md`).
- Hover affordances always have a tap/keyboard equivalent.
- `min-h-dvh` instead of `min-h-screen` for full-height layouts so mobile browser chrome doesn't clip.

## 6. Tables

- Always wrap in `<div className="overflow-x-auto rounded-lg border border-border">…</div>` for mobile horizontal scroll.
- Column visibility menu hides non-essential columns by default on `< md`.
- Bulk-action bars become bottom sheets on mobile, top bars on desktop.

## 7. Sidebar Specifics

- `collapsible="icon"` for the desktop sidebar so collapse keeps icons visible.
- The `SidebarTrigger` sits in the topbar — always visible regardless of collapse state.
- On mobile, sidebar opens as a sheet (Radix Drawer behavior, built into shadcn Sidebar).

## 8. Testing

- Check every new view at 375 × 812, 768 × 1024, 1280 × 800, 1920 × 1080 before merging.
- Verify no horizontal page scroll at 320 px width (smallest supported).
- Verify keyboard reachability of every control across breakpoints.

## 9. Don't

- Don't hide critical actions behind hover-only menus on mobile.
- Don't rely on `lg:` for the primary layout — design mobile first then enhance.
- Don't use `h-screen` (use `h-dvh`).
- Don't bake breakpoints into component code — components should adapt by container, layout decides breakpoints.
