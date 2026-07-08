# Testing Strategy

SpartaFlow follows the **test pyramid**: many fast unit tests, fewer integration
tests, a small set of end-to-end tests. Each layer has a clear home, tool, and
purpose, so a change is tested at the cheapest level that can catch its bugs.

```
        ╱‾‾‾‾‾‾╲     E2E — Playwright · real browser + real app · few, high-value
       ╱ E2E    ╲
      ╱──────────╲   Integration — Vitest + RTL (jsdom) · units wired together
     ╱ Integration ╲
    ╱────────────────╲ Unit — Vitest (node) · pure functions/rules · the majority
   ╱      Unit        ╲
  ╱────────────────────╲
```

| Layer                       | Tool                           | Env          | Location                                                          | Runs                     |
| --------------------------- | ------------------------------ | ------------ | ----------------------------------------------------------------- | ------------------------ |
| **Unit**                    | Vitest                         | `node`       | `src/**/*.test.ts` (co-located)                                   | `npm run test:unit`      |
| **Component / Integration** | Vitest + React Testing Library | `jsdom`      | `tests/component/**`, `tests/integration/**`, `src/**/*.test.tsx` | `npm run test:component` |
| **E2E**                     | Playwright                     | real browser | `tests/e2e/*.spec.ts`                                             | `npm run test:e2e`       |

`npm test` runs both Vitest projects (unit + component). E2E is separate
because it needs a running app and browser binaries.

---

## 1. Commands

```bash
npm test                 # all Vitest tests (unit + component/integration)
npm run test:unit        # just the node/unit project
npm run test:component   # just the jsdom/component project
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright (starts the app automatically)
npm run test:e2e:ui      # Playwright interactive UI mode
npm run typecheck        # tsc — the cheapest test of all
```

First E2E run only: `npx playwright install` to download the browsers.

---

## 2. Layout

```
vitest.config.ts          Two projects: unit (node) + component (jsdom)
playwright.config.ts      E2E runner; auto-starts the app via webServer

tests/
├─ setup/vitest.setup.ts  jest-dom matchers, RTL cleanup, matchMedia stub
├─ utils/render.tsx       renderWithProviders / TestProviders / makeTestQueryClient
├─ component/             RTL component tests               (*.test.tsx)
├─ integration/           multi-unit / provider-backed tests (*.test.tsx)
└─ e2e/                   Playwright specs                  (*.spec.ts)

src/**/*.test.ts          Unit tests, co-located with the code they cover
```

**Naming keeps the runners from colliding:** Vitest collects only
`*.test.ts[x]`; Playwright collects only `*.spec.ts`. So E2E specs are never
picked up by Vitest and vice-versa.

---

## 3. Unit tests — Vitest (node)

The base of the pyramid and where most tests belong: **pure functions and
business rules** with no DOM, network, or React. They're fast, deterministic,
and co-located with the module (`rules.ts` → `rules.test.ts`).

Good targets: `services/**/rules.ts`, `kpi-calculators.ts`, `features/*/utils.ts`,
`lib/logging/redact.ts`, `lib/errors.ts`, permission logic.

Example — [`src/features/tasks/utils.test.ts`](../src/features/tasks/utils.test.ts):

```ts
import { describe, expect, it, vi } from "vitest";
import { checklistProgress, isOverdue } from "./utils";

it("computes done/total and a rounded percentage", () => {
  const t = task({ checklist: [done, done, open] });
  expect(checklistProgress(t)).toEqual({ done: 2, total: 3, pct: 67 });
});

it("is true when the due date has passed and the task is open", () => {
  vi.setSystemTime(new Date("2026-07-02T12:00:00Z")); // deterministic clock
  expect(isOverdue(task({ dueDate: "2026-07-01T00:00:00Z", status: "in_progress" }))).toBe(true);
});
```

Conventions: one module under test per file; `vi.setSystemTime` for anything
time-dependent (never rely on the wall clock); build minimal fixtures with a
local factory rather than importing seed data.

---

## 4. Component tests — Vitest + React Testing Library (jsdom)

Render a component and assert on its **accessible output** (roles, names, text)
— not class names or internal state. Query by role/label so tests double as an
accessibility check and survive refactors.

Example — [`tests/component/status-badge.test.tsx`](../tests/component/status-badge.test.tsx):

```tsx
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/status-badge";

it("renders the label for a known status", () => {
  render(<StatusBadge status="working" />);
  const badge = screen.getByRole("status");
  expect(badge).toHaveTextContent("Working");
  expect(badge).toHaveAttribute("aria-label", "Working");
});
```

