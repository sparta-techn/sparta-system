# SpartaFlow — MVP Implementation Status

> **Type:** Per-module implementation-status report + fastest path to a usable 10-person MVP.
> **Method:** Read-only static inspection of `src/`, `supabase/migrations/`, routes, services,
> repositories, and stores. No code was modified. Evidence cited as `file:line`.
> **Date:** 2026-07-05.

## Legend

- ✅ **Complete** — real backend, persisted, multi-user, CRUD works, UI wired.
- 🟡 **Partially Implemented** — some of it is real; see the per-module breakdown.
- ❌ **Missing** — no functional implementation (UI stub at most).

## How to read the "hybrid" modules

The persistence pattern is consistent across the app: each feature has a `store.ts`
(`useSyncExternalStore` facade) that is *either* localStorage-only (mock) or **hydrated
from / written through to a Supabase repository**. The dividing line for this report is:
**does the data survive on the server and reach other users?** A rich UI on top of a
`localStorage` store is counted as **🟡 UI-only** (real UI, not persisted), not ✅.

---

# Status Summary

| # | Module | Status | Backend? | Mock data? | UI? | CRUD? |
|---|---|---|---|---|---|---|
| 1 | Authentication | ✅ Complete | Yes (Supabase Auth) | No | Yes | Yes |
| 2 | Owner Bootstrap | ✅ Complete | Yes (service-role CLI) | No | CLI/route | Yes |
| 3 | Organization | 🟡 Partial | Yes (read) | Partly | Yes | Read live, write mock |
| 4 | Employee Management | 🟡 Partial | Yes (directory read) | Partly | Yes | Read live, write mock |
| 5 | RBAC | ✅ Complete | Yes (RLS + perms) | No | Partial | Enforced server-side |
| 6 | Attendance | ✅ Complete | Yes (RPCs) | No | Yes | Yes |
| 7 | Daily Status Reports | 🟡 Partial (near-complete) | Yes (submit + history) | Drafts only | Yes | Submit/read live |
| 8 | Projects | 🟡 Partial (strong) | Yes (hydrate + create) | Overlay only | Yes | Read/create live |
| 9 | Tasks | 🟡 Partial (UI-only) | **No (no table)** | Yes | Yes | localStorage only |
| 10 | Kanban | 🟡 Partial (UI-only) | No | Yes | Yes | localStorage only |
| 11 | Comments | 🟡 Partial (UI-only) | **No (no table)** | Yes | Yes | localStorage only |
| 12 | File Attachments | ❌ Missing | **No (no Storage)** | Yes (fake) | Stub | No real upload |
| 13 | Notifications | 🟡 Partial | Yes (inbox + realtime) | Generation only | Yes | Read/lifecycle live |
| 14 | Time Tracking | 🟡 Partial (UI-only) | **No (no table)** | Yes | Yes | localStorage only |
| 15 | Dashboard | 🟡 Partial (UI-only) | No | Yes | Yes | Read-only mock |
| 16 | Analytics | 🟡 Partial (UI-only) | No | Yes | Yes | Read-only mock |
| 17 | Settings | 🟡 Partial | Yes (partial) | Partly | Yes | Company settings live |
| 18 | Audit Logs | 🟡 Partial | **No (localStorage)** | Yes | Yes | Capture works, not durable |

**Fully live (✅): 4** — Authentication, Owner Bootstrap, RBAC, Attendance.
**Genuinely persisting user data (✅ + strong 🟡): 7** — add Daily Status Reports, Projects,
Notifications (inbox), plus read-only Organization/Employee directory.
**UI-complete but not persisted (🟡 UI-only): Tasks, Kanban, Comments, Time Tracking,
Dashboard, Analytics, Audit.**
**Effectively missing (❌): 1** — File Attachments.

---

# Module-by-Module Detail

## 1. Authentication — ✅ Complete
Real Supabase Auth: email/password login (`features/auth/auth-service.ts:7-32`), logout,
session persistence + auto-refresh (`integrations/supabase/client.ts:50-54`), two-layer
route guard (`routes/_authenticated/route.tsx:20-32`), password reset, email verification
(`routes/auth/*`), open-redirect protection with tests. **Backend:** yes. **Mock:** no.
**Gap (not blocking login):** HR invitation *issuance* is a localStorage mock (§4) — a "sent"
invite does not create a Supabase user.

## 2. Owner Bootstrap — ✅ Complete
Service-role CLI (`scripts/bootstrap.ts` → `repositories/bootstrap/bootstrap.server.ts`),
schema + gating (`migrations/20260702120000_bootstrap_org_registration.sql`),
`is_bootstrapped()`/`public_registration_enabled()` functions, self-signup role-escalation
closed. **Backend:** yes. **Mock:** no.

