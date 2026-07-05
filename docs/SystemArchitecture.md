# System Architecture — SpartaFlow Hub

> Architecture blueprint for the Employee Operating System (EOS) of SpartaFlow.
> This document describes **how** the system is structured. It does not implement features.

---

## 1. Architectural Style

SpartaFlow Hub follows a **modular, feature-first, layered architecture** on top of a managed Backend-as-a-Service (Supabase). It blends:

- **Clean Architecture** — strict dependency direction: UI → Application → Domain → Infrastructure.
- **Feature-Based Architecture** — vertical slices per domain (attendance, dependencies, reports…) instead of horizontal "components/services" piles.
- **Hexagonal (Ports & Adapters)** — every external system (ClickUp, Slack, GitHub, Email, AI) is reached through a port; adapters live at the edges.
- **CQRS-lite** — reads and writes are separated at the query-layer level (TanStack Query keys vs. mutation handlers) without a full event-sourcing model.
- **Event-driven extensions** — domain events (dependency.created, report.submitted, attendance.late) are emitted to enable integrations and notifications without coupling.

---

## 2. High-Level Topology

```text
 ┌───────────────────────────────────────────────────────────────┐
 │                         Browser (Client)                       │
 │  Next.js App Router · React · TanStack Query · Realtime Client │
 └──────────────▲───────────────────────────────▲─────────────────┘
                │ HTTPS / WSS                   │ Realtime channel
                │                               │
 ┌──────────────┴───────────────┐   ┌───────────┴────────────────┐
 │   Next.js Server (RSC + API) │   │   Supabase Realtime         │
 │   - Server Actions           │   │   - Postgres CDC            │
 │   - Route Handlers           │   │   - Presence / Broadcast    │
 │   - Middleware (auth, RBAC)  │   └─────────────────────────────┘
 └──────────────┬───────────────┘
                │
 ┌──────────────┴───────────────────────────────────────────────┐
 │                         Supabase Platform                     │
 │  Auth · PostgreSQL (RLS) · Storage · Edge Functions · Vault   │
 └──────────────┬───────────────────────────────────────────────┘
                │
 ┌──────────────┴───────────────────────────────────────────────┐
 │              Integration Layer (Adapters / Workers)           │
 │  ClickUp · Slack · GitHub · Google Calendar · Figma · AI      │
 └──────────────────────────────────────────────────────────────┘
```

---

## 3. Layered Architecture

Each feature is internally organized into four layers. Dependencies flow **inward only**.

| Layer | Responsibility | Examples |
|---|---|---|
| **Presentation** | UI rendering, user interaction, accessibility. No business rules. | Pages, screens, shadcn components, forms. |
| **Application** | Use-cases, orchestration, validation, mapping DTOs. | `submitEndOfDayReport`, `acknowledgeDependency`. |
| **Domain** | Pure business rules, entities, invariants, policies. | `Attendance` entity, "late after 10:00" rule, RBAC policies. |
| **Infrastructure** | I/O: Supabase queries, Edge Functions, integrations, storage, email. | Repositories, integration adapters, realtime channels. |

Rules:
- Presentation never imports Infrastructure directly — it calls Application services.
- Domain has zero external dependencies (no Supabase, no React).
- Infrastructure implements interfaces (ports) defined in Domain/Application.

---

## 4. Feature Architecture (Vertical Slice)

Every feature module owns its full vertical:

```text
features/attendance/
  domain/         # entities, value objects, policies
  application/    # use-cases, validators (Zod), mappers
  infrastructure/ # supabase repos, edge fn calls, realtime
  ui/             # screens, components, hooks
  index.ts        # public API of the feature
```

Cross-feature communication happens **only** via:
1. Public API (`index.ts`) of the feature.
2. Domain events on the in-app event bus.
3. Shared kernel (types, IDs, enums) under `shared/`.

This prevents the typical "everything imports everything" decay.

---

## 5. Shared Modules

`shared/` contains horizontal capabilities used by ≥ 2 features. Anything used by only one feature stays inside that feature.

- `shared/components` — design-system primitives (Button, Card, DataTable, EmptyState…).
- `shared/hooks` — generic hooks (`usePagination`, `useDebounce`, `useRealtimeChannel`).
- `shared/services` — cross-cutting services (logger, analytics, feature flags).
- `shared/providers` — React providers (Theme, QueryClient, Auth, Realtime, Toast).
- `shared/types` — global types, branded IDs, enums.
- `shared/utils` — pure helpers (date, format, guards).
- `shared/config` — environment, constants, route map, RBAC matrix.
- `shared/lib` — third-party SDK wrappers (supabase client, posthog, sentry).

---

## 6. Data Flow

**Read path (query):**
```
Component → useFeatureQuery() → Application service → Repository (Supabase) → Postgres (RLS) → DTO → Domain mapper → Component
```

**Write path (mutation):**
```
Component → useFeatureMutation() → Zod validation → Application use-case → Domain rules → Repository → Postgres → Domain event → (Realtime + Notification + Integration adapters)
```

- All reads are cached in TanStack Query, keyed by `[feature, entity, params]`.
- All writes go through a single mutation pipeline that handles validation, optimistic updates, error translation, and cache invalidation.

---

## 7. Authentication Flow

1. User signs in via Supabase Auth (Email/Password or Google SSO).
2. Supabase issues a JWT containing `sub`, `email`, and custom claims (`role`, `department_id`).
3. Next.js middleware verifies the session on every request; unauthenticated requests are redirected to `/auth`.
4. Server Components read the session via the Supabase server client.
5. Client Components consume an `AuthProvider` that mirrors the session and subscribes to `onAuthStateChange`.
6. JWT custom claims are populated by an Edge Function `on_auth_user_created` and a `set_claims` trigger that reads from `user_roles`.
7. MFA is enforced for Owner and HR via Supabase Auth factors.

