# Folder Structure — SpartaFlow Hub

> ⚠️ **ASPIRATIONAL — NOT THE ACTUAL STRUCTURE.** This document describes a
> **Next.js App Router + strict DDD** layout (`src/app/`, `src/shared/`,
> `src/domain/`, `src/infrastructure/`, `src/server/`) that was **never
> adopted**. The app is built on **TanStack Start** (`src/routes/`), not Next.js,
> and does not use the `domain/` / `shared/` / `server/` split shown here.
>
> **For the real, as-built folder structure, see
> [`ARCHITECTURE.md` §1](./ARCHITECTURE.md).** In particular:
>
> - Routes: `src/routes/` (TanStack Start file routes), **not** `src/app/`.
> - Data layers: top-level `src/repositories/` → `src/services/` → Supabase,
>   **not** per-feature `domain/application/infrastructure`.
> - Integrations: `src/integrations/<provider>/` (matches this doc's spirit).
> - No `src/shared/`, `src/domain/`, or `src/server/` folders exist.
>
> The DDD ideas below (feature slices, ports & adapters, import boundaries) remain
> useful as _aspirational guidance_; the concrete paths are inaccurate. Retained
> for reference and possible future migration. See `DOCUMENTATION_STATUS.md`.

---

A **feature-first, scalable** structure designed for multiple developers working in parallel without stepping on each other. Every folder has a single, well-defined responsibility.

---

## Top-Level Layout

```text
sparta-flow-hub/
├── docs/                       # Product + architecture documentation
├── public/                     # Static assets served as-is
├── supabase/                   # DB migrations, edge functions, seed
│   ├── migrations/
│   ├── functions/
│   └── seed/
├── scripts/                    # Repo-wide tooling (codegen, ci helpers)
├── tests/                      # E2E (Playwright) and integration tests
├── .github/                    # CI workflows, issue/PR templates
└── src/                        # Application source (detailed below)
```

---

## `src/` Layout

```text
src/
├── app/                        # Next.js App Router (routes only)
├── features/                   # Vertical feature slices (the heart of the app)
├── shared/                     # Cross-feature reusable code
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── providers/
│   ├── types/
│   ├── utils/
│   ├── config/
│   ├── lib/
│   ├── styles/
│   └── assets/
├── domain/                     # Shared domain kernel (IDs, enums, base entities)
├── infrastructure/             # Cross-cutting adapters (supabase, http, logger)
├── integrations/               # External system adapters (ClickUp, Slack, GitHub…)
├── server/                     # Server-only code (server actions, middlewares)
└── tests/                      # Co-located unit test utilities
```

---

## `src/app/` — Routing Only

Next.js App Router. **No business logic lives here.** Pages are thin shells that import from `features/*/ui`.

```text
app/
├── (public)/
│   ├── auth/
│   │   ├── sign-in/page.tsx
│   │   ├── sign-up/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   └── layout.tsx
├── (app)/                      # Authenticated layout (sidebar, topbar)
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── attendance/page.tsx
│   ├── workflow/
│   │   ├── morning/page.tsx
│   │   ├── midday/page.tsx
│   │   └── end-of-day/page.tsx
│   ├── dependencies/page.tsx
│   ├── announcements/page.tsx
│   ├── notifications/page.tsx
│   ├── directory/page.tsx
│   ├── reports/page.tsx
│   ├── team/[teamId]/page.tsx
│   ├── department/[deptId]/page.tsx
│   ├── hr/...
│   ├── admin/...
│   ├── owner/...
│   └── settings/...
├── api/                        # Route handlers (webhooks, BFF endpoints)
│   ├── webhooks/clickup/route.ts
│   ├── webhooks/github/route.ts
│   └── health/route.ts
├── error.tsx
├── not-found.tsx
└── layout.tsx                  # Root layout (providers, fonts)
```

---

## `src/features/` — Vertical Slices

Each feature is self-contained and exposes a small public API.

```text
features/
└── attendance/
    ├── domain/
    │   ├── entities/Attendance.ts
    │   ├── value-objects/WorkDay.ts
    │   ├── policies/LatePolicy.ts
    │   └── events/AttendanceEvents.ts
    ├── application/
    │   ├── use-cases/startWork.ts
    │   ├── use-cases/finishWork.ts
    │   ├── validators/attendanceSchemas.ts
    │   └── mappers/attendanceMapper.ts
    ├── infrastructure/
    │   ├── repositories/AttendanceRepository.ts
    │   ├── realtime/attendanceChannel.ts
    │   └── edge/attendanceFunctions.ts
    ├── ui/
    │   ├── screens/AttendanceScreen.tsx
    │   ├── components/AttendanceCard.tsx
    │   ├── hooks/useAttendance.ts
    │   └── forms/StartWorkForm.tsx
    ├── tests/
    └── index.ts                # Public API of the feature
```

Other feature folders follow the same pattern: `dashboard`, `workflow-morning`, `workflow-midday`, `workflow-eod`, `dependencies`, `notifications`, `announcements`, `reports`, `performance`, `directory`, `hr`, `admin`, `owner`, `settings`, `audit-logs`, `leaves`.

---

## `src/shared/` — Horizontal Reuse

| Folder        | Responsibility                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/` | Design-system primitives and composite UI used in ≥ 2 features (Button, Card, DataTable, EmptyState, ErrorState, LoadingSkeleton, Modal, Drawer, Tabs, CommandPalette, Sidebar, Topbar, Breadcrumb, Charts, Timeline…). |
| `hooks/`      | Framework-level hooks (`usePagination`, `useDebounce`, `useRealtimeChannel`, `useMediaQuery`, `useClipboard`).                                                                                                          |
| `services/`   | Cross-cutting services (logger, analytics, feature flags, toast service).                                                                                                                                               |
| `providers/`  | React context providers (Auth, QueryClient, Theme, Realtime, Toast, FeatureFlags).                                                                                                                                      |
| `types/`      | Global types, branded IDs (`UserId`, `TeamId`), enums (`Role`, `WorkflowStep`).                                                                                                                                         |
| `utils/`      | Pure helpers: `date`, `format`, `string`, `array`, `guards`, `result`.                                                                                                                                                  |
| `config/`     | Typed env loader, app constants, route map, RBAC matrix, feature flag defaults.                                                                                                                                         |
| `lib/`        | Third-party SDK wrappers (`supabase/client.ts`, `supabase/server.ts`, `sentry.ts`, `posthog.ts`).                                                                                                                       |
| `styles/`     | Tailwind config extensions, global CSS, design tokens.                                                                                                                                                                  |
| `assets/`     | Logos, icons, illustrations, fonts.                                                                                                                                                                                     |

---

## `src/domain/` — Shared Domain Kernel

Things shared across features at the domain level: branded IDs, base classes (`Entity`, `ValueObject`, `DomainEvent`), the event bus interface, and result types. **Zero framework dependencies.**

---

## `src/infrastructure/` — Cross-Cutting Adapters

Code that talks to the outside world but is not feature-specific:

```text
infrastructure/
├── supabase/
│   ├── client.ts               # browser client
│   ├── server.ts               # server client (RSC, route handlers)
│   ├── admin.ts                # service-role client (edge only)
│   └── realtime.ts             # channel factory + auth
├── http/
│   ├── fetcher.ts              # typed fetch wrapper
│   └── errors.ts
├── logger/
│   ├── client.ts
│   └── server.ts
├── notifications/
│   ├── dispatcher.ts
│   └── channels/{inApp,email,slack}.ts
├── storage/
│   └── uploads.ts
└── eventBus/
    └── index.ts
```

---

## `src/integrations/` — External Systems

One folder per external system. Each implements a `Port` interface defined by the feature that uses it.

```text
integrations/
├── clickup/
├── slack/
├── github/
├── gitlab/
├── google-calendar/
├── google-meet/
├── figma/
├── postman/
└── ai/
```

Each contains: `client.ts`, `mappers.ts`, `adapter.ts` (implements port), `webhooks/`, `README.md`.

---

## `src/server/` — Server-Only Code

```text
server/
├── actions/                    # Next.js server actions, grouped by feature
├── middlewares/                # Auth, RBAC, rate limit, correlation id
├── jobs/                       # Cron-style entry points triggered by Edge Functions
└── webhooks/                   # Webhook verification + dispatch
```

---

## `supabase/` — Database & Edge

```text
supabase/
├── migrations/                 # Timestamped SQL migrations (never edited)
├── functions/                  # One folder per Edge Function
│   ├── _shared/                # Shared utilities for edge functions
│   ├── set-claims/
│   ├── notify-dispatcher/
│   ├── clickup-sync/
│   └── reports-rollup/
├── policies/                   # Documentation of RLS policies per table
└── seed/                       # Seed data for dev/staging
```

---

## Naming Conventions

- Folders: `kebab-case`.
- Files exporting a React component: `PascalCase.tsx`.
- Files exporting a hook: `useThing.ts`.
- Files exporting a use-case: `verbNoun.ts` (e.g. `submitEndOfDayReport.ts`).
- Schemas: `*.schema.ts`. Types: `*.types.ts`. Constants: `*.constants.ts`.

## Import Rules (Enforced by ESLint)

1. `app/` may import from `features/*/ui` and `shared/`.
2. `features/<X>` may import from `shared/`, `domain/`, `infrastructure/`, `integrations/` — and from **its own** sub-folders.
3. `features/<X>` may **not** deep-import from `features/<Y>`. Use `features/<Y>` public `index.ts` only.
4. `domain/` may import only from `domain/`.
5. `shared/` may import from `domain/` only.
6. `integrations/` may import from `domain/` and `shared/lib/` only.

A custom ESLint boundary rule enforces these.
