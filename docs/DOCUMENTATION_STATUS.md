# Documentation Status & Consistency Audit

A review of the `docs/` set (144 files) + `CLAUDE.md` for **consistency with the
as-built codebase**, focused on the seven pillars requested: CLAUDE.md,
Architecture, Database, Services, Repositories, AI, Integrations. It records what
was verified, what was **updated in this pass**, and what remains as
forward-looking spec.

_Audit date: 2026-07-02._

---

## 1. How to read the docs (important)

The documentation comes in **two generations**, and conflating them causes most
"the docs are wrong" confusion:

| Convention                                                                                                                        | Nature                                                                                                | Trust for "what exists today"                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `UPPER_SNAKE_CASE.md` (ARCHITECTURE, SERVICES, REPOSITORIES, LOGGING, TESTING, ERROR_HANDLING, `*_PLAN`, `*_REVIEW`, `*_BACKEND`) | Newer, **code-aware** — as-built snapshots or explicitly-scoped design/plan docs that cite real files | **High** (as-built) or clearly-labeled design |
| `PascalCase.md` (DatabaseSchema, FolderStructure, AuthFlow, Tasks, Attendance, …)                                                 | Older **product/target specs**, mostly written before the build                                       | **Target intent**, not current state          |

Most `PascalCase` docs are **aspirational specs**, not defects — they describe
where the product is going. They become a problem only when they assert current
state that contradicts the code (e.g. `FolderStructure.md`). This report
separates _inconsistent_ from _intentionally-forward-looking_.

### Status legend

- ✅ **Current** — matches the code.
- 🔧 **Updated this pass** — was inaccurate; corrected (see §4).
- ⚠️ **Partially outdated** — directionally right, some stale facts.
- ❌ **Inconsistent** — contradicts the code as written.
- 📋 **Spec / aspirational** — target design; not meant to describe today.

---

## 2. Ground truth (verified against code)

Established by reading `src/`, `supabase/migrations/`, and `package.json`:

- **Framework**: TanStack **Start** (SSR) + TanStack Router file routes
  (`src/routes/`). Not Next.js.
- **Data layers**: `src/repositories/` (~35 modules) → `src/services/` (35
  service modules, 32 extending `BaseService`) → `src/lib/supabase` /
  `integrations/supabase`. Foundations in `src/services/core`.
- **Database**: 10 migrations, **~35 tables** live (identity/HR, attendance,
  daily reports, projects, collaboration, notifications, approvals, activity).
  **Absent**: `tasks`, `comments`, `sprints`, `saved_reports`,
  `ai_conversations`/`ai_messages`.
- **UI wiring**: `auth` + `attendance` consume live Supabase; most other feature
  UIs still read localStorage **mock stores** (services/repos built, not yet
  wired in).
- **AI**: `src/ai/` (context, models, prompts, providers, services, types, utils)
  - `src/services/ai/`.
- **Integrations**: `src/integrations/` with ports/adapters and many providers
  (github, slack, discord, email, figma, google-\*, make, n8n, zapier,
  hostinger, cloudflare, supabase-platform, automation).
- **Cross-cutting libs** (recently added): `src/lib/errors.ts`,
  `src/lib/logging/`, error boundary/screens, and a Vitest(unit+component) +
  Playwright test setup.

---

## 3. Pillar-by-pillar consistency

### 3.1 CLAUDE.md — 🔧 Updated

- **Was**: stack listed "TanStack Router" but not **TanStack Start (SSR)**; no
  testing stack. Architecture rules said each feature contains
  `services`/`pages`, implying per-feature services — but services/repositories
  are **top-level layers** and routes live in `src/routes/`.
- **Now**: stack adds TanStack Start + Vitest/RTL/Playwright; Architecture Rules
  describe the feature-first UI **over** the `repositories → services → Supabase`
  backbone; API Rules name the repository entry point, `ServiceError`, and the
  logging/error libs. Intent (feature-first, reuse, service classes, no direct
  API calls) is preserved and now literally matched by the code.

### 3.2 Architecture — 🔧 Updated / ❌→banner

