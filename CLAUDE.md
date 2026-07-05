# SpartaFlow

## Mission

SpartaFlow is an Operating System for Remote Software Companies.

The platform includes:

- Authentication
- HR
- Attendance
- Daily Reports
- Company Hub
- Workspace
- Projects
- Tasks
- Kanban
- Sprint Management
- Time Tracking
- Files
- Comments
- Analytics
- AI Assistant
- Integrations
- Owner Dashboard

---

## Tech Stack

React

TypeScript

Vite

TailwindCSS

shadcn/ui

Supabase

TanStack Start (SSR) — file-based routing via TanStack Router

TanStack Query

Vitest + React Testing Library + Playwright (testing)

---

## Coding Principles

- Never regenerate completed modules.
- Always extend existing code.
- Search existing implementation before creating new files.
- Prefer composition over duplication.
- Reuse components.
- Reuse hooks.
- Reuse services.
- Reuse types.

---

## Architecture Rules

Feature-first UI over a layered data backbone.

Feature slices (`src/features/<name>/`) own the UI and contain, as needed:

- components
- hooks
- types
- utils
- store.ts / mock-data.ts (mock-backed features)
- api.ts / queries.ts (live features)

Cross-cutting layers live at the top level, not per-feature:

- `src/routes/` — TanStack Start file-based routes (the "pages")
- `src/repositories/` — domain-facing data API (aggregate reads, lifecycle verbs)
- `src/services/` — service classes over one table/RPC (extend `BaseService`)
- `src/integrations/` — external-system adapters (ports & adapters)
- `src/ai/` — provider-agnostic AI subsystem
- `src/lib/` — errors, logging, security, supabase, theme, utils

Data-access rule of thumb: components/hooks → repositories → services →
Supabase. Never skip straight to Supabase from a component.

See `docs/ARCHITECTURE.md` for the as-built map and `docs/DOCUMENTATION_STATUS.md`
for doc accuracy.

---

## UI Rules

Always use existing:

- Button
- Card
- Dialog
- Sheet
- Table
- Badge
- Avatar
- Tabs

Never create duplicate UI components.

---

## State Management

Prefer:

React Context

TanStack Query

Local State

Do not introduce Redux or other state libraries without approval.

---

## API Rules

All external communication must go through the service layer (`src/services`,
`BaseService` subclasses). The domain entry point for hooks/components is the
repository layer (`src/repositories`), which composes services.

Components must never call APIs (or Supabase) directly.

Errors surface as `ServiceError`; report via `@/lib/errors` and log via
`@/lib/logging`.

---

## Database

Supabase PostgreSQL.

Use UUIDs.

Use RLS.

Never expose service keys.

---

## Security

RBAC required.

Audit important actions.

Validate all inputs.

---

## Performance

Lazy load routes.

Memoize expensive components.

Virtualize long lists.

Avoid unnecessary renders.

---

## Code Style

Small components.

Strict TypeScript.

Reusable utilities.

Readable naming.

No any types.

---

## Before Every Task

Claude must:

1. Read CLAUDE.md
2. Search existing implementation
3. Reuse existing code
4. Implement incrementally
5. Run type checks mentally
6. Keep documentation updated
