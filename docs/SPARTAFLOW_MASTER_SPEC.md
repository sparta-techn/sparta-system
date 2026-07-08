# SpartaFlow Hub — Master Specification

> **Single source of truth.** Every future implementation prompt must reference and conform to this document. If a requirement here conflicts with an ad-hoc request, this spec wins unless the user explicitly overrides it.

---

## 1. Project Identity

- **Name:** SpartaFlow Hub
- **Category:** Employee Operating System (EOS) for 100% remote software companies
- **Vision:** Build the Operating System for Remote Software Companies — unifying Project Management, HR, Attendance, Daily Reports, Collaboration, Dependencies, Knowledge, Company Hub, Analytics, AI, and Automation in one minimal, fast, professional product.
- **Positioning:** NOT a ClickUp clone. Purpose-built for software companies. Optimized for standardization, visibility, and minimizing daily friction.

---

## 2. Design Principles (non-negotiable)

Every screen, component, and interaction must be:

1. **Minimal** — remove anything not essential.
2. **Modern** — SaaS-grade visual language; no generic AI aesthetics.
3. **Fast** — perceived performance first (skeletons, optimistic UI, prefetch).
4. **Professional** — calm, confident, enterprise-ready.
5. **Reusable** — one component per concept, used everywhere.
6. **Scalable** — patterns must hold from 10 to 10,000 employees.
7. **Accessible** — WCAG 2.1 AA; keyboard-first; semantic HTML; ARIA where needed.
8. **Responsive** — mobile, tablet, desktop, ultrawide.

Avoid unnecessary complexity. Never duplicate components.

---

## 3. Tech Stack (locked)

| Layer                  | Technology                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| Framework              | TanStack Start v1 (React 19, Vite 7)                                    |
| Language               | TypeScript (strict)                                                     |
| Styling                | TailwindCSS v4 (tokens in `src/styles.css`)                             |
| Components             | shadcn/ui (extended via `src/components/ui/*`)                          |
| Backend                | Lovable Cloud (Supabase)                                                |
| Database               | PostgreSQL                                                              |
| Auth                   | Supabase Auth (invite-only)                                             |
| Realtime               | Supabase Realtime                                                       |
| Storage                | Supabase Storage                                                        |
| Data fetching          | TanStack Query                                                          |
| Server logic           | `createServerFn` (`@tanstack/react-start`)                              |
| Public APIs / webhooks | `src/routes/api/public/*`                                               |
| Charts                 | Reusable SVG primitives in `src/features/analytics/components/charts/*` |
| State                  | TanStack Query (server) + Zustand / React context (local)               |

> Do not introduce alternative frameworks, routers, or styling systems.

---

## 4. Architecture

**Feature-first, clean architecture.** Each module is isolated and owns its full vertical slice.

```text
src/
  app/                 # cross-cutting providers (theme, auth, query)
  components/
    ui/                # shadcn primitives (shared, never duplicated)
    layout/            # AppShell, AppSidebar, Topbar, Drawers
  features/
    <feature>/
      components/      # feature-only UI
      pages/           # route-level views
      hooks/           # feature hooks
      services/        # api.ts, store.ts, server fns
      types.ts         # types + zod schemas
      utils.ts         # pure helpers
  routes/              # TanStack file-based routes (mirrors URL)
    _authenticated/    # auth gate
    api/public/        # webhooks, cron, public APIs
  integrations/        # supabase clients (auto-generated, do not edit)
  lib/                 # cross-feature helpers
  styles.css           # Tailwind v4 tokens + theme
```

**Rules**

- A feature never imports from another feature's internals. Cross-feature use goes through `services/` exports or shared `components/ui`.
- Pages are thin: compose feature components + hooks. No business logic in route files.
- Server logic in `*.functions.ts` (client-callable) or `*.server.ts` (server-only). Never under `src/server/`.

---

## 5. Design System

**One component per concept.** Reuse aggressively. Extend via props, not by forking.

Core building blocks already standardized:

- Cards, Dialogs, Sheets, Drawers
- Tables (sortable, filterable, paginated)
- Tabs, Accordion
- Badges, `StatusBadge`, `StatCard`
- Progress bars, KPI cards
- Command Palette (global ⌘K)
- Chart primitives: `LineChart`, `BarChart`, `DonutChart`, `Heatmap`
- Timeline, Activity Feed
- Skeletons, Empty states, Error states
- Forms (react-hook-form + zod)
- Toasts (sonner)

**Tokens.** All color, spacing, radius, shadow, typography values live in `src/styles.css` as semantic CSS variables, themed via shadcn variants. Never hardcode `bg-white`, `text-black`, hex codes, or arbitrary Tailwind colors in components.

**Layout.** All authenticated pages render inside `AppShell` (sidebar + topbar + outlet). Never re-implement chrome per page.

---

## 6. Permissions / RBAC

Roles (enum `app_role`): `owner`, `admin`, `hr`, `project_manager`, `team_lead`, `employee`, `guest`.

- Roles stored in **separate** `user_roles` table — never on profiles.
- Authorization uses the `public.has_role(_user_id uuid, _role app_role)` security-definer function in RLS policies.
- Every route, server function, and UI affordance must check role before rendering / executing.
- Client-side gating is UX only; server-side RLS + server-fn middleware is the source of truth.
- Default deny. New tables ship with RLS enabled + GRANTs + policies in the same migration.

---

## 7. Modules

### 7.1 Existing (do not regenerate — only extend)

