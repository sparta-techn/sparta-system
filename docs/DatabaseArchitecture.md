# Database Architecture — SpartaFlow Hub

Conceptual entity model for the PostgreSQL database behind SpartaFlow Hub. **No SQL** — this document defines entities, relationships, ownership, lifecycle, and integrity rules so the implementation team can write the schema with full context.

Global conventions:
- Every entity has `id (uuid)`, `created_at`, `updated_at`.
- Soft-deletion via `deleted_at` for user-visible records; hard delete for log-only data after retention.
- All timestamps stored in UTC.
- Tenancy assumption: single SpartaFlow tenant now; entities carry `organization_id` so multi-tenant is a non-breaking future change.
- Every table in `public` has explicit GRANTs and RLS enabled.

---

## 1. Identity & Org Structure

### User
- **Purpose:** Authenticated person.
- **Owned by:** Supabase Auth (`auth.users`); `profiles` extends it 1:1.
- **Relationships:** belongs to one Department, many Teams, has many Roles via `user_roles`.
- **Lifecycle:** invited → active → suspended → offboarded (soft-deleted; data retained per policy).

### Profile
- **Purpose:** Public-facing user data (display name, avatar, timezone, locale, title).
- **Relationships:** 1:1 with User.
- **Ownership:** User edits own profile; HR/Admin can edit any.

### Department
- **Purpose:** Top-level org unit (Backend, Flutter, AI, DevOps, Design…).
- **Relationships:** has many Teams, has many Users, has one Lead.

### Team
- **Purpose:** Sub-unit under a Department (or cross-functional squad).
- **Relationships:** belongs to Department; has many Members (via `team_members`); has one Team Lead.
- **Lifecycle:** active → archived.

### Role
- **Purpose:** Enum of system roles (owner, super_admin, hr, pm, team_lead, employee, viewer). See `RBAC.md`.

### UserRole
- **Purpose:** Many-to-many between User and Role with optional `scope` (team_id / department_id / project_id).
- **Why separate table:** prevents privilege escalation; never store role on `profiles`.

### Permission
- **Purpose:** Atomic capability (e.g. `attendance.override`, `leaves.approve`). Defined as enum; not user-editable.

### Project
- **Purpose:** Project the company is delivering; links to ClickUp project.
- **Relationships:** has many Teams, has a PM, links to external ClickUp ID.

---

## 2. Attendance & Workflow

### Attendance
- **Purpose:** One record per User per working day.
- **Fields (conceptual):** date, start_at, finish_at, status (on_time | late | absent | excused), notes.
- **Relationships:** belongs to User; has many Breaks.
- **Lifecycle:** created on first Start Work of the day; closed on Finish Work; HR may override (audited).

### Break
- **Purpose:** Pause within a workday.
- **Relationships:** belongs to Attendance.
- **Lifecycle:** started → ended; total break minutes computed for compliance with 1h cap.

### MorningCheckIn
- **Purpose:** Daily plan submission.
- **Fields:** focus, planned_tasks (links to ClickUp ids), planned_dependencies, mood (optional).
- **Relationships:** belongs to User; 1 per User per day.

### MiddayStatus
- **Purpose:** Pulse update.
- **Fields:** progress_pct, blockers_summary.
- **Relationships:** belongs to User; 1 per User per day (optional).

### EndOfDayReport
- **Purpose:** Closing report.
- **Fields:** completed, pending, blocked, attachments[], task_outcomes[].
- **Relationships:** belongs to User; 1 per User per day; emits `report.submitted` event.

### LeaveRequest
- **Purpose:** Time-off request and approval.
- **Fields:** type (vacation, sick, personal…), start_date, end_date, reason, status (pending | approved | rejected | cancelled), approver_id.
- **Lifecycle:** requested → approved/rejected → (optionally) cancelled. Approved leaves affect Attendance auto-status.

### WorkingRule
- **Purpose:** Configurable rules (arrival window, break cap, weekend definition) per Department or globally.

---

## 3. Collaboration

### Dependency
- **Purpose:** A blocker / handoff between two people or teams with an SLA.
- **Fields:** title, description, priority, requested_by, requested_from (user or team), status (open | acknowledged | resolved | escalated | cancelled), opened_at, acknowledged_at, resolved_at, due_at.
- **Relationships:** linked optionally to Project, EndOfDayReport, ClickUp task.
- **Lifecycle:** open → acknowledged → resolved (or escalated). Aging metrics derived from timestamps.

### DependencyComment
- **Purpose:** Threaded discussion on a dependency.
- **Relationships:** belongs to Dependency and User.

### Announcement
- **Purpose:** Targeted broadcast.
- **Fields:** title, body (rich text), audience (company | department_ids | team_ids | user_ids), pinned, expires_at.
- **Relationships:** has many AnnouncementReads.
- **Ownership:** HR, Owner, Department Leads (scoped).

