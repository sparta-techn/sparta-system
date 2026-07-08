# Final Engineering Review

Verification of the SpartaFlow codebase against the release checklist. Each item
has a **verdict**, the evidence, and — where relevant — the fix applied or the
reason a finding was deferred. Per the review's scope, **only critical issues
were fixed**; non-critical findings are documented with remediation.

_Review date: 2026-07-02._

---

## 1. Scorecard

| #   | Check                                  | Verdict        | Notes                                                                                                                                          |
| --- | -------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Build passes**                       | ✅ Pass        | `vite build` succeeds; SSR + client bundles + nitro output generated.                                                                          |
| 2   | **TypeScript clean**                   | ✅ Pass        | `tsc --noEmit` → 0 errors.                                                                                                                     |
| 3   | **ESLint clean**                       | ⚠️ Logic clean | **0 real errors** (2 critical fixed). 1886 pre-existing `prettier/prettier` formatting errors remain (one-command fix; non-critical — see §3). |
| 4   | **No dead code**                       | ⚠️ Minor       | 5 unused barrel repositories (§4.1).                                                                                                           |
| 5   | **No duplicated components**           | ⚠️ Minor       | 2× `EmptyState` (§4.2).                                                                                                                        |
| 6   | **No duplicated services**             | ⚠️ Minor       | `ProjectsService` vs `ProjectRecordsService` target the same table (§4.3).                                                                     |
| 7   | **No duplicated repositories**         | ⚠️ Minor       | Flat vs nested repository layers coexist (§4.1).                                                                                               |
| 8   | **No `console.log` left**              | ✅ Pass        | 0 stray logs; the 2 hits are the logging adapter's own sink (§5).                                                                              |
| 9   | **No TODO left**                       | ⚠️ Intentional | 6 TODOs, all "not implemented" markers in unbuilt AI provider stubs (§6).                                                                      |
| 10  | **No mock data in production modules** | ⚠️ By design   | Service/repository layers are **clean**; feature/UI mock stores remain (prototype state) (§7).                                                 |
| —   | Tests                                  | ✅ Pass        | 195/195 across unit + component projects.                                                                                                      |

**Overall:** Ship-ready on the hard gates (build, types, logic-lint, tests). The
⚠️ items are pre-existing tech-debt/architecture-evolution artifacts, not
runtime defects, and were intentionally left per "fix only critical issues."

---

## 2. Critical issues fixed

Two **`react-hooks/rules-of-hooks` violations** — genuinely critical because a
hook called after an early return changes the hook count between renders, which
React can throw on ("rendered fewer/more hooks than during the previous render").