- `ARCHITECTURE.md` (the as-built doc) had three stale claims, all corrected:
  §5 "**no class-based service layer**" (there are 35 service modules + ~35 repos now);
  §10 "live tables" listed ~8 (now ~35); §15 "only attendance/HR tables exist".
  Intro snapshot and §13 updated to add the service/repository layers.
- `FolderStructure.md` — ❌ described a **Next.js App Router + DDD** tree
  (`src/app`, `src/shared`, `src/domain`, `src/server`) that was **never built**.
  Added a prominent banner marking it aspirational and pointing to
  `ARCHITECTURE.md §1` for the real structure.
- `SystemArchitecture.md`, `Modules.md`, `InformationArchitecture.md`,
  `EventArchitecture.md`, `StateManagement.md`, `Routing.md` — 📋 not deeply
  re-verified; treat as design/spec. `ARCHITECTURE.md` is the authority for
  current state.

### 3.3 Database — ⚠️ / 📋

- `DatabaseSchema.md`, `DatabaseArchitecture.md`, `DATABASE_DESIGN.md`,
  `DB_RULES.md`, `RLSPolicies.md`, `Triggers.md`, `DatabaseFunctions.md` are
  **design/target** docs. Their conventions (uuid PKs, RLS everywhere,
  `timestamptz`, soft-delete) **match** the migrations.
- Drift: `DATABASE_DESIGN.md` says "no migration was written" (true at its
  2026-06-30 snapshot) but **migrations have since landed** (project execution,
  collaboration, realtime). Several tables these docs mark as target now exist.
  No edits made — they remain valid as specs; `ARCHITECTURE.md §10` is the
  authoritative "what's live" list.

### 3.4 Services — 🔧 Updated

- `SERVICES.md` accurately described `BaseService`/`core`/error model, but §2
  listed only **8** domains; the code has **35** service modules across `hr`,
  `sprints`, `approvals`, `activity`, `kpi`, and many `projects/*` sub-services.
  Updated §2 with the full set and added a §4 note that several "(future)"
  tables (`projects`, `notifications`, `daily_reports`) have landed while
  `tasks`/`sprints`/`saved_reports`/AI tables are still pending.
- `KPI_SERVICES.md` — ✅ matches `services/kpi/executive-kpi.service.ts`.

### 3.5 Repositories — 🔧 Updated

- `REPOSITORIES.md` correctly described the layer's purpose and the **original 7**
  root repositories, but the layer has grown to **~35** across nested folders
  (`hr/`, `projects/`, `notifications/`, `reports/`, `activity/`, `attendance/`).
  Updated §2 to reflect the grown structure.

### 3.6 AI — 📋 / ✅ (consistent design)

- `AI_ARCHITECTURE.md`, `AI_INFRASTRUCTURE.md`, `AI_FEATURES.md`,
  `CONTEXT_ENGINE.md`, `PROMPTS.md` are **code-aware design** docs that correctly
  cite `src/services/ai` and `src/ai/providers`. The actual `src/ai/` subsystem
  is broader than the docs' "partially built" framing, but nothing contradicts.
  No edits; classified as spec/consistent. (Model guidance aligns with CLAUDE.md:
  build on latest Claude models, e.g. `claude-opus-4-8`.)

### 3.7 Integrations — ⚠️ (minor path drift)

- `INTEGRATION_ARCHITECTURE.md` (design) and `Integrations.md` describe a
  ports-&-adapters layer that **matches** `src/integrations/` (ports/, providers/,
  per-provider adapters). Minor drift: `Integrations.md` references `domain/ports/`
  and `src/integrations/registry.ts`; actual ports live in
  `src/integrations/ports/` (there is no `src/domain/`). Flagged here; not
  rewritten (design doc). `GITHUB.md`, `INTEGRATION_CENTER.md`,
  `INTEGRATION_REVIEW.md`, `ACTIVITY_INTEGRATIONS.md` — feature/review docs, not
  re-verified in depth.

---

## 4. Changes applied in this pass