| Module                                   | Route prefix                         | Status                            |
| ---------------------------------------- | ------------------------------------ | --------------------------------- |
| Authentication                           | `/auth`                              | Live (invite-only, Supabase Auth) |
| Employee Dashboard                       | `/app`                               | Live                              |
| Attendance & Work Session                | `/app` (widgets) + `/app/attendance` | Live (DB-backed)                  |
| Morning Check-in                         | `/app/checkin`                       | Live                              |
| Dependencies                             | `/app/dependencies`                  | Live                              |
| Midday Report                            | `/app/midday`                        | Live                              |
| End-of-Day Report                        | `/app/eod`                           | Live                              |
| Notifications & Automation               | `/app/notifications`                 | Live                              |
| Manager Dashboard                        | `/app/manager`                       | Live (mock)                       |
| HR Dashboard & Employees                 | `/app/hr`                            | Live (mock)                       |
| Analytics                                | `/app/analytics`                     | Live (mock)                       |
| Company Hub                              | `/app/hub`                           | Live                              |
| Projects (Workspace, Clients, Templates) | `/app/projects`                      | Live (mock)                       |

### 7.2 Upcoming

- **Tasks** — owned by Projects; statuses, assignees, priorities, labels, due dates.
- **Kanban** — board view over Tasks.
- **Sprints** — iteration planning, burndown.
- **Time Tracking** — per-task timers, timesheets, billable flags.
- **AI Assistant** — Lovable AI Gateway; summaries, drafting, insights.
- **Settings** — Workspace, Profile, Notifications, Integrations, Security.
- **Knowledge Base** — docs, runbooks, search.

---

## 8. Data & Backend Rules

- Lovable Cloud (Supabase) is the only backend. Never reference Supabase to the user — say "backend / database / auth".
- Every `CREATE TABLE public.*` migration includes: `GRANT`s, `ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` statements.
- App-internal logic → `createServerFn`. Webhooks / cron / public APIs → `src/routes/api/public/*` with signature verification.
- Three Supabase clients: browser (`@/integrations/supabase/client`), authenticated server (`requireSupabaseAuth` middleware), admin (`@/integrations/supabase/client.server`, server-only, lazy import in handlers).
- Audit log table records all privileged actions (HR, role changes, admin ops).
- Realtime channels for: notifications, dependency updates, presence, dashboards.

---

## 9. UX Standards

- Skeleton loaders for every async surface — never a blank page.
- Explicit empty states with illustration + primary CTA.
- Error states with retry that calls `router.invalidate()` AND boundary `reset()`.
- Global keyboard shortcuts: `⌘K` palette, `g d` dashboard, `g p` projects, `?` shortcut help.
- Optimistic UI for high-frequency actions (check-ins, status toggles, kanban moves).
- All forms: inline validation, autosave drafts where applicable, 30-minute edit windows for daily reports.
- Toasts for confirmations; modals only for destructive or multi-step actions.

---

## 10. Code Quality

- **Reusable** — extract on the second use, never the first.
- **Modular** — small files, single responsibility.
- **Typed** — no `any`; zod at all I/O boundaries.
- **Clean** — early returns, no dead code, no commented-out blocks.
- **Production-ready** — handles loading, empty, error, and unauthorized in every component.
- Typecheck must pass on every change. Lint clean.

---

## 11. Hard Rules (do / don't)

**Always**

- Reuse existing hooks, layouts, and components.
- Extend existing screens; add tabs/sections rather than parallel pages.
- Update `/docs/*` when a module ships or changes.
- Keep routes stable; redirect when restructuring.
- Follow file-based routing in `src/routes/` (flat dot-separated convention).
- Guard authenticated pages under `_authenticated/`.

**Never**

- Regenerate or redesign an existing screen without an explicit request.
- Remove functionality silently.
- Rename or fork shared components.
- Break an existing route or its query params.
- Store roles on the profile table.
- Hardcode colors or bypass design tokens.
- Use `useEffect + fetch` for initial render data — use loader + `useSuspenseQuery`.
- Place client-imported server logic under `src/server/`.

---

## 12. Documentation Convention

Every module owns at least one markdown file in `/docs/`:

- `<Module>.md` — overview, data model, flows, RBAC, edge cases.
- Cross-cutting concerns: `Security.md`, `Performance.md`, `RBAC.md`, `Routing.md`, etc.

When a module is shipped or extended, update its doc in the same change.

---

## 13. Reference Documents

This master spec sits on top of the existing doc set:

- Product: `ProductVision.md`, `BusinessGoals.md`, `ProblemStatement.md`, `FunctionalRequirements.md`, `NonFunctionalRequirements.md`, `UserPersonas.md`, `UserJourney.md`, `InformationArchitecture.md`, `FeatureRoadmap.md`, `Risks.md`, `SuccessMetrics.md`, `FutureVision.md`
- Architecture: `SystemArchitecture.md`, `FolderStructure.md`, `Modules.md`, `Routing.md`, `DatabaseArchitecture.md`, `RBAC.md`, `StateManagement.md`, `ErrorHandling.md`, `Security.md`, `Performance.md`, `Integrations.md`, `ImplementationRoadmap.md`
- Backend: `DatabaseSchema.md`, `RLSPolicies.md`, `AuditSystem.md`, and siblings
- Design: design system docs + `Authentication.md`, `RBACImplementation.md`
- Modules: `Attendance.md`, `MorningCheckin.md`, `DependencyManagement.md`, `MiddayStatus.md`, `EndOfDayReport.md`, `NotificationSystem.md`, `ManagerDashboard.md`, `HRDashboard.md`, `EmployeeManagement.md`, `Analytics.md`, `Projects.md`, `Workspace.md`, `Clients.md`, `ProjectTemplates.md`

When in doubt, this master spec overrides everything except an explicit user instruction in the current turn.