## 3. Organization — 🟡 Partial
- **Exists:** Real tables (`companies`, `workspaces`, `departments`, `teams`) + services
  (`services/organization/{companies,workspaces,system-settings}.service.ts`) + repositories
  (`repositories/hr/{department,team}.repository.ts`). Departments/teams are **read live** and
  actively used to hydrate Projects and HR.
- **Missing:** Org-management **write** UI. `hr.organization.tsx` and `admin.tsx` render from
  mock stores (`admin` uses `system-store.ts`, a localStorage mock). No create/edit of
  companies/workspaces/departments/teams from the UI against the backend.
- **Backend connected:** partially (reads yes, writes no). **Mock data:** yes for the admin UI.
  **UI:** yes. **CRUD:** read works; create/update/delete are not wired to Supabase.

## 4. Employee Management — 🟡 Partial
- **Exists:** `employees`, `employee_profiles`, `positions`, `employment_types` tables;
  `employeeRepository`; `hr/api.ts` reads the employee **directory** live from Supabase
  (`hr/api.ts:173,204` — `.from("employees")`).
- **Missing:** Employee **mutations** go through `hr/employees-store.ts` — a "localStorage-backed
  reactive *overlay*" (`employees-store.ts:2`), not the backend. Invitations to add employees are
  mock (`hr/invitations-store.ts:2`, hardcoded actor "Amelia Rivera").
- **Backend connected:** read yes, write no. **Mock data:** yes (writes + invitations).
  **UI:** yes (directory, profile, onboarding/offboarding pages). **CRUD:** read live; create/edit
  persist only to localStorage.
- **Note:** `hr/api.ts` also violates the layering rule (uses `db` from `@/services/core` directly).

## 5. RBAC — ✅ Complete
Granular `domain.action` permission catalog (30 perms) as TS source of truth
(`features/auth/permissions.ts`) **mirrored in SQL** (`migrations/20260703120100_*`),
`app_role` enum, `has_role`/`has_any_role`/`has_permission` `SECURITY DEFINER` functions,
RLS on all 38 tables. Enforced **server-side** (not client-spoofable); UI checks are cosmetic.
Drift guarded by tests. **Backend:** yes. **Mock:** no. *(Non-blocking integrity notes:
some RLS write policies are column-unrestricted — see PRODUCTION_GAP_ANALYSIS H1.)*

## 6. Attendance — ✅ Complete
Reference live implementation: `features/attendance/api.ts` + `queries.ts`, atomic
`start_work_session`/`start_break`/`end_break`/`finish_work_session` RPCs, history + team
board, TanStack Query keys/staleTime. **Backend:** yes. **Mock:** no. **CRUD:** yes.
*(Note: attendance UI/hooks query Supabase directly, bypassing a repository — architecture
smell, not a functional gap. Self-writable metrics integrity hole exists — see gap analysis.)*

## 7. Daily Status Reports — 🟡 Partial (near-complete)
- **Exists:** Check-in / Midday / EOD all persist **submission + history** to Supabase via
  `statusUpdateRepository` / `dailyReportRepository` (`checkin/store.ts:100-121`,
  `midday/store.ts:105-126`, `eod/store.ts:104-135`). Tables `daily_reports`,
  `daily_status_updates` exist. Submit + own-history read work end-to-end.
- **Missing:** Drafts are localStorage (working state, fine); manager rollup/review UI wiring and
  submission-triggered notifications are not complete; blocker/task links reference not-yet-real
  Tasks/Dependencies.
- **Backend connected:** yes (submit + read). **Mock:** drafts only. **UI:** yes. **CRUD:**
  create (submit) + read live; update/delete partial.

## 8. Projects — 🟡 Partial (strong)
- **Exists:** Store **hydrates from Supabase** — `projectRepository.list()`, plus members,
  milestones, activity, risks, and employee/department directory (`projects/store.ts:167-216`).
  Project **create** writes through `projectRepository.create` + member assignment
  (`store.ts:344-365`). Tables `projects`, `project_members`, `milestones`, `epics`,
  `project_activity`, `project_risks`, `project_roles` exist with RLS.
- **Missing:** Some mutations (favorites, templates, certain edits) persist to a localStorage
  overlay rather than the backend; derived stats (progress/openTasks) depend on Tasks which
  is not real yet. Clients/templates are mock.
- **Backend connected:** yes (read + create). **Mock:** overlay for some fields. **UI:** yes
  (dashboard, create dialog, detail). **CRUD:** read + create live; update/delete partial.

