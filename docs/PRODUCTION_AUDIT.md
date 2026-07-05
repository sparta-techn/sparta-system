# SpartaFlow — Production Readiness Audit

> **Scope:** Full-codebase audit against the standards in `CLAUDE.md` and the
> as-built snapshot in `docs/ARCHITECTURE.md`.
> **Method:** Static review only — no code was modified. TypeScript `tsc --noEmit`
> was run (passes clean) and the source tree, migrations, and config were inspected.
> **Date:** 2026-07-02
> **Verdict:** **Not production-ready.** The product is a *frontend-complete
> prototype*. Only **Auth** and **Attendance** are wired to live Supabase; most
> features read/write in-browser `localStorage` mock stores. There are also three
> overlapping, largely un-wired data-access layers. Ship-blockers are concentrated
> in **backend integration, security, and validation**.

---

## Summary Scorecard

| Area | Status | Notes |
| --- | --- | --- |
| Folder structure | ⚠️ Fair | Feature-first is followed, but 3 parallel data layers + doc drift create confusion |
| Architecture | ❌ Blocker | Most features mock-backed; `services`/`repositories`/`store.ts` coexist and overlap |
| Security | ❌ Blocker | `.env` not git-ignored; AI keys in `localStorage`; `javascript:` link XSS |
| Performance | ⚠️ Fair | No route lazy-loading, no list virtualization; sparse memoization |
| Error handling | ⚠️ Fair | `states` + error boundary exist; inconsistent usage; vendor-coupled reporting |
| TypeScript | ⚠️ Fair | `tsc` passes, but service layer casts away types; 61 `any`; lax compiler flags |
| Accessibility | ⚠️ Fair | Radix gives a baseline (~55% files use aria/role); no audit performed |
| Responsiveness | ✅ OK | Tailwind + `use-mobile`; sidebar/shell responsive |
| Scalability | ⚠️ Fair | `localStorage` source-of-truth doesn't scale; untyped generic CRUD |
| Documentation | ⚠️ Fair | 139 docs; overlapping/stale; `ARCHITECTURE.md` omits whole trees |

**Findings:** 3 Critical · 4 High · 6 Medium · 5 Low

---

## CRITICAL

### C-1 — Data is mock-backed; app is a prototype, not a product
**Category:** Architecture / Scalability
Most features persist to browser `localStorage`, not Supabase. `store.ts` files are
imported in **87** places; only `auth` and `attendance` use the live backend
(`api.ts`/`queries.ts`). Data does not survive across devices/browsers, is not
multi-user, has no server enforcement, and every user sees only their own seeded
mock state. This is the single largest gap and is called out in `ARCHITECTURE.md §15`.
**Impact:** Not deployable as a real SaaS. No data integrity, no cross-user
collaboration, no server-side authority.
**Recommendation:** Execute the `ARCHITECTURE.md §15` sequence — collapse to one
data contract (`api.ts` + `queries.ts` per feature), replace each `store.ts`
read/write with a Supabase query/mutation, and land the remaining schema. Track
per-feature migration status.

### C-2 — `.env` is committed-eligible (not git-ignored)
**Category:** Security
`.gitignore` ignores `*.local` and `.dev.vars` but **not `.env`**, and a populated
`.env` exists at repo root (`SUPABASE_*`, `VITE_SUPABASE_*`). The workspace is not
currently a git repo, but it is Lovable-synced and any `git init && add .` will
commit secrets. Even though `VITE_SUPABASE_PUBLISHABLE_KEY` is public by design, the
same file is the natural home for `SUPABASE_SERVICE_ROLE_KEY` — a full RLS bypass — and
committing it would be catastrophic.
**Impact:** High risk of secret leakage into version control / Lovable history.
**Recommendation:** Add `.env` and `.env.*` (allow `!.env.example`) to `.gitignore`
now. Provide `.env.example` with empty values. Confirm no secret was ever synced;
rotate keys if in doubt. Never place the service-role key in a `VITE_`-prefixed var.

### C-3 — AI provider API keys stored in browser `localStorage`
**Category:** Security
`src/features/ai-settings/secure-store.ts` persists provider API keys to
`localStorage` in plaintext (`getApiKey` returns the raw key). The file itself
documents the limitation. Any XSS (see H-3), malicious dependency, or browser
extension can exfiltrate them. Today this is *latent* only because the providers
(`src/ai/providers/*`) are `notImplemented` placeholders — the moment they call a
vendor API from the browser, real keys are exposed on the wire and at rest.
**Impact:** Credential theft; attacker-run inference billed to the customer.
**Recommendation:** Never hold third-party API keys client-side. Store provider
secrets server-side (Supabase vault / server env) and proxy AI calls through
authenticated server functions (`requireSupabaseAuth` already exists). Remove
`secure-store.ts` before wiring any real provider.