**Session model:** httpOnly cookie storage on the server side, in-memory mirror on the client. No tokens in `localStorage` for protected APIs.

---

## 8. State Management Strategy

See `StateManagement.md` for detail. In short:

- **Server state** → TanStack Query (single source of truth for any data from Supabase).
- **Realtime state** → TanStack Query cache, updated via Realtime subscriptions and `queryClient.setQueryData`.
- **Local UI state** → `useState` / `useReducer`.
- **Cross-feature ephemeral state** → Zustand slices (e.g. command palette, sidebar collapse).
- **Form state** → React Hook Form + Zod resolvers.
- **URL state** → `searchParams` for filters, pagination, tabs — the URL is canonical.

Global Redux-style stores are explicitly avoided.

---

## 9. API Communication

Three communication channels, each with a clear purpose:

| Channel | Used for |
|---|---|
| **Supabase JS Client (RLS-scoped)** | Standard CRUD as the signed-in user. |
| **Edge Functions** | Privileged work, cross-table transactions, integrations, scheduled jobs, webhooks. |
| **Next.js Route Handlers / Server Actions** | BFF for SSR data, webhook receivers, AI streaming endpoints. |

Conventions:
- All payloads validated with Zod on both client and server.
- All responses follow `{ data, error, meta }` envelope.
- Idempotency keys on attendance and report mutations to prevent duplicates on retry.
- Pagination is cursor-based; filters and sort are explicit query params.

---

## 10. Error Handling Strategy

A single, layered error model (full detail in `ErrorHandling.md`):

- **Domain errors** — typed (`LateArrivalNotAllowed`, `DependencyAlreadyResolved`).
- **Application errors** — validation, authorization, conflict.
- **Infrastructure errors** — network, database, integration timeouts.
- **Unknown errors** — captured by global boundaries.

Every error is normalized to `AppError { code, message, hint?, cause? }`, logged with correlation ID, mapped to a user-friendly toast or screen, and reported to Sentry when severity ≥ warning.

---

## 11. Logging Strategy

- **Client:** structured logs via wrapper around `console` in dev, Sentry breadcrumbs + PostHog events in prod.
- **Server / Edge Functions:** structured JSON logs (`level`, `event`, `correlation_id`, `user_id`, `feature`).
- **Audit log:** persisted in `audit_logs` table for sensitive actions (role change, attendance override, leave approval, integration token rotation).
- **No PII in logs** beyond `user_id`. Emails, names, report content are never logged.

Every request carries a `x-correlation-id` header propagated to Edge Functions and integrations.

---

## 12. File Upload Strategy

- Storage = Supabase Storage with per-bucket policies.
- Buckets: `avatars` (public-read, owner-write), `announcements` (auth-read, HR-write), `reports` (private, owner+manager read).
- Uploads use **signed URLs** generated by an Edge Function after MIME / size validation.
- Client uploads directly to Storage; metadata row is created in `attachments` table after successful upload.
- Anti-virus / MIME sniffing performed in the Edge Function before issuing the signed URL.

---

## 13. Notification Architecture

Notifications are a first-class subsystem, not ad-hoc emails.

```text
Domain Event ──► Notification Dispatcher ──► Channels
                                      ├── In-App (notifications table + Realtime)
                                      ├── Email (Resend / SES via Edge Function)
                                      ├── Slack (adapter)
                                      └── Push (future, PWA)
```

- Each event type has a `NotificationTemplate` with rendering per channel.
- Per-user preferences stored in `notification_preferences`.
- Delivery is async via Edge Function queue; failures retried with exponential backoff and dead-letter table.
- Read state tracked per-channel per-user.

---

## 14. Realtime Architecture

- Supabase Realtime channels per scope: `team:{id}`, `department:{id}`, `user:{id}`, `company`.
- Postgres CDC drives changes for attendance, dependencies, reports, announcements.
- Presence channels track "who is currently online" for live team boards.
- Client subscribes only to channels the user has access to (enforced by RLS-aware channel auth).
- All realtime updates flow into TanStack Query cache via a single `applyRealtimePatch` reducer to keep cache coherent.

---

## 15. Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Configuration | `shared/config` reads typed env at boot; missing vars fail fast. |
| Feature flags | `feature_flags` table + `useFeatureFlag` hook; flags resolved server-side. |
| i18n | Architecture supports it via `next-intl` even if launch is English-only. |
| Time & timezone | All timestamps stored UTC; rendered in user timezone from profile. |
| Accessibility | Enforced at the design-system level; every primitive is keyboard- and screen-reader-friendly. |
| Observability | Sentry (errors), PostHog (product analytics), Supabase logs (DB), custom metrics endpoint. |

---

## 16. Deployment Topology

- **Frontend** — Vercel (Next.js Edge + Node runtimes).
- **Backend** — Supabase managed project (Postgres, Auth, Storage, Edge Functions, Realtime).
- **Integrations** — Supabase Edge Functions (lightweight) + dedicated worker on Fly.io/Render for long-running sync jobs (ClickUp, GitHub).
- **Secrets** — Supabase Vault and Vercel encrypted env; never in repo.
- **Environments** — `local`, `dev`, `staging`, `production`, each on its own Supabase project.

---

## 17. Architectural Invariants

These rules do not change as the system grows:

1. ClickUp owns tasks. SpartaFlow Hub does not.
2. The daily flow stays under 2 minutes — any architectural decision that adds friction is rejected.
3. RLS is the last line of defense; UI hiding is never the only protection.
4. Every cross-feature dependency goes through a public API or an event — never a deep import.
5. The Domain layer has zero framework dependencies.
6. Every external system is behind an adapter; swapping ClickUp for Linear must not touch business logic.