For user interaction use `userEvent` (from the harness), e.g.
`await user.click(screen.getByRole("button", { name: /save/i }))`.

Priorities for queries: `getByRole` > `getByLabelText` > `getByText` >
`getByTestId` (last resort). Prefer `findBy*`/`waitFor` over manual timers for
async UI.

---

## 5. Integration tests — Vitest + RTL + providers

Prove that **several units work together**: a component/hook + its providers +
a service. Two patterns, both real examples:

**a) Real components + events** —
[`tests/integration/connection-banner.test.tsx`](../tests/integration/connection-banner.test.tsx)
renders the actual `ConnectionBanner`, drives the browser `offline`/`online`
events, and asserts the banner appears and clears. Nothing mocked.

**b) Data layer through a provider** —
[`tests/integration/query-hook.test.tsx`](../tests/integration/query-hook.test.tsx)
renders a `useQuery` hook inside `TestProviders` (a `QueryClientProvider`) and
swaps the _service_ for a `vi.fn()`, asserting the loading → success and error
lifecycles:

```tsx
const listEmployees = vi.fn().mockResolvedValue([{ id: "1", name: "Ada" }]);
const { result } = renderHook(() => useEmployees(listEmployees), { wrapper: TestProviders });

expect(result.current.isPending).toBe(true);
await waitFor(() => expect(result.current.isSuccess).toBe(true));
expect(result.current.data).toHaveLength(1);
```

**The harness** ([`tests/utils/render.tsx`](../tests/utils/render.tsx)) exposes
`renderWithProviders(ui)` → `{ ...rtl, user, queryClient }` and a
`makeTestQueryClient()` with retries **off** and zero cache time, so each test
is isolated and error paths resolve immediately. Mock at the **service boundary**
(`vi.fn()` / `vi.mock("@/services/...")`), never Supabase directly — this mirrors
the app rule that components talk to services, not the DB (CLAUDE.md).

---

## 6. E2E tests — Playwright

The top of the pyramid: the **real app in a real browser**, no mocks. Keep these
few and high-value (critical journeys, guard/redirect behavior) — they're the
slowest and most brittle layer. `playwright.config.ts` auto-starts the app
(`webServer: npm run dev`) and Chromium is enabled by default (Firefox/WebKit
are one uncomment away).

Example — [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts):

```ts
test("redirects an unauthenticated user away from a protected route", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
```

[`tests/e2e/auth.spec.ts`](../tests/e2e/auth.spec.ts) drives the sign-in form
(empty-submit validation, invalid-credentials message) using the same
role/label queries as component tests.

**Config knobs:** `PLAYWRIGHT_BASE_URL` points at an already-running server (skip
`webServer`); the default is `http://localhost:5173` — adjust if your dev server
uses another port. Traces are captured on first retry, screenshots on failure.

### Authenticated E2E (pattern, not yet implemented)

Flows behind auth shouldn't log in through the UI every test. The standard
approach: a global-setup project signs in once against a **seeded test user**,
saves cookies/localStorage via `storageState`, and other projects reuse it. Wire
this when a test Supabase project + seed user exist; until then E2E covers the
public/guard surface only.

---

## 7. What to test where

| You changed…                                          | Test at…        |
| ----------------------------------------------------- | --------------- |
| A pure rule / calculation / util                      | **Unit**        |
| A presentational component's output or a11y           | **Component**   |
| A hook + provider, or component + service wiring      | **Integration** |
| A critical user journey, routing/guard, or full stack | **E2E**         |

Push each test as far **down** the pyramid as it can go: if a bug is catchable
by a unit test, don't reach for an integration or E2E test to find it.

---

## 8. Conventions

- **Deterministic**: fake the clock (`vi.setSystemTime`), seed randomness, never
  depend on real network/time. `makeTestQueryClient` disables retries.
- **Isolated**: fresh QueryClient per test; RTL `cleanup` runs automatically
  (setup file). No shared mutable state between tests.
- **Accessible-first queries**: `getByRole`/`getByLabelText` over test ids.
- **Mock at boundaries**: services, not Supabase; `fetch`/transport, not internals.
- **Redaction/security** logic (`lib/logging`, `lib/security`) always has unit
  tests — see the existing suites there.

---

## 9. Scope note

This document + the committed examples establish the **structure and patterns**,
not exhaustive coverage. Existing unit suites already cover the core domain
rules (attendance, KPIs, notifications, permissions, security, logging). Grow
component/integration/E2E coverage feature-by-feature using these examples as
templates.

---

_Last updated: 2026-07-02._