---

## HIGH

### H-1 — Service layer casts away all schema type-safety
**Category:** TypeScript / Architecture
`src/services/core/client.ts` exports `db = supabase as unknown as SupabaseClient`,
and `BaseService` performs unchecked `as unknown as Row` casts on every read/write.
Reason given: target tables "are not yet present in the generated `Database` types."
So the entire generic CRUD layer (82 service files) operates **untyped** against the
schema — column typos and shape drift compile cleanly and fail at runtime.
**Impact:** Silent data bugs; the "Strict TypeScript / No any" standard is
effectively bypassed for all persistence.
**Recommendation:** Regenerate `integrations/supabase/types.ts` from the live schema
after each migration (the migrations already define these tables), then delete the
relaxed `db` view and let `BaseService` use the typed client.

### H-2 — No input validation on write paths
**Category:** Security / Error handling
`CLAUDE.md` mandates "Validate all inputs," yet **zero** `zod` usage exists in
`src/services/**`. `BaseService.create/update/upsert` forward caller input straight
to Supabase. Validation exists only for auth/AI-settings forms.
**Impact:** Malformed/oversized/unexpected data reaches the DB; relies solely on
Postgres constraints and RLS. No friendly, centralized error surface.
**Recommendation:** Define a `zod` schema per entity and validate at the service
mutation boundary before persistence (parse-then-persist). Reuse form schemas.

### H-3 — Markdown renderer allows `javascript:` (and arbitrary) link hrefs
**Category:** Security
`src/features/ai/components/markdown.tsx:56` renders `href={linkMatch[2]}` from
parsed markdown with no scheme allow-list. A link like `[x](javascript:...)` — from
AI output or user-authored content passed through `Markdown` — produces a live
`javascript:` navigation (XSS). The component comment claims "no HTML-injection
surface," which is true for tags but not for URL schemes.
**Impact:** Stored/reflected XSS via crafted links; key exfiltration risk compounds
with C-3.
**Recommendation:** Sanitize hrefs — allow only `http(s):`, `mailto:`, and relative
URLs; drop or neutralize everything else. Add a unit test with a `javascript:` payload.

### H-4 — Routes are not code-split / lazy-loaded
**Category:** Performance
`CLAUDE.md` and `ARCHITECTURE.md` require "lazy load routes," but there are **0**
`createLazyFileRoute` and **60** eager `createFileRoute`. Heavy libraries (`recharts`,
`cmdk`, `embla`, `react-day-picker`) load in the initial bundle regardless of route.
(The TanStack router plugin does some automatic route-component splitting; confirm
what actually lands in the entry chunk with a bundle analysis.)
**Impact:** Large initial payload; slow first load, especially on analytics/executive
dashboards.
**Recommendation:** Convert heavy routes to lazy route files and/or dynamically import
chart/editor bundles. Verify with `vite build` + a bundle visualizer and set a budget.

---

## MEDIUM

### M-1 — Three overlapping data-access layers
**Category:** Architecture
`features/*/store.ts` (localStorage mocks), `src/repositories/*` (35 files), and
`src/services/*` (82 files) all coexist and overlap by domain (e.g. attendance,
projects, sprints exist in all three). Components import services in ~22 files,
repositories in ~6, and stores in ~87 — no single, enforced boundary.
**Impact:** Ambiguous source of truth; duplicated logic; onboarding confusion;
violates "Prefer composition over duplication."
**Recommendation:** Pick one layering (recommended: `service → repository → typed
client`, feature hooks over TanStack Query) and delete the others as features migrate
off `store.ts`. Document the chosen path in `ARCHITECTURE.md`.

### M-2 — Documentation is drifted and sprawling
**Category:** Documentation
`docs/` holds 139 files with heavy overlap (e.g. multiple attendance/RBAC/dashboard
docs) and stale content: `ARCHITECTURE.md` never mentions `src/services`,
`src/repositories`, `src/ai`, most of `src/integrations`, or the `executive`/`realtime`
features that exist in the tree.
**Impact:** Docs mislead contributors; "keep documentation updated" (CLAUDE.md) unmet.
**Recommendation:** Refresh `ARCHITECTURE.md` to include the current tree; designate
it the single source of truth and mark plan/review docs as historical; prune duplicates.

### M-3 — No list virtualization
**Category:** Performance / Scalability
`CLAUDE.md` requires "virtualize long lists." No virtualization library is used in
app code (only unrelated `integrations/hostinger` text). Tables like tasks, activity
feed, and employees will render every row.
**Impact:** Jank / memory pressure on large datasets once real data lands.
**Recommendation:** Adopt `@tanstack/react-virtual` for the known long lists/tables.