## 9. Tasks — 🟡 Partial (UI-only, **not persisted**)
- **Exists:** The richest UI in the app (list, detail, kanban, filters, checklist, relations,
  activity) + a full `TasksService`/`TaskRepository` **scaffold**.
- **Missing / critical:** **There is no `tasks` table.** `TasksService` binds
  `table = "tasks"` with the comment "Maps onto the **future** `tasks` table"
  (`services/tasks/tasks.service.ts:17-21`) — calling it would fail at runtime. The UI never
  calls it: the Tasks feature reads `features/tasks/store.ts` — a "localStorage-backed reactive
  facade" (`store.ts:1-8`). **Zero** Tasks files touch a repository/Supabase.
- **Backend connected:** no. **Mock:** yes (localStorage + `mock-data.ts`). **UI:** yes (rich).
  **CRUD:** works only in the browser's localStorage — not shared, not durable.

## 10. Kanban — 🟡 Partial (UI-only)
Board UI + drag/order + column config in `features/kanban/store.ts` (localStorage). Reads the
tasks store; owns no data. No persistence table. **Backend:** no. **Mock:** yes. **UI:** yes.
**CRUD:** localStorage only.

## 11. Comments — 🟡 Partial (UI-only, **not persisted**)
Three divergent mock shapes exist (`task-communication` threaded comments,
`tasks` flat comments, `dependencies` comments) — all localStorage, **no `comments` table**.
Threading, mentions, reactions, soft-delete are implemented in-memory only.
**Backend:** no. **Mock:** yes. **UI:** yes. **CRUD:** localStorage only.

## 12. File Attachments — ❌ Missing
No Supabase **Storage** buckets or `attachments` table anywhere. "Uploads" create a fake blob
`previewUrl` in memory (`task-communication/types.ts` → `TaskFile`). UI upload widgets exist but
do nothing durable. **Backend:** no. **Mock:** yes (fake). **UI:** stub. **CRUD:** none.

## 13. Notifications — 🟡 Partial
- **Exists:** Inbox is **live** — hydrated from `notificationRepository.inbox(userId)` with a
  **realtime** subscription, and the full lifecycle (read/unread/mark-all/archive/dismiss)
  persists through the repository (`notifications/store.ts:61-161`). Tables `notifications`,
  `notification_preferences`, `mentions` exist.
- **Missing:** Notification **generation** still runs through an in-memory engine
  (`event-bus.ts`/`automation-engine.ts`/`rules.ts`) rather than server-side triggers/Edge
  Functions, so real domain events don't yet fan out to persisted notifications. Preferences UI
  is partly mock.
- **Backend connected:** yes (read + lifecycle + realtime). **Mock:** generation/preferences.
  **UI:** yes. **CRUD:** read/update live; server-side creation missing.

## 14. Time Tracking — 🟡 Partial (UI-only)
Timer + manual entries + floating active timer, all in `features/time-tracking/store.ts`
(localStorage). **No `time_logs` table.** **Backend:** no. **Mock:** yes. **UI:** yes.
**CRUD:** localStorage only.

## 15. Dashboard — 🟡 Partial (UI-only)
Renders from `features/dashboard/mock-data.ts` (and manager/executive mock data). No backend
aggregation. **Backend:** no. **Mock:** yes. **UI:** yes. **CRUD:** read-only mock.

## 16. Analytics — 🟡 Partial (UI-only)
KPI/trend/benchmark dashboards from `features/analytics/mock-data.ts`; `kpi-calculators.ts`
compute over mock inputs. No SQL views/aggregation; saved reports are mock. **Backend:** no.
**Mock:** yes. **UI:** yes. **CRUD:** read-only mock.

## 17. Settings — 🟡 Partial
- **Exists:** `company_settings` (singleton) is **live** and used by Attendance;
  `system_settings` table + `services/organization/system-settings.service.ts` exist.
- **Missing:** Workspace/company settings **UI** (`features/projects/components/workspace-settings.tsx`)
  uses static defaults from `projects/types.ts` — not wired to `company_settings`/`system_settings`.
- **Backend connected:** partially. **Mock:** workspace settings UI. **UI:** yes. **CRUD:**
  attendance company settings live; general settings not wired.

## 18. Audit Logs — 🟡 Partial
- **Exists:** `features/audit/audit-store.ts` captures events and **is actually called at 19 real
  sites** (login/logout, employee CRUD, projects, admin, invitations); audit UI exists.
- **Missing / critical:** It is a **localStorage** mock (capped 500 events), explicitly
  "Mirrors a future append-only Supabase `audit_logs` table." **No table, no service.** Records
  live only in the browser — not durable, not tamper-proof, not server-side.
