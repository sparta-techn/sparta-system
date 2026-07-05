# Implementation Roadmap — SpartaFlow Hub

A milestone-based plan to take SpartaFlow Hub from empty repo to production EOS. Each milestone is shippable and independently valuable. Estimates use a **T-shirt + week range** (S ≈ 1w, M ≈ 2–3w, L ≈ 4–6w, XL ≈ 6–10w) for a team of ~3 engineers + 1 designer.

---

## Milestone 0 — Foundations (S, ~1 week)

**Objective:** Walking skeleton; the team can deploy on day one.

**Features / Work**
- Repo bootstrap (Next.js, TS, Tailwind, shadcn, ESLint boundaries, Prettier, Husky).
- Supabase project provisioning (dev/staging/prod).
- CI/CD (lint, typecheck, tests, build, preview deploy on PR).
- Sentry + PostHog wiring.
- Folder structure as in `FolderStructure.md`.
- Base providers (Query, Theme, Auth, Toast, Realtime).
- Design tokens + theme.

**Dependencies:** none.
**Complexity:** S.
**Risks:** initial RLS plumbing complexity.
**Acceptance:** an authenticated "Hello, world" page deploys to staging via CI.
**Definition of Done:** all gates green; runbook written; secrets in Vault; on-call rota stub.

---

## Milestone 1 — Identity & Org (M, ~2 weeks)

**Objective:** Real users with real roles in real teams.

**Features**
- Supabase Auth (Email + Google), MFA available.
- `profiles`, `departments`, `teams`, `user_roles`.
- `has_role` SECURITY DEFINER helpers.
- Middleware + route guards.
- Admin: minimal screens to create departments, teams, assign roles.
- Settings: profile, timezone, password.

**Dependencies:** M0.
**Complexity:** M.
**Risks:** OAuth redirect handling; role bootstrap.
**Acceptance:** an Owner can invite a user, assign a role, and the user lands on the correct dashboard scope.
**DoD:** RBAC matrix tests passing; audit log entries written for role grants.

---

## Milestone 2 — Attendance MVP (M, ~2 weeks)

**Objective:** Every employee can complete attendance flow.

**Features**
- Start Work, Break, Finish Work.
- Late + break-overage detection.
- Personal attendance history.
- HR override (audited).
- Today widget on dashboard.

**Dependencies:** M1.
**Complexity:** M.
**Risks:** timezone correctness; idempotency.
**Acceptance:** 100% of pilot users complete a day inside SpartaFlow.
**DoD:** unit + E2E tests for state machine; idempotency keys verified.

---

## Milestone 3 — Daily Workflow (M, ~3 weeks)

**Objective:** Morning, Midday, EOD flows live; daily friction < 2 minutes.

**Features**
- Morning Check-in form + autosave.
- Midday Status form.
- End-of-Day Report form + attachments.
- Workflow stepper on dashboard.
- Late-report nudges via notification.

**Dependencies:** M1, M2.
**Complexity:** M.
**Risks:** form UX friction; mobile usability.
**Acceptance:** median full-flow time < 2 minutes in pilot.
**DoD:** Accessibility audit pass; mobile usability tested; analytics events instrumented.

---

## Milestone 4 — Dependencies (M, ~2 weeks)

**Objective:** Cross-person blockers tracked with SLAs.

**Features**
- Create / acknowledge / resolve / escalate.
- Personal "my dependencies" view.
- Aging + priority.
- Notifications.

**Dependencies:** M1, M5 (notifications partial).
**Complexity:** M.
**Risks:** notification noise.
**Acceptance:** median resolution time visible; manager response time < 2 h in pilot.
**DoD:** Realtime updates; audit on escalations.

---

## Milestone 5 — Notifications & Announcements (M, ~2 weeks)

**Objective:** In-app + email signals; HR can broadcast.

**Features**
- Notification center, preferences.
- Email channel (Resend/SES).
- Announcements with audience targeting + read receipts.

**Dependencies:** M1.
**Complexity:** M.
**Risks:** deliverability; preference sprawl.
**Acceptance:** announcement read rate ≥ 85% within 24 h in pilot.
**DoD:** dead-letter queue; per-event templates documented.

---

## Milestone 6 — Manager & HR Dashboards (M, ~3 weeks)

**Objective:** Visibility loop closes.

**Features**
- Team Lead dashboard.
- PM cross-team board.
- HR dashboard (attendance, late list, directory).
- Basic CSV exports.
- Realtime presence.