### M-4 — Lax compiler/lint hygiene and no typecheck gate
**Category:** TypeScript / Code quality
`tsconfig` sets `noUnusedLocals:false` and `noUnusedParameters:false`; ESLint sets
`@typescript-eslint/no-unused-vars:"off"`. There is **no `typecheck` script** in
`package.json` (and no visible CI), so `tsc` is not enforced on change. `tsc` currently
passes, but nothing guarantees it stays that way.
**Impact:** Dead code accumulates; type regressions can merge silently.
**Recommendation:** Add `"typecheck": "tsc --noEmit"`, run it (plus `lint`, `test`) in
CI, and re-enable unused-symbol checks.

### M-5 — `any` usage contradicts the "No any" rule
**Category:** TypeScript
61 occurrences of `: any` / `as any` / `any[]` across `src` (plus 1 `@ts-ignore`),
despite `CLAUDE.md` "No any types."
**Impact:** Type holes; masks the H-1 casts elsewhere.
**Recommendation:** Triage and replace with real types or `unknown` + narrowing; add
an ESLint `no-explicit-any` rule (warn → error) to prevent new ones.

### M-6 — Very thin automated test coverage
**Category:** Error handling / Quality
10 test files against 703 source files (~1.4%). Tests are limited to a few
rules/calculators; no route, component, RLS, or integration tests.
**Impact:** Regressions ship undetected; risky given the pending backend migration.
**Recommendation:** Add tests at the service/validation boundary and for critical
flows (auth guard, attendance session lifecycle, RBAC gating) before/with backend wiring.

---

## LOW

### L-1 — Debug logging left in code
**Category:** Error handling
16 `console.log/error/warn` calls in `src`. The server error middleware's
`console.error` is acceptable, but app-level logs should route through the existing
error-reporting/`states` path.
**Recommendation:** Replace ad-hoc logs with structured reporting; lint against
`console` in app code.

### L-2 — Error reporting is vendor-coupled
**Category:** Error handling
The root error boundary reports via `reportLovableError`. Fine for the Lovable
preview, but there is no product-grade observability (e.g. Sentry) for production.
**Recommendation:** Introduce a provider-agnostic error sink; keep Lovable reporting
as one adapter.

### L-3 — Feature-incomplete placeholders
**Category:** Documentation / Scalability
All AI providers (`anthropic/openai/gemini`) are `notImplemented`; 6 TODO/FIXME
markers remain. AI Assistant and Integrations are surfaced in UX/docs but not
functional.
**Recommendation:** Gate unfinished features behind flags so they aren't reachable in
production builds.

### L-4 — Repo hygiene
**Category:** Folder structure
`.DS_Store` is present at repo root (and ignored only by pattern). Ensure OS cruft and
build artifacts never sync.
**Recommendation:** Confirm `.DS_Store` is ignored globally; remove the tracked copy.

### L-5 — Minor accessibility gaps
**Category:** Accessibility
Radix primitives provide a solid a11y baseline (~128/232 feature/component files use
`aria-*`/`role`), but 2 `<img>` lack `alt`, and no keyboard-nav / contrast / screen-reader
audit has been done.
**Recommendation:** Add `alt` text; run axe/Lighthouse a11y passes on core routes and
fix findings.

---

## Positive Observations

- **Database is the strongest layer:** 35 tables across migrations, **RLS enabled on
  every table** (35/35), `app_role` enum + `has_role`/`has_any_role` helpers, UUID PKs
  — matches `CLAUDE.md` DB/security intent.
- **Service-role client is correctly server-only** (`client.server.ts`, `process.env`,
  dynamic-imported) and never bundled to the client.
- **Auth is well-architected:** `onAuthStateChange`-first bootstrap, deferred profile
  fetch, `beforeLoad` route gate, server-fn bearer attach/validate middleware.
- **Markdown renderer avoids `dangerouslySetInnerHTML`** (only the two known instances,
  in `ui/chart.tsx` and this renderer, and this one builds React nodes) — the sole gap
  is the link-scheme issue in H-3.
- **`tsc --noEmit` passes clean**, Prettier/ESLint configured, feature-first layout is
  consistently applied.

---

## Prioritized Remediation Path

1. **C-2** git-ignore `.env` (minutes) → **C-3 / H-3** close the two security holes
   before any AI wiring.
2. **H-1** regenerate DB types + drop the relaxed `db` cast → **H-2** add write-path
   validation.
3. **C-1 / M-1** collapse to one data layer and migrate features off `localStorage`
   onto Supabase (the bulk of the work; follow `ARCHITECTURE.md §15`).
4. **H-4 / M-3** code-split routes and virtualize long lists.
5. **M-4 / M-6** add CI (typecheck + lint + test) and grow coverage alongside the
   backend migration.
6. **M-2 / L-*** refresh docs and clear the remaining hygiene items.

*Audit performed read-only. No source files were modified.*