- **Backend connected:** no. **Mock:** yes. **UI:** yes. **CRUD:** capture works locally only.

---

# Fastest Path to a Usable 10-Person MVP "Tomorrow"

**Strategy: ship the live spine, degrade or hide the un-persisted modules, and add only the
one persistence piece that hurts most to lack.** Do **not** attempt to back all mock modules
before launch — that is the multi-month roadmap in `PRODUCTION_GAP_ANALYSIS.md`. For 10
colleagues who trust each other, single-device localStorage for a few modules is a tolerable
day-1 compromise; missing multi-user *core* collaboration is not.

## What already works for 10 people today (the spine)
Authentication, Owner Bootstrap, RBAC, Attendance, Daily Status Reports (submit + history),
Projects (create + view), Employee **directory** (read), Notifications **inbox**. This is a
coherent "remote-company daily-ops" product on its own: sign in → check in → submit daily
reports → see projects → get notified.

## Day-1 setup runbook (hours, not weeks)
1. **Provision Supabase** and apply all 13 migrations (project ref `abricapxjjiopxqrycvu`
   is already in `supabase/config.toml`). Confirm RLS is applied.
2. **Fill `.env`** (server + `VITE_` keys) and run `bun run validate:env`.
3. **Bootstrap the owner:** `bun run bootstrap` (creates the org + first owner via service-role).
4. **Create the 9 other employees.** Because invite *issuance* is mock (§4), the reliable path
   tomorrow is: create their auth users in the **Supabase dashboard** (the `handle_new_user`
   trigger auto-creates their `profiles` + default role), then assign roles/departments.
   *(This is the single biggest onboarding friction — see quick-win Q1.)*
5. **Run Prettier** (`npm run format`) so CI is green, and deploy via the existing Docker/CI
   pipeline (it's production-ready).
6. **Label or hide** the not-persisted routes (Analytics, Dashboard widgets fed by mock,
   Time Tracking, Kanban, standalone Comments) as "Preview" so no one trusts them with real data.

## The one persistence piece worth adding before launch
- **Tasks (+ a minimal Kanban persist).** It's the highest-fan-out core surface and the thing a
  software company will immediately try to use collaboratively. The UI, `TasksService`, and
  `TaskRepository` scaffolds already exist and bind to `table = "tasks"` — the missing piece is
  the **schema**. A minimal `tasks` table (id, project_id, title, description, status, priority,
  assignee_id, parent_task_id, sprint_id, created/updated) + RLS + wiring the store's read/write
  to `taskRepository` (mirroring how `projects/store.ts` already hydrates + writes through) makes
  Tasks real. **Est: 3–5 days** for a minimal cut — the only sub-week item that materially
  upgrades the MVP from "attendance/reports tool" to "work-management tool."

## Prioritized quick wins (ordered by value-to-effort for the MVP)
| # | Quick win | Why | Effort |
|---|---|---|---|
| Q1 | Real invitation issuance (server fn: create auth user + profile + role) | Removes the dashboard-onboarding friction; lets HR add the 10 people from the UI | 3–5 d |
| Q2 | Minimal `tasks` table + wire tasks store to `taskRepository` | Turns the flagship module from single-device mock into shared, persisted work | 3–5 d |
| Q3 | Durable `audit_logs` table + swap `recordAudit` internals | Capture code already calls 19 sites; only the sink is missing — cheap durability/compliance win | ~1 d |
| Q4 | Wire Notifications **generation** for task-assigned/report-submitted | Inbox + realtime already live; only server-side creation is missing | 2–3 d |
| Q5 | Fix the RLS self-write integrity holes (attendance/reports/profile) | Prevents employees falsifying their own attendance/reports on a real deployment | 3–5 d |

## What to explicitly defer past day 1 (accept as-is or hide)
Comments, File Attachments (no Storage yet), Time Tracking, Analytics, Dashboard aggregation,
Sprints, Dependencies, AI Assistant (provider layer is stubbed). None of these block a 10-person
daily-ops launch; all are on the phased roadmap in `PRODUCTION_GAP_ANALYSIS.md`.

## Minimal viable launch scope (recommendation)
**Spine (live today) + Tasks persisted (Q2) + real invites (Q1) + durable audit (Q3).**
That is roughly **~1.5–2 weeks** of focused work and yields a genuinely multi-user product for
10 people: onboarding, RBAC, attendance, daily reports, projects, shared tasks, notifications,
and a real audit trail — with the remaining modules clearly marked "Preview" until the roadmap
backs them.