| File                                            | Problem                                                                                                             | Fix                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/features/tasks/components/tasks-list.tsx`  | `useCallback(toggle)` was declared **after** the `loading` / empty early returns (introduced during the perf pass). | Moved the `useCallback` above the early returns so hook order is constant.                     |
| `src/features/tasks/components/task-detail.tsx` | `useTasksStateOptional(task.parentTaskId)` was called **after** the `if (!task) return` guard (pre-existing).       | Moved it above the guard using `task?.parentTaskId` (the hook already tolerates a nullish id). |

Verified: `eslint` reports **0** `rules-of-hooks` errors afterward; `tsc` clean;
build + 195 tests green. These were the only issues meeting the "critical" bar
(potential runtime crash).

---

## 3. ESLint detail

`eslint .` reports 1904 problems: **0 real (logic) errors**, 1886
`prettier/prettier` formatting errors, and 18 warnings.

- **Formatting (1886)** — pre-existing across the generated codebase (it was
  never run through the project's own `format` script). Purely whitespace /
  quotes / line-wrapping; **zero behavioral effect**. Not fixed here because a
  repo-wide reformat is a large, non-critical, noisy diff outside the
  "fix only critical" scope. **Remedy: `npm run format`** (`prettier --write .`),
  ideally as its own dedicated commit. Files touched in this review were
  formatted.
- **Warnings (18)** — all idiomatic / low-signal:
  - `react-refresh/only-export-components` (13) — shadcn `ui/*` files exporting a
    component + its `cva` variants; standard for the library.
  - `react-hooks/exhaustive-deps` (2) — intentional dependency omissions; review
    case-by-case, not blocking.
  - Unused `eslint-disable` for `no-console` (3) in `notifications/` — stale
    directives (the `no-console` rule isn't enabled). Harmless; can be deleted.

---

## 4. Duplication & dead code (deferred — not critical)

### 4.1 Repository layer: flat vs nested (dead code + duplication)

Two parallel repository structures coexist:

- **Flat** (`src/repositories/*.repository.ts`, 7 files) — exported by the public
  barrel `@/repositories`, documented in `REPOSITORIES.md`.
- **Nested** (`src/repositories/<domain>/*.repository.ts`, ~28 files) — imported
  directly by feature stores via subpath (`@/repositories/hr`,
  `@/repositories/projects`, `@/repositories/reports`, `@/repositories/notifications`).

Usage of the flat/barrel singletons (outside the layer itself):

| Repo                                                                                               | Consumers    |
| -------------------------------------------------------------------------------------------------- | ------------ |
| `projectRepository`                                                                                | 4            |
| `employeeRepository`                                                                               | 2            |
| `authRepository`, `taskRepository`, `sprintRepository`, `attendanceRepository`, `reportRepository` | **0 (dead)** |

So **5 of 7 barrel repositories are unused**, and three (`employee`/`project`/
`attendance`) duplicate a nested counterpart that _is_ used. **Recommendation:**
pick one layout (the nested/subpath layout is the one features actually consume),
migrate the 2 live barrel repos, delete the 5 dead ones, and update
`REPOSITORIES.md`. Deferred: it's a refactor touching the documented public API,
not a runtime bug.

### 4.2 Duplicated component: `EmptyState`

Two implementations: `src/components/states.tsx` (`EmptyState`/`ErrorState`/
`LoadingState`) and `src/features/hr/components/empty-state.tsx`. Feature code
imports the HR one widely. CLAUDE.md says "never create duplicate UI
components." **Recommendation:** standardize on `components/states.tsx` and
re-point imports. Deferred: mechanical but wide-reaching; not a defect.

### 4.3 Duplicated service: projects

`ProjectsService` (`projects.service.ts`) and `ProjectRecordsService`
(`project-records.service.ts`) **both** declare `table = "projects"` and are both
exported from `services/projects/index.ts`. The latter's doc comment calls the
former "legacy mock-typed," i.e. it's a successor that never replaced the
original. **Recommendation:** consolidate to one and remove the other. Deferred:
requires confirming call sites; not a runtime bug.

---

## 5. `console.log` audit — ✅ clean

`grep console.log src` → 2 hits, both in `src/lib/logging/adapters/console.ts`:
one in a JSDoc line, one as the ConsoleAdapter's **intentional last-resort sink**
(a logging adapter using `console` is its literal purpose). **No stray debug
logs.** Separately, ~18 `console.error`/`console.warn` calls exist in error
paths (SSR handler, auth bootstrap, store write-throughs, realtime) — legitimate
error surfaces; migrating them to `@/lib/logging` is a nice-to-have, not a defect.

---

## 6. TODO audit — ⚠️ intentional (6)

All six TODOs are in the AI provider stubs and mark genuinely-unbuilt external
integrations:

```
src/ai/providers/anthropic-provider.ts   // TODO: call Anthropic Messages API …
src/ai/providers/openai-provider.ts      // TODO: call OpenAI API server-side …
src/ai/providers/gemini-provider.ts      // TODO: call Google Gemini API …
```

These are honest "not implemented yet" markers for the deliberately-deferred
provider integrations ("no external integration yet"), not forgotten cruft.
Deleting the comment wouldn't implement the work. **Left in place**; track via
the AI integration milestone.

---

## 7. Mock data in production modules — ⚠️ by design at the UI layer

- **Service / repository layers: clean.** No `mock-data` imports anywhere in
  `src/services` or `src/repositories` — the "mock" mentions there are comments
  referencing the feature stores, not usage.
- **Feature / UI layer:** 17 `src/features/*/mock-data.ts` files seed the
  localStorage-backed stores and **do ship** in the bundle (imported by ~84
  modules). This is the **documented prototype state** (`ARCHITECTURE.md`,
  `DOCUMENTATION_STATUS.md`): `auth` + `attendance` are wired to live Supabase;
  other features run on mock stores whose shape mirrors the future backend.

Not fixed: removing this means wiring each feature to the repository/service
layer + landing the remaining schema (`tasks`, `sprints`, `comments`) — a
milestone, not a critical bug. Tracked in `ARCHITECTURE.md §15`.

---

## 8. Commands to reproduce

```bash
npm run build       # ✅ vite build
npm run typecheck   # ✅ tsc --noEmit → 0 errors
npm test            # ✅ 195/195 (unit + component)
npx eslint .        # 0 logic errors; 1886 prettier (run `npm run format`), 18 warnings
```

---

## 9. Recommended follow-ups (non-blocking, prioritized)

1. **`npm run format`** in a dedicated commit → clears all 1886 formatting
   errors, makes `eslint .` fully green.
2. **Consolidate the repository layer** (§4.1): delete 5 dead barrel repos,
   choose the nested layout, update `REPOSITORIES.md`.
3. **De-duplicate** `EmptyState` (§4.2) and the projects service (§4.3).
4. **Wire features to repositories** and retire `mock-data.ts` as schema lands
   (§7; `ARCHITECTURE.md §15`).
5. Delete the 3 stale `eslint-disable no-console` directives.

---

_Last updated: 2026-07-02._
