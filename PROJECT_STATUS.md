# SpartaFlow — Project Status Report

> **Type:** Evidence-based snapshot of what works, what is mock, and what is actively broken.
> **Method:** Read-only static inspection of `src/`, `supabase/migrations/`, routes, services,
> repositories, and stores. No code was modified. Evidence cited as `file:line`.
> **Date:** 2026-07-06. **Prior report:** `docs/MVP_STATUS.md` (2026-07-05).
> **Not remotely verified:** claims about *applied* DB state are inferred from local git/link
> markers (no live query against the remote project was made). These are flagged inline.

## Legend

- ✅ **Complete** — real backend, persisted, multi-user, CRUD works, UI wired.
- 🟡 **Partial** — some real, some mock (see detail).
- ❌ **Missing** — no functional persistence (UI stub at most).
- 🔴 **Broken** — code path exists and is wired, but fails at runtime right now.

---

## 1. Summary table

| Module | Status | Backend | Mock data | UI | CRUD (what works) | Known issues |
|---|---|---|---|---|---|---|
| Authentication | ✅ | yes | no | yes | login/logout/reset/verify | — |
| RBAC | ✅ | yes | no | partial | role/permission checks enforced server-side (RLS) | UI checks cosmetic only |
| Attendance | ✅ | yes | no | yes | clock in/out/break via RPCs | queries `supabase` directly, not via repo (`attendance/api.ts`) |
| Daily Reports (checkin/midday/eod) | 🟡 | yes (submit+history) | drafts only | yes | submit + own-history read live | drafts localStorage; manager review UI not wired |
| Organization | 🟡 | partial (read) | yes (admin UI) | yes | dept/team/company **read** live | write UI is localStorage (`admin/system-store.ts`) |
| Employee Management | 🟡 | partial | yes (writes) | yes | directory **read** live; **invite issuance now real** | mutations localStorage overlay; unhandled invite call |
| Projects | 🟡 | yes (read+create) | overlay | yes | hydrate + create + members live | favorites/templates/clients localStorage overlay |
| Tasks | 🔴 | yes (columns) but **writes fail** | overlay + mock catalogs | yes (rich) | read live; **create/update silently fail to persist** | create dialog uses **mock** projects → FK/RLS insert rejection swallowed |
| Kanban | 🟡 | no | yes | yes | localStorage column config; reads tasks store | no persistence table |
| Comments | 🟡 | no | yes | yes | localStorage only (3 divergent stores) | no `comments`/`task_comments` table |
| File Attachments | ❌ | no | yes (fake blobs) | stub | none (in-memory `previewUrl`) | no Storage bucket; downloads are mock toasts |
| Notifications | 🟡 | yes (inbox+realtime) | generation | yes | read/lifecycle live | server-side generation added but **unapplied**; still in-memory |
| Time Tracking | 🟡 | no | yes | yes | localStorage only | header comment: "no backend writes" |
| Dashboard | 🟡 | mixed | yes (some widgets) | yes | live check-in/reports/notif widgets; rest mock | summary/tasks/team/activity widgets are mock |
| Analytics | 🟡 | no | yes | yes | read-only mock | `saved_reports` service exists but unused |
| Settings | 🟡 | partial | yes (workspace UI) | yes | `company_settings` live (attendance) | general/workspace settings not wired |
| Audit Logs | 🔴 | code targets Supabase | seeds (fallback) | yes | capture wired to `audit_logs` but table **likely unapplied** → writes fail | migration untracked/newer than link |
| AI Assistant (`ai`, `ai-settings`) | ❌ | no | yes | yes (chat UI) | none — provider calls are `TODO` stubs | keys XOR-obfuscated in localStorage |
| Dependencies | 🟡 | no | yes (in-memory) | yes | in-memory only (no localStorage even) | mock `MOCK_DEPENDENCIES` |
| Sprints | 🔴 | no (feature); service reaches missing table | yes | yes | localStorage feature; `sprints` **table missing** but queried live via Executive AI | swallowed at runtime |
| Executive dashboard | 🟡 | no | yes | yes | mock KPIs; AI "Generate" reaches missing `sprints` | AI output is mock (stubbed providers) |
| Manager dashboard | 🟡 | no | yes | yes | mock only | — |
| Admin console | 🟡 | no | yes | yes | localStorage (`system-store.ts`) | audit events captured, org writes not persisted |
| Task-communication (comments/files) | 🟡/❌ | no | yes | yes | localStorage comments; fake file blobs | source of Comments + File Attachments surfaces |
| Project-analytics | 🟡 | derived | inherits | yes | read-only selectors over other stores | no own persistence |
| Realtime | ✅ (infra) | yes | no | n/a | subscription adapter over Supabase realtime | `tasks` subscribed but not in publication |