| File                           | Change                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`                    | Stack: +TanStack Start (SSR), +testing tools. Architecture Rules: feature-first UI + `repositories → services → Supabase` layers + top-level dirs. API Rules: repository entry point, `ServiceError`, logging/error libs.            |
| `docs/ARCHITECTURE.md`         | Intro snapshot rewritten (DB/layers/wiring status). §5 rewritten to document the service + repository layers. §10 expanded to the ~35 live tables + "not yet" list. §13 adds services/repos/error surfaces. §15 items 1 & 3 updated. |
| `docs/FolderStructure.md`      | Added ⚠️ banner: aspirational Next.js/DDD, **not adopted**; points to `ARCHITECTURE.md §1`.                                                                                                                                          |
| `docs/SERVICES.md`             | §2 folder list expanded to all 35 service modules; §4 schema-status note (landed vs. pending tables).                                                                                                                                |
| `docs/REPOSITORIES.md`         | §2 updated: original 7 + the grown ~35-repo nested structure.                                                                                                                                                                        |
| `docs/DOCUMENTATION_STATUS.md` | This report (new).                                                                                                                                                                                                                   |

No application code was modified. No docs were deleted (per "extend existing").

---

## 5. Consistency matrix (post-update)

|                  | CLAUDE.md | ARCHITECTURE | Database | Services | Repositories | AI  | Integrations |
| ---------------- | --------- | ------------ | -------- | -------- | ------------ | --- | ------------ |
| **CLAUDE.md**    | —         | ✅           | ✅       | ✅       | ✅           | ✅  | ✅           |
| **ARCHITECTURE** | ✅        | —            | ✅       | ✅       | ✅           | ✅  | ✅           |
| **Database**     | ✅        | ✅           | —        | ✅       | ✅           | ✅  | n/a          |
| **Services**     | ✅        | ✅           | ✅       | —        | ✅           | ✅  | n/a          |
| **Repositories** | ✅        | ✅           | ✅       | ✅       | —            | n/a | n/a          |

`FolderStructure.md` was the one hard **contradiction** across pillars; it is now
explicitly demoted to aspirational, so the pillar docs no longer conflict.

---

## 6. Remaining drift & recommendations

1. **Regenerate `types.ts` after each migration.** `integrations/supabase/types.ts`
   trails the live schema; services use a relaxed `db` client to bridge the gap.
   Regenerating removes those casts and keeps SERVICES/REPOSITORIES honest.
2. **Date-stamp and status-tag spec docs.** Several `PascalCase` specs (esp.
   `DatabaseSchema.md`, `DatabaseArchitecture.md`) assert current state; add a
   one-line "📋 target spec / as-built" banner like `ARCHITECTURE.md` uses.
3. **Reconcile `Integrations.md` paths** (`domain/ports/` → `src/integrations/ports/`,
   confirm/remove `registry.ts`).
4. **Add a docs index / ownership.** 144 docs with overlapping topics (e.g.
   `ErrorHandling.md` vs `ERROR_HANDLING.md`, `Performance.md` vs the frontend
   perf section) invite drift. A short `docs/README.md` mapping topic → canonical
   doc would prevent duplicate sources of truth.
5. **Wire a doc-lint into CI (light).** A check that key file/table names cited in
   `ARCHITECTURE.md §10` exist in `supabase/migrations/` would catch the most
   common drift (docs claiming tables that don't exist, or vice-versa).
6. **When `tasks`/`sprints`/`comments` land**, update `ARCHITECTURE.md §10/§15`,
   `SERVICES.md §4`, and clear their "(future)" markers.

---

## 7. Scope note

Deep verification covered the seven requested pillars and the cross-cutting libs
(errors, logging, testing) against source. The remaining ~120 docs
(feature/product specs, dashboards, plans, reviews) were **classified by type**,
not line-by-line verified — they are predominantly 📋 forward-looking specs and
were left intact. Use `ARCHITECTURE.md` as the canonical "current state" doc and
this file as the map of which docs to trust for what.

---

_Last updated: 2026-07-02._