**Dependencies:** M2, M3, M4.
**Complexity:** M.
**Risks:** dashboard performance under load.
**Acceptance:** Time-to-status < 30 s.
**DoD:** materialized aggregates; P95 page load < 2 s on staging.

---

## Milestone 7 — Leaves & HR Operations (M, ~3 weeks)

**Objective:** Leaves managed end-to-end.

**Features**
- Leave request + approval flow.
- Balances + team calendar.
- Onboarding checklist for new employees.

**Dependencies:** M1, M5.
**Complexity:** M.
**Risks:** balance accrual edge cases.
**Acceptance:** all pilot leaves processed via SpartaFlow.
**DoD:** policy-driven rules; audit on approvals.

---

## Milestone 8 — Owner Dashboard & Performance v1 (M, ~3 weeks)

**Objective:** Strategic visibility for the Owner.

**Features**
- Company Health Score (composite).
- Department comparison.
- Performance trends per scope.
- Weekly digest.

**Dependencies:** M2–M7.
**Complexity:** M.
**Risks:** misleading metrics.
**Acceptance:** Owner opens dashboard daily; metrics validated against raw data.
**DoD:** metric definitions documented; computation reproducible.

---

## Milestone 9 — ClickUp + Slack Integrations (M, ~3 weeks)

**Objective:** Hub plays well with existing tools.

**Features**
- ClickUp OAuth, project/task linking, read-only surfaces.
- Slack OAuth, notifications to DMs, slash commands (basic).
- Integration health page in Admin.

**Dependencies:** M5.
**Complexity:** M.
**Risks:** rate limits; OAuth refresh.
**Acceptance:** ≥ 70% of EOD reports link at least one ClickUp task in pilot.
**DoD:** circuit breakers; webhook replay; contract tests.

---

## Milestone 10 — Audit, Security, Compliance Hardening (M, ~2 weeks)

**Objective:** Production-grade security posture.

**Features**
- Full audit log surface for HR/Super Admin.
- MFA enforcement (Owner, HR, Super Admin).
- Session management UI.
- CSP + headers final pass.
- RLS policy test suite at 100% coverage.
- Penetration test fixes.

**Dependencies:** M1+.
**Complexity:** M.
**Risks:** late-stage RLS gaps.
**Acceptance:** external pentest with no high/critical findings.
**DoD:** security memory updated; incident runbook drilled.

---

## Milestone 11 — General Availability (S, ~1 week)

**Objective:** Roll out to 100% of SpartaFlow.

- Migration of historical data (if any).
- Training session + in-app guided tour.
- Support channel + feedback loop.
- KPI dashboards reviewed.

**Acceptance:** ≥ 90% daily adoption sustained over 30 days.

---

## Phase 2 — Intelligence & Integrations (XL, ~Quarter 2)

- AI daily summaries, blocker detection, predictive risk alerts.
- GitHub / Figma / Google Calendar integrations.
- Workload heatmap, capacity insights v1.
- PWA + push notifications.
- Public API for internal tools.

---

## Phase 3 — Self-Driving Operating System (XL, Year 2–3)

- Native mobile apps (iOS, Android).
- Conversational interface ("Hey Hub, start my day").
- Capacity planning module.
- Multi-company support.
- Compliance modules (SOC 2 / ISO 27001 evidence pack).

---

## Cross-Cutting Workstreams (Continuous)

| Workstream | Cadence |
|---|---|
| Performance budgets | Every PR |
| Accessibility audits | Per milestone |
| Security review | Per milestone + quarterly |
| Documentation | Per feature (`/docs` updated) |
| Observability dashboards | Per milestone |
| User research | Bi-weekly |

---

## Risk Register (Roadmap-Level)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RLS gaps discovered late | M | H | Policy tests from M1; pentest at M10. |
| Notification fatigue | M | M | Preferences from M5; digest mode; quiet hours by Phase 2. |
| Surveillance perception | M | H | Communications plan; signals-not-keystrokes principle enforced. |
| Integration provider changes | H | M | Adapter pattern isolates blast radius. |
| Adoption stall after launch | M | H | Manager enablement; in-app tour; KPI gating. |

---

## Definition of Done (Applies to Every Milestone)

- All acceptance criteria met and demoed.
- Unit + integration + E2E tests passing; critical paths ≥ 70% coverage.
- RLS policies tested per role.
- Accessibility: WCAG 2.1 AA on new flows.
- Performance budgets respected.
- Observability: dashboards + alerts in place.
- Docs in `/docs` updated; changelog entry written.
- Runbook updated for any new operational surface.
- Security review checklist signed off.
- Feature flag plan defined for safe rollout/rollback.