### AnnouncementRead
- **Purpose:** Read receipt per User per Announcement.

---

## 4. Notifications

### Notification
- **Purpose:** In-app message addressed to a User.
- **Fields:** event_type, payload (jsonb), severity, read_at, action_url.
- **Lifecycle:** created → delivered → read → archived (after N days).

### NotificationPreference
- **Purpose:** Per-User per-event channel preferences (in_app, email, slack).

### NotificationDelivery
- **Purpose:** Audit of outbound deliveries per channel with status (queued | sent | failed | retried).

---

## 5. Performance & Reporting

### PerformanceMetric
- **Purpose:** Derived metric snapshot per scope (user/team/dept) per period.
- **Why a table:** allows historical trend without recomputing.
- **Fields:** scope_type, scope_id, period (day|week|month), metric_key, value.

### ReportSnapshot
- **Purpose:** Materialized report (e.g. weekly digest) for fast load and historical reference.

### CompanyHealthScore
- **Purpose:** Daily composite score for the Owner dashboard.

---

## 6. Integrations

### IntegrationAccount
- **Purpose:** Connection to an external system (ClickUp workspace, Slack workspace, GitHub org).
- **Fields:** provider, scope, encrypted_credentials (Vault), status.

### IntegrationLink
- **Purpose:** Maps a SpartaFlow entity to an external entity (e.g. `Project ↔ ClickUp space`, `User ↔ Slack user`).

### IntegrationEvent
- **Purpose:** Inbound webhook events (raw + parsed) for replay and debugging.

---

## 7. Audit & System

### AuditLog
- **Purpose:** Append-only record of sensitive actions.
- **Fields:** actor_id, action, target_type, target_id, before, after, ip, correlation_id, occurred_at.
- **Lifecycle:** insert-only; retained ≥ 1 year; exportable.

### FeatureFlag
- **Purpose:** Boolean / percentage flags evaluated server-side.

### Session
- **Purpose:** Active session metadata for "where am I signed in" UI (separate from Supabase internal sessions).

### Attachment
- **Purpose:** Metadata row for any file uploaded to Storage (bucket, path, mime, size, owner, parent reference).

### DomainEventOutbox
- **Purpose:** Reliable event delivery — events are written transactionally with the source change and dispatched by a worker.

---

## 8. Relationships at a Glance

```text
User ──< UserRole >── Role
User ── Profile
User >── Team ──< Department
User ──< Attendance ──< Break
User ──< MorningCheckIn / MiddayStatus / EndOfDayReport
User ──< LeaveRequest
User ──< Notification
Dependency ── User(requested_by) ── User|Team(requested_from)
Dependency ──< DependencyComment
Announcement ──< AnnouncementRead
Project ── Team ── Department
IntegrationAccount ──< IntegrationLink
Any privileged write → AuditLog
Any state change → DomainEventOutbox
```

---

## 9. Ownership & Access Rules (RLS Intent)

| Entity | Read | Write |
|---|---|---|
| Profile | All authenticated | Owner of profile; HR/Admin |
| Attendance | Self; user's team lead; PM; HR; Owner | Self (status actions); HR (override) |
| Workflow entries | Self; manager chain; HR; Owner | Self; HR (correction with audit) |
| Dependency | Participants; their managers; PM; Owner | Participants (state transitions per role) |
| Announcement | Audience members | Authors with role scope |
| Notification | Recipient | Recipient (read state) |
| AuditLog | HR; Super Admin; Owner | System only |
| IntegrationAccount | Super Admin; Owner | Super Admin; Owner |

All policies use a `has_role(user_id, role)` SECURITY DEFINER helper plus scope checks (`is_in_team`, `manages_team`).

---

## 10. Lifecycle, Retention, and Soft Delete

| Entity | Retention | Delete mode |
|---|---|---|
| Attendance, Workflow | 7 years (compliance) | Soft delete; redact on user request per GDPR |
| Notifications | 90 days then archive | Hard delete after archive |
| AuditLog | ≥ 1 year (longer for regulated) | Hard delete after retention |
| IntegrationEvent | 30 days | Hard delete |
| User | Soft-deleted on offboarding; HR can purge per policy | Cascade soft delete via `deleted_at` |

---

## 11. Integrity Rules (Domain-Level)

- One Attendance per User per date (unique constraint).
- One Morning / Midday / EOD per User per date.
- Dependency cannot be self-referencing (requested_by ≠ requested_from when user-to-user).
- LeaveRequest end_date ≥ start_date.
- AnnouncementRead unique per (announcement, user).
- AuditLog is insert-only — enforced by trigger and revoked update/delete grants.