Support module not in the table: `daily-sync.ts` — Supabase-backed helper (`daily-sync.ts:6-7`) used by checkin/midday/eod.

---

## 2. Broken / not working right now

Severity: **blocking** (feature's core purpose fails) · **degraded** (works partially / silently drops data) · **cosmetic** (no user impact yet).

### BLOCKING

**B1 — Tasks: create/update write-through silently fails to persist.** `[blocking]`
The task-create dialog populates its project dropdown from **mock** `seedProjects`
(`src/features/tasks/components/create-task-dialog.tsx:14,41,49`), so the created task carries a
`project_id` that is not a real row. The store passes it straight to the insert
(`src/features/tasks/store.ts:333`) via `taskRepository.create`. That insert must satisfy the FK
`project_id → projects(id)` (`supabase/migrations/20260705120000_tasks_table.sql:34`) **and** the
insert RLS `is_project_member(auth.uid(), project_id) AND has_permission('tasks.create')`
(`…tasks_table.sql:76-81`). Both fail for a mock project id / non-member. The rejection is caught
and only `console.error`'d (`src/features/tasks/store.ts:344-346`, same for update `:360-362`), so
the task appears in the UI (optimistic + localStorage overlay) but never reaches the server and
disappears on the next hydrate (`store.ts:230` replaces `state.tasks` from the server).
**Suspected root cause:** the tasks store was wired to `taskRepository` after the 2026-07-05
report, but the create UI still reads mock projects instead of the live projects store.

**B2 — Audit Logs: writes/reads target `audit_logs`, which is almost certainly not applied.** `[blocking]`
`audit-store.ts` was swapped from localStorage to Supabase this session: it imports the relaxed
`db` client (`src/features/audit/audit-store.ts:28`), binds `TABLE = "audit_logs"` (`:39`), inserts
on every `recordAudit` (`:219`) and hydrates the viewer from the table (`:72-78`). But the table's
migration `supabase/migrations/20260706120000_audit_logs.sql` is **untracked in git**
(`git status` → `??`) and newer than the last Supabase link marker (`supabase/.temp/` dated
2026-07-05 16:01). If it has not been pushed, every insert fails (swallowed at `:218-223`) and
hydrate falls back to seed data (`:71-85`) — i.e. the audit trail is not durable on the remote.
**Suspected root cause:** code change landed without the accompanying migration being committed/
applied. *Requires remote verification to confirm applied state.*

### DEGRADED

**D1 — `sprints` table missing but queried live via Executive AI insights.** `[degraded]`
Clicking "Generate" on the Executive Dashboard reaches the sprints source at runtime:
`executive.tsx:7,26` → `executive-dashboard.tsx:14,49` → `ai-insights-section.tsx:29` →
`executive-summaries.tsx:58,69` → `executive-summaries.ts:93` (`aiAssistant.run`) →
`ai-engine.ts:86` (`context.build`) → `composite-resolver.ts:60` → `sources/sprints.source.ts:28,33`
→ `sprintsService.listByProject/listByStatus` → `.from("sprints")`
(`src/services/sprints/sprints.service.ts:16`; `.from` at `base-service.ts:67`). No `sprints` table
exists. The query error is swallowed per-source by `Promise.allSettled`
(`src/ai/context/composite-resolver.ts:60`), so it degrades to an "unavailable" context note rather
than crashing — and the AI provider is itself a stub (see D4), so the output is mock regardless.
**Suspected root cause:** AI context surfaces (`src/ai/context/surfaces.ts:25,26`) reference a
`sprints` source whose table was never created (sprints feature is localStorage-only).

**D2 — Notification server-side generation added but unapplied.** `[degraded]`
`supabase/migrations/20260706130000_notification_triggers.sql` (task-assigned, report-submitted →
`notifications` inserts) is **untracked** (`git status` → `??`). Until applied, real domain events do
not fan out to persisted notifications; generation remains the in-memory engine
(`features/notifications/rules.ts`/`automation-engine.ts`). Even once applied, the task-assigned
trigger only fires when a `tasks` insert succeeds — which currently fails (see B1). The inbox itself
is live and unaffected (`notifications/store.ts:12,93`). *Requires remote verification.*

**D3 — File Attachments never persist.** `[degraded]` (by design / not yet built)
`task-files-panel.tsx` creates an in-memory `URL.createObjectURL` blob on "upload"
(`src/features/task-communication/components/task-files-panel.tsx:53,54`) and downloads are mock
toasts (`:178-180`). No Storage bucket or `attachments` table exists anywhere.

**D4 — AI Assistant provider calls are unimplemented stubs.** `[degraded]`
All three providers return nothing real: `src/ai/providers/anthropic-provider.ts:27,34`,
`openai-provider.ts:28,35`, `gemini-provider.ts:27,34` are `TODO` bodies. The chat UI
(`features/ai/hooks/use-chat.ts:8,70`) and store (`features/ai/store.ts`) run, but produce no real
completion. Provider keys are XOR-"obfuscated" in localStorage (`ai-settings/secure-store.ts`).

**D5 — HR invitation store call is unhandled.** `[degraded]`
`await inviteEmployeeFn(...)` in `src/features/hr/invitations-store.ts:212` has no try/catch/.catch
in the store (delegated to caller per the docstring `:208-210`). A server failure surfaces as an
unhandled rejection unless every caller wraps it. The rest of HR reads are live
(`hr/api.ts:16-17,172-204`).

### COSMETIC / LATENT

**C1 — `tasks` realtime hooks target a table not in the publication.** `[cosmetic]`
`useDomainRealtime("tasks", …)` (`src/features/realtime/hooks.ts:70,78`) subscribes to `tasks`
`postgres_changes`, but `tasks` is absent from the realtime publication
(`supabase/migrations/20260701130000_realtime_publication.sql` predates the tasks table and lists
`activity_feed, approval_requests, attendance, attendance_sessions, break_sessions, daily_reports,
daily_status_updates, dependency_requests, mentions, notifications`). The hooks are currently not
consumed by any tasks component, so no live impact.

**C2 — Non-admins see stale seed audit data.** `[cosmetic]`
`audit_logs` SELECT RLS is owner/admin-only (`20260706120000_audit_logs.sql`), so a non-admin
viewer's hydrate returns `[]`; the store falls back to seed events (`audit-store.ts` `defaultState`)
until then. By design, but means non-admins can briefly see mock rows.

### LATENT dead scaffolds (services bind to non-existent tables; **not** reached by live UI)

These compile (the generic `BaseService` uses a relaxed casted client — `services/core/client.ts:14`
— so unknown tables are **not** caught by `tsc`) and would throw only if wired to the UI:

| Missing table | Bound at | Only referenced by | Verdict |
|---|---|---|---|
| `ai_conversations`, `ai_messages` | `services/ai/ai.service.ts:23,36` | barrel `services/index.ts:32` | dead — live chat uses a different subsystem |
| `saved_reports` | `services/analytics/analytics.service.ts:28` | barrel `services/index.ts:28` | dead — analytics reads mock-data |
| `eod_reports` | `services/reports/reports.service.ts:25` | `report.repository.ts:4,15` → barrel only | dead — live EOD uses `daily_reports` |
| `task_comments` | `services/tasks/tasks.service.ts:94,105` | AI `comments.source.ts:27` (employee/manager AI only) | dead — no live UI hits the employee AI surface |

---

## 3. Module-by-module detail

**Authentication — ✅.** Supabase Auth: login/logout/reset/verify (`features/auth/auth-service.ts:9-77`),
session persistence (`integrations/supabase/client.ts`), route guard. Throws on error (`:13,23,43`).

**RBAC — ✅.** `has_role`/`has_any_role`/`has_permission` SECURITY DEFINER functions + RLS on all
tables; catalog mirrored TS↔SQL (`features/auth/permissions.ts`, `migrations/20260703120100_*`).
EXECUTE re-granted to `authenticated` (`20260705130000_grant_role_helpers_execute.sql`).

**Attendance — ✅.** `features/attendance/api.ts` + `queries.ts`, atomic RPCs
(`start_work_session`/`start_break`/`end_break`/`finish_work_session`, all in
`20260628201706_*`). Backed by `work_sessions`/`attendance*`. Reads hit `supabase` directly
(`api.ts:29-155`), bypassing the repository layer — architecture smell, not a functional gap.

**Daily Reports — 🟡.** checkin/midday HYBRID → `statusUpdateRepository` (`daily_status_updates`)
(`checkin/store.ts:16,100`, `midday/store.ts:14,105`); eod HYBRID → `dailyReportRepository`
(`daily_reports`) (`eod/store.ts:14,110-134`). Drafts localStorage. Submit + own-history live; all
wrap async in try/catch. Manager rollup/review UI not wired.

**Organization — 🟡.** Real tables + services (companies/workspaces/system_settings). Dept/team
read live and hydrate Projects/HR. Admin/org **write** UI is localStorage (`admin/system-store.ts:12`).

**Employee Management — 🟡.** Directory read live (`hr/api.ts:172-204`); **invitation issuance is now
real** (server fn `inviteEmployeeFn`, `hr/invitations-store.ts:212`; commits `ef3a3ab`/`78db025`).
Mutations still localStorage overlay (`hr/employees-store.ts:21`). *Suspected issue:* unhandled
invite call (D5).

**Projects — 🟡.** Store hydrates from repositories (`projects/store.ts:17-29,170-224`); create +
member assignment live (`:343-378`). Overlay (`LOCAL_KEY :58`) for clients/templates/workspace.
Well wrapped in try/catch.

**Tasks — 🔴.** HYBRID: durable columns via `taskRepository` (`store.ts:19,230,344,360`); `TaskRow`
matches the table exactly (`tasks.service.ts:14-27` vs `20260705120000_tasks_table.sql:32-46`).
Rich fields (labels/checklist/relations) + comments/activity in localStorage overlay
(`store.ts:45`). *Suspected root cause of breakage:* create dialog wired to mock `seedProjects`
(B1) → inserts rejected by FK+RLS, swallowed. Read hydrate is correctly guarded (`store.ts:237-242`).

**Kanban — 🟡.** localStorage board/columns (`kanban/store.ts:11`), reads the tasks store, owns no data.

**Comments — 🟡.** Three localStorage stores: `features/tasks` (`task-comments.tsx:51` →
`store.ts:572`), `features/task-communication` (`store.ts:9`), `features/dependencies`
(`dep-comments.tsx`). No `comments`/`task_comments` table (see LATENT table). Threaded UI, mentions,
reactions all in-memory.

**File Attachments — ❌.** In-memory blobs only (D3). No Storage bucket, no `attachments` table.

**Notifications — 🟡.** Inbox live: hydrated from `notificationRepository.inbox` + realtime
(`store.ts:12,93`), full lifecycle persists, per-mutation `.catch(() => hydrate())`. Generation still
in-memory; server-side triggers staged but unapplied (D2).

**Time Tracking — 🟡.** localStorage only (`time-tracking/store.ts:12`; header comment `:6` "no
backend writes"). No `time_logs` table.

**Dashboard — 🟡.** Mixed. `routes/_authenticated/app/index.tsx` composes live widgets (check-in,
eod, notifications) with mock ones (`features/dashboard/components/*` fed by
`dashboard/mock-data.ts`). A preview banner was added this session (`index.tsx`).

**Analytics — 🟡.** Mock only (`features/analytics/mock-data.ts`); `analyticsService`/`saved_reports`
unused (LATENT). KPI calculators run over mock inputs. Preview banner added (`analytics.tsx`).

**Settings — 🟡.** `company_settings` singleton live (used by attendance); `system_settings` service
exists. Workspace/company settings UI uses static defaults, not wired.

**Audit Logs — 🔴.** Code is Supabase-backed now (B2); table migration untracked/likely unapplied.
Capture is called at real sites (login/logout, employee/project/admin actions). Reads owner/admin-only.

**AI Assistant (`ai`/`ai-settings`) — ❌.** Chat UI + context subsystem run, but providers are stubs
(D4). Context resolvers registered at load (`ai/context/index.ts:13`) and reach data sources at
generate time, including the missing `sprints` (D1). Stores localStorage.

**Dependencies — 🟡.** In-memory mock, not even localStorage (`dependencies/store.ts:2,17`).

**Sprints — 🔴 (via AI) / 🟡 (feature).** Feature store localStorage (`sprints/store.ts:14`);
task↔sprint assignment delegates to the (real) tasks `sprint_id` column. The `sprints` **table does
not exist**, yet `sprintsService` is reached live through Executive AI insights (D1).

**Executive / Manager — 🟡.** Mock KPI dashboards (`executive/mock-data.ts`, `manager/mock-data.ts`).
Executive "Generate" is the only live `aiAssistant.run` caller and triggers D1.

**Admin — 🟡.** localStorage system store (`admin/system-store.ts`); audit events captured via
`recordAudit`, org writes not persisted.

**Project-analytics — 🟡.** Pure derived selectors over tasks (real core) + sprints/time-tracking/
task-communication (localStorage) + hr mock (`project-analytics/utils.ts:7-10`). No own store.

**Realtime — ✅ infra.** Subscription adapter (`features/realtime/hooks.ts`, `lib/supabase/realtime`).

---

## 4. Environment & config check

**Env var completeness — OK.** Every env var referenced in code is present in `.env.example`:
code references `NODE_ENV`, `ENFORCE_CSP`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (+ Vite built-ins
`PROD`, `VITE_` prefix). `.env.example` additionally defines `HOST`, `PORT`, `SUPABASE_PROJECT_ID`,
`LOG_LEVEL`, `RELEASE`, `COMMIT_SHA`, `VITE_*` variants. No missing vars. A local `.env` exists
(git-ignored). `validate:env` script present (`package.json:22`).

**Project ref — consistent.** `supabase/config.toml` `project_id = "mgbtonsatvffknsjdxfe"` matches the
linked project (`supabase/.temp/linked-project.json` → `"ref":"mgbtonsatvffknsjdxfe"`,
`supabase/.temp/project-ref`) and the local `.env` URL `https://mgbtonsatvffknsjdxfe.supabase.co`.
`integrations/supabase/client.ts` reads the URL from env (no hardcoded ref), falling back
`import.meta.env.VITE_*` → `process.env.*` and throwing if absent (`client.ts` `createSupabaseClient`).

**Migration ordering — no bugs found.** All 17 migrations are timestamp-ordered and every
cross-reference resolves to an earlier migration (e.g. `tasks` (0705) → `projects` (0630150000),
`priority_level` (0630130000); `audit_logs`/`notification_triggers` (0706) → `tasks`/`daily_reports`/
`notifications`/`user_roles`). Enum rename `super_admin→admin` (0703) is followed by no migration that
uses the old literal.

**Applied state (inferred locally, not remotely verified):**
- `20260706120000_audit_logs.sql` and `20260706130000_notification_triggers.sql` are **untracked**
  (`git status` → `??`) and newer than the last link marker (`supabase/.temp/` 2026-07-05 16:01) →
  **most likely not pushed/applied.** This is the basis for B2 and D2.
- `20260705120000_tasks_table.sql` is committed/tracked → likely applied.
- The RLS write-integrity guards migration discussed in prior work exists **only in the session
  scratchpad**, not under `supabase/migrations/` → definitely not applied.
- Definitive applied state requires querying the remote (`supabase migration list` / DB introspection).

---

## 5. Recent changes note (git + working tree)

**Commits (all 3):** `9a371b3` first commit (2026-07-05) · `ef3a3ab` "feat(hr): real server-side
employee invitation flow" (2026-07-06) · `78db025` "real invitation" (2026-07-06). Only 3 commits
exist; most recent work is **uncommitted** in the working tree.

**Uncommitted working changes (the highest-risk deltas since the 2026-07-05 report):**
- `M src/features/audit/audit-store.ts` — swapped localStorage → Supabase `audit_logs` (basis for B2).
- `?? supabase/migrations/20260706120000_audit_logs.sql` — new, untracked (B2).
- `?? supabase/migrations/20260706130000_notification_triggers.sql` — new, untracked (D2).
- `?? src/components/preview-banner.tsx` + `M` on `analytics.tsx`, `index.tsx`, `tasks.time.tsx`,
  `task-comments.tsx`, `threaded-comments.tsx`, `task-files-panel.tsx`, `dep-comments.tsx` — added
  "Preview" badges/banners to mock-fed surfaces (cosmetic, no logic change).

**Areas actively changed since 2026-07-05 and thus most likely to harbor new breakage:**
- **Tasks** — newly wired to `taskRepository`/`tasks` table (was localStorage-only in the prior
  report). New breakage: B1 (create dialog still uses mock projects → silent write failure).
- **Audit** — newly Supabase-backed. New breakage: B2 (table likely unapplied).
- **Notifications** — new server-side generation triggers staged. New gap: D2 (unapplied).
- **Kanban/Comments/Time Tracking/Analytics/Dashboard/Files** — unchanged in persistence; only
  gained preview labels.

_End of snapshot. No fixes or roadmap included, per request._
