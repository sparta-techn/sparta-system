# Error Handling — SpartaFlow Hub

A unified error model spans client, server, and database. Every error is **typed**, **mapped to a user-friendly message**, **logged with correlation ID**, and **observable**.

---

## 1. Error Taxonomy

| Category | Source | Examples |
|---|---|---|
| **Validation** | Zod, client + server | Missing fields, bad date range. |
| **Authentication** | Supabase Auth | Expired session, MFA required, invalid credentials. |
| **Authorization** | Server + RLS | Insufficient permission, scope mismatch. |
| **Domain** | Application use-cases | "Cannot finish work before starting", "Leave overlaps existing approved leave". |
| **Conflict** | DB constraints | Duplicate attendance, optimistic concurrency. |
| **Network** | fetch, Realtime | Timeout, offline, 5xx. |
| **Integration** | ClickUp/Slack/etc. | Rate limited, invalid token, schema mismatch. |
| **Infrastructure** | Postgres, Storage | Connection error, quota exceeded. |
| **Unknown** | Anything uncaught | Rendering errors, unexpected exceptions. |

---

## 2. Canonical Error Shape

```text
AppError {
  code:       string   // stable machine code, e.g. "attendance.duplicate"
  category:   ErrorCategory
  message:    string   // developer message (English)
  userMessage:string   // translated, user-friendly
  hint?:      string   // optional next step
  status?:    number   // HTTP-equivalent
  cause?:     unknown  // original error
  correlationId: string
  retryable:  boolean
}
```

All thrown errors are normalized by `toAppError(err)` at the boundary before being logged or displayed.

---

## 3. Validation Errors

- **Client:** Zod resolvers surface field errors inline. Form-level errors shown above the submit button.
- **Server:** Re-validate with the same Zod schema; respond with `400` + field map.
- **UX:** Never block submit silently. Submit button stays enabled until first attempt, then disables only while pending.

---

## 4. Authentication Errors

- Expired session → silent refresh attempt → if refresh fails, redirect to `/auth/sign-in?reason=expired&next=...`.
- MFA required → redirect to `/auth/mfa?next=...`.
- Invalid credentials → inline form error, generic message ("Email or password incorrect") to avoid account enumeration.
- Rate limited → exponential backoff message ("Try again in N seconds").

---

## 5. Authorization Errors

- Server returns `403` with `code: 'auth.forbidden'`.
- UI shows a 403 screen with: what they tried, why blocked, and "Request access" CTA (creates a request to HR/Admin).
- RLS denials surface as empty result sets — UI distinguishes "no data" from "no access" via the server response, not by inspecting RLS internals.

---

## 6. Domain Errors

- Each use-case throws typed `DomainError` subclasses (e.g. `AttendanceAlreadyStarted`).
- Mapped to user-friendly messages via a per-feature `errorMessages.ts`.
- Surface as inline form errors or toasts, never as crashes.

---

## 7. Network & Realtime Errors

- Retried automatically: GET requests (max 3, exponential backoff with jitter), Realtime reconnect with backoff.
- Not retried automatically: non-idempotent writes; user is offered a "Retry" toast action.
- Offline detected via `navigator.onLine` + failed pings; a global banner appears.
- Realtime disconnect > 30s shows a subtle "Live updates paused" banner; reconnect clears it and triggers a refetch.

---

## 8. Integration Errors

- Each integration adapter normalizes errors into `IntegrationError { provider, code, retryable, ... }`.
- Outbound calls have per-provider circuit breakers; opening a breaker disables the feature visually with a clear status.
- Webhook failures persisted in `integration_events` for replay.

---

## 9. Database Errors

- Unique violations → typed conflict errors (e.g. `attendance.duplicate`).
- Constraint violations → mapped to domain errors when possible, generic otherwise.
- Connection errors → retry once; if still failing, return 503 with a clear "Service temporarily unavailable" UX.

---

## 10. Unknown Errors

- Global React error boundary catches render errors → shows a recoverable error screen ("Something went wrong. Reload or report.").
- Server actions wrap handlers in `withErrorHandler` to ensure no raw exception leaks.
- Edge Functions wrap entrypoints with a `safeHandler` returning a structured error response.

---

## 11. User-Friendly Messages

Principles:
- Plain language; no stack traces, no codes (codes shown only on a "Details" toggle).
- Explain what happened, what they can do, and where to go next.
- Never blame the user ("You did X wrong" → "X isn't available because Y").
- Include a "Copy details" action on error screens for support handoff (includes correlation ID, no PII).

---

## 12. Retry Strategy

| Operation | Auto-retry | Manual retry UI |
|---|---|---|
| Idempotent reads | yes (3x, backoff) | yes |
| Idempotent writes with idempotency key | yes (1x) | yes |
| Non-idempotent writes | no | yes ("Try again") |
| Webhook delivery | yes (queue, exponential) | replay via admin |
| Realtime reconnect | yes (backoff, capped) | manual reload offered after long disconnect |

---

## 13. Observability Hooks

- Every error is logged with `correlationId`, `userId` (if available), `feature`, `category`, `code`.
- Errors with `severity ≥ warning` are reported to Sentry with breadcrumbs.
- A daily "error budget" review is part of the engineering ritual.
- Per-feature dashboards: error rate, retry rate, top error codes.

---

## 14. Boundaries

- **Global ErrorBoundary** wraps the app root.
- **Route ErrorBoundary** (`app/error.tsx`) handles route-level errors.
- **Feature ErrorBoundary** wraps each feature screen.
- **Widget ErrorBoundary** wraps individually streamed widgets so one widget can fail without taking down the dashboard.

---

## 15. Testing

- Every Zod schema has unit tests for boundary cases.
- Each use-case has a "happy + 2 error" tests.
- E2E tests cover: expired session, 403, offline, optimistic rollback, retry success.
