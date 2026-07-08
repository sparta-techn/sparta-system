# SpartaFlow — Collaboration Implementation Plan

> Planning document only. **No code or migration is written here; the application
> is not modified.** Target implementation for the Collaboration layer, derived
> from `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, the live
> migrations, and the existing feature `types.ts` / stores.
> Snapshot date: 2026-07-01.

Covers: **Notifications · Activity Feed · Mentions · Approvals · Inbox ·
Dependency Requests · Realtime Events**. Each feature specifies Database,
Services, Repositories, UI, Realtime events, and Permissions.

---

## 0. Current state (what to reuse, not rebuild)

| Capability              | Status today                                                                                                                                                                                                                                                                                                                                                                                                             | Reuse target                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notification engine** | Frontend-complete, **mock** (`features/notifications/`): `event-bus.ts` → `automation-engine.ts` → `rules.ts` → `channels.ts` → `store.ts` (localStorage). Types: `DomainEvent`, `EventName`, `AppNotification`, `AutomationRule`, `NotificationSpec`, `RecipientRule`, `NotificationPreferences` (quiet hours). UI: `notification-dropdown`, `notification-center`, `notification-preferences`, `notification-widgets`. | Keep the event/rule DSL as the contract; move generation + storage server-side. Swap store internals for Supabase + realtime; **UI unchanged**. |
| **Task comments/files** | Mock (`features/task-communication/`): `TaskThreadComment` (mentions[], reactions[], threads, soft delete), `TaskFile`, `TaskCommActivity`. UI: `threaded-comments`, `comment-composer`, `comment-item`, `communication-activity`, `task-files-panel`.                                                                                                                                                                   | → polymorphic `comments` + `comment_reactions` + `attachments`.                                                                                 |
| **Dependencies**        | Mock (`features/dependencies/`) **but** `public.dependency_requests` **exists** (migration `20260630130000`) with the state enum + RLS. Embedded `comments[]` + `activity[]` in the mock.                                                                                                                                                                                                                                | Wire the mock store to the live table; add `dependency_activity`, comments, and a state-machine RPC.                                            |
| **Project activity**    | **Live**: `public.project_activity` (append-only) + `projectActivityRepository`.                                                                                                                                                                                                                                                                                                                                         | The activity-feed backbone; generalize the pattern to tasks/dependencies.                                                                       |
| **Manager surfaces**    | Mock consumers: `live-activity-feed`, `notifications-panel`, `blockers-panel`, `report-compliance`.                                                                                                                                                                                                                                                                                                                      | Inbox/Activity-Feed data sources feed these.                                                                                                    |
| **Approvals / Inbox**   | **Do not exist** (no feature, no table).                                                                                                                                                                                                                                                                                                                                                                                 | Net-new — Sections 4 & 5.                                                                                                                       |
| **Realtime**            | **Not wired anywhere.** `work_sessions` are in the `supabase_realtime` publication but no client subscribes.                                                                                                                                                                                                                                                                                                             | Section 7 builds the transport.                                                                                                                 |
| **Auth/RLS helpers**    | Live: `has_role`, `has_any_role`, `can_review_reports`, `is_project_member`, `can_manage_project`, `tg_set_updated_at`, `handle_new_user`.                                                                                                                                                                                                                                                                               | Reuse verbatim; add `can_access_dependency`, `can_approve`, `is_mentioned_in`.                                                                  |

**Conventions inherited (all new work MUST follow):** `uuid` PKs, `created_at`/
`updated_at` + `tg_set_updated_at`, `created_by`/`actor_id` audit
(`DEFAULT auth.uid()`), RLS on every table, grants to `authenticated`/
`service_role` only, `SECURITY DEFINER` helpers with pinned `search_path`,
services extend `BaseService<Row,Insert,Update>` over the relaxed `db` client,
repositories are injected singletons under `src/repositories/<domain>/` (own
barrel, not in the root barrel), mock features are connected by the documented
**store-internal swap** (public API unchanged). Append-only tables grant
SELECT/INSERT only and reject update/remove at the service layer.

### New enums (add once, reuse across features)

```
notification_type     : info, success, warning, critical, reminder
notification_priority : low, normal, high, critical
notification_state    : unseen, seen, read, archived, dismissed
delivery_channel      : in_app, email, slack, teams, telegram, whatsapp, push, sms
preference_category   : attendance, dependencies, announcements, reports, mentions, system, approvals
comment_parent        : task, dependency, project
activity_source       : task, dependency, project, sprint, report, membership
approval_type         : eod_report, dependency_request, project_membership, role_grant,
                        leave_request, timesheet, generic
approval_status       : pending, approved, rejected, cancelled, expired
inbox_item_kind       : notification, mention, approval, dependency, assignment
```

### Cross-cutting: how domain events become collaboration rows

One canonical path, so notifications/mentions/activity/approvals stay consistent:

```
domain write (task assigned, comment w/ mention, dependency state change, EOD submit…)
   │  calls a SECURITY DEFINER RPC or fires an AFTER trigger
   ▼
emit_event(name, actor, subject, payload)   →  writes public.events (outbox, append-only)
   ▼  AFTER INSERT trigger on events (SECURITY DEFINER)
   ├─ fan-out to notifications (per matched rule + recipient resolution + prefs/quiet-hours)
   ├─ fan-out to activity feed (activity rows)
   └─ fan-out to approvals (when the event requires a decision)
   ▼  each target table is in the supabase_realtime publication
Realtime delivers the new rows to subscribed clients (Section 7).
```

- **MVP generation**: SQL trigger functions (one per event family) — deterministic,
  transactional, no extra infra.
- **Complex targeting** (the existing `RecipientRule` DSL, dept/manager fan-out,
  channel routing to email/slack): a Supabase **Edge Function** worker drains the
  `events` outbox and runs the existing TS engine server-side, then inserts
  notifications via the service role. This preserves `rules.ts`/`automation-engine.ts`
  as the source of truth instead of re-encoding it in SQL.

---

## 1. Notifications

### Database

- `public.notifications` (per `DATABASE_DESIGN.md §17`):
  `id`, `recipient_id → profiles CASCADE`, `type notification_type`,
  `priority notification_priority default 'normal'`, `state notification_state
default 'unseen'`, `title`, `body`, `category preference_category`,
  `event_id uuid → events(id) SET NULL`, `event_name text`, `payload jsonb`,
  `actions jsonb` (`[{label,href,kind}]`), `entity_type text`, `entity_id uuid`,
  `href text`, `seen_at`/`read_at`/`archived_at`/`dismissed_at`/`expires_at
timestamptz`, `created_at`.
  - **Indexes**: `(recipient_id, created_at DESC)`, partial
    `(recipient_id) WHERE state = 'unseen'` (badge count), `(entity_type, entity_id)`.
- `public.notification_preferences` (`user_id PK → profiles`, `categories jsonb`,
  `channels jsonb`, `quiet_hours jsonb {start,end,enabled}`) — one row per user;
  mirrors `NotificationPreferences`.
- `public.events` (outbox, append-only): `id`, `name text`, `category text`,
  `actor_id`, `subject_id`, `payload jsonb`, `occurred_at`, `processed_at` — the
  generation source; mirrors `DomainEvent`.
- **Generation**: `notify(recipients, spec)` SECURITY DEFINER helper (service-only
  insert); trigger `tg_fanout_event` on `events`. Users **never** insert others'
  notifications.

### Services (`src/services/notifications/`)

- `NotificationsService extends BaseService<NotificationRow, NotificationInsert, NotificationUpdate>` — table `notifications`; finders `listForRecipient(userId, {state?})`, `unseenCount(userId)`; lifecycle `markSeen`, `markRead`, `markAllRead`, `archive`, `dismiss` (state + `*_at` stamps).
- `NotificationPreferencesService` — `get(userId)`, `upsert(userId, patch)` (typed client; single row).
- `EventsService` — append-only (`log(event)`); `update`/`remove` reject.
- Reuse the existing pure modules unchanged: `rules.ts`, `automation-engine.ts`,
  `channels.ts`, `directory.ts`, `preferences.ts` — they define specs; only the
  sink changes.

### Repositories (`src/repositories/notifications/`)

- `NotificationRepository` — `inbox(userId, filter)`, `badgeCount(userId)`,
  `markRead`/`markAllRead`/`archive`/`dismiss`, `emit(event)` (writes `events`,
  lets the trigger/worker fan out). Composes `NotificationsService` +
  `EventsService`.
- `NotificationPreferenceRepository` — `get`/`update`, exposes the category/channel
  matrix used by `notification-preferences.tsx`.

### UI (reuse existing — swap data source only)

- `notification-dropdown`, `notification-center`, `notification-preferences`,
  `notification-widgets` stay as-is. Swap `notifications/store.ts` internals to
  hydrate from `NotificationRepository` + realtime, keeping `notificationStore`,
  `useNotifications`, `useUnreadCount` signatures identical.

### Realtime events

- Publication: add `notifications`. Client subscribes to
  `postgres_changes` on `notifications WHERE recipient_id = auth.uid()` → prepend
  to cache, bump badge, toast on `INSERT` (respecting quiet hours/prefs client-side
  as a second gate). `UPDATE` syncs read/dismiss across tabs.
- Channel: `notifications:{userId}`.

### Permissions

- RLS: recipient reads/updates **own only** —
  `USING (recipient_id = auth.uid())`, `WITH CHECK (recipient_id = auth.uid())`,
  and updates limited to state/`*_at` columns. **No client INSERT** grant; inserts
  via `notify(...)` SECURITY DEFINER / service role only.
- `notification_preferences`: self read+write (`user_id = auth.uid()`).
- `events`: no client access; SECURITY DEFINER writers + service role only.

---

## 2. Activity Feed

### Database

- Backbone exists: `public.project_activity` (append-only). Add the siblings with
  the same shape so a **unified feed** is a UNION:
  - `public.task_activity` (`task_id → tasks CASCADE`, `actor_id`, `kind`,
    `summary`, `meta jsonb`, `created_at`) — per `DATABASE_DESIGN.md §10`.
  - `public.dependency_activity` (`dependency_id → dependency_requests CASCADE`,
    `actor_id`, `kind`, `summary`, `meta jsonb`, `created_at`) — per §16.
- **Unified read model**: view `activity_feed` UNION-ing the three sources into
  `(source activity_source, source_id, project_id, actor_id, kind, summary, meta, at)`.
  `project_id` is denormalized onto task/dependency activity (or joined) so the feed
  is filterable and RLS-scopable by project.
- **Population**: `AFTER` triggers on the parent tables
  (`tg_log_task_activity`, `tg_log_dependency_activity`) + the existing repository
  logging for `project_activity`. Append-only (SELECT/INSERT grants only).
- **Indexes**: each table `(<parent>_id, created_at DESC)`, `(actor_id)`.

### Services (`src/services/activity/`)

- `TaskActivityService`, `DependencyActivityService` — append-only
  (`log`, `listByParent`; update/remove reject), mirroring `ProjectActivityService`.
- `ActivityFeedService` — reads the `activity_feed` view: `listForProject`,
  `listForActor`, `listGlobal(limit)`, cursor pagination by `at`.

### Repositories (`src/repositories/activity/`)

- `ActivityFeedRepository` — `forProject(projectId, cursor)`,
  `forUser(userId)`, `recent(scope)`; resolves actor via the profiles directory.
- Existing `projectActivityRepository` is folded in as one source.

### UI (reuse)

- Manager `live-activity-feed.tsx`, project `ProjectActivity` tab, dashboard
  recent-activity widget, `project-analytics` `unifiedActivity` — all repoint to
  `ActivityFeedRepository`. No new components required for MVP; an optional global
  `/app/activity` route composes `Card` + timeline list.

### Realtime events

- Publication: add `task_activity`, `dependency_activity` (project_activity too).
- Subscribe per open project: `activity:project:{projectId}` on
  `postgres_changes INSERT` → prepend to the feed cache. Global feed for
  managers subscribes without the project filter (RLS still scopes rows).

### Permissions

- RLS mirrors the parent entity: task/dependency activity readable when the user
  can read the parent (`is_project_member` / `can_access_dependency` /
  reviewer roles). Append-only; no client UPDATE/DELETE. The `activity_feed` view
  runs `security_invoker = on` so per-source RLS applies.

---

## 3. Mentions

### Database

- No separate table needed initially — mentions live on `public.comments`
  (`DATABASE_DESIGN.md §11`): `mentions uuid[]` (profile ids), GIN-indexed.
  `comments` is polymorphic (`parent_type comment_parent`, `parent_id`,
  `author_id`, `body`, `parent_comment_id`, `is_status_update`, `edited_at`,
  `deleted_at`) with `comment_reactions (comment_id, user_id, emoji)`.
- **Fan-out**: `AFTER INSERT/UPDATE` trigger `tg_comment_mentions` emits a
  `comment.mentioned` event per newly-added mention → notification
  (category `mentions`) + inbox item. Editing a comment diffs old/new mentions so
  re-notifies only the added ones.
- Optional read-model view `my_mentions` = comments where
  `auth.uid() = ANY(mentions) AND deleted_at IS NULL`, joined to parent title, for
  the Inbox "Mentions" tab.
- `MENTIONABLE_USERS` (mock) → resolved from the live `profiles` directory (reuse
  the projects store's people directory pattern / `employeeRepository`).

### Services (`src/services/comments/`)

- `CommentsService extends BaseService` — `listForParent(type, id)`,
  `create` (validates `parent_id` exists via the polymorphic-integrity trigger),
  `edit`, `softDelete`; `mentions` passed through.
- `CommentReactionsService` — `toggle(commentId, userId, emoji)`.

### Repositories (`src/repositories/comments/`)

- `CommentRepository` — `thread(parentType, parentId)` (nests replies),
  `post(input)` (mentions resolved to profile ids), `edit`, `remove`, `react`.
  Mention resolution + emit handled server-side by the trigger; the repo just
  passes `mentions`.
- `MentionRepository` — `listForUser(userId)` over `my_mentions` (Inbox source).

### UI (reuse)

- `threaded-comments`, `comment-composer` (typeahead `@` picker → live profiles),
  `comment-item`, `dep-comments`. Composer swaps `MENTIONABLE_USERS` for the live
  directory; render/threading unchanged.

### Realtime events

- Publication: add `comments`, `comment_reactions`.
- Channel `comments:{parentType}:{parentId}` on `postgres_changes` → live thread
  updates + reaction counts + typing indicator via **broadcast** (ephemeral, not
  persisted; see §7). Mention notifications arrive on the recipient's
  `notifications:{userId}` channel.

### Permissions

- RLS: read a comment if you can read its parent (delegated:
  `is_project_member(project_id)` for task/project, `can_access_dependency` for
  dependency). Insert if you can read the parent; edit/soft-delete **own** only;
  admins moderate. Mentions cannot widen visibility — a mention of a user who
  can't read the parent still fires a notification but the deep-link enforces RLS
  on click.

---

## 4. Approvals

Net-new. A generic approval workflow so any entity can request a decision.

### Database

- `public.approvals`:
  `id`, `type approval_type`, `status approval_status default 'pending'`,
  `entity_type text`, `entity_id uuid` (polymorphic subject),
  `requester_id → profiles`, `assignee_id → profiles` (nullable — the required
  approver), `approver_scope jsonb` (role/manager rule when no single assignee),
  `title`, `summary`, `payload jsonb`, `due_at`, `decided_by → profiles SET NULL`,
  `decided_at`, `decision_note text`, `created_at`/`updated_at`.
  - **Indexes**: `(assignee_id, status)`, `(requester_id)`,
    `(entity_type, entity_id)`, partial `(status) WHERE status = 'pending'`.
- `public.approval_decisions` (append-only audit of each action):
  `approval_id → approvals CASCADE`, `actor_id`, `action approval_status`,
  `note`, `created_at`.
- **Transitions**: `decide_approval(id, decision, note)` SECURITY DEFINER RPC —
  validates the actor is an eligible approver (`can_approve`), stamps
  `decided_by/decided_at/status`, appends a decision row, emits
  `approval.approved` / `approval.rejected` (→ notification to requester + inbox
  update), and applies the **side effect** (e.g. dependency → `accepted`, EOD →
  reviewed, membership → insert `project_members`, role → insert `user_roles`).
- Approvals are created by the domain trigger when an event needs a decision
  (`eod.submitted`, `dependency.created`, membership/role requests).

### Services (`src/services/approvals/`)

- `ApprovalsService extends BaseService` — `listForApprover(userId, {status})`,
  `listForRequester(userId)`, `pendingCount(userId)`, `getForEntity(type,id)`.
- `ApprovalDecisionsService` — append-only history.
- The `decide_approval` RPC is called through the repository, not direct writes.

### Repositories (`src/repositories/approvals/`)

- `ApprovalRepository` — `queue(userId)` (my pending), `raised(userId)`,
  `approve(id, note)`, `reject(id, note)`, `cancel(id)`, `historyFor(id)`.
  `approve`/`reject` call `decide_approval` (atomic + side effect + emit).

### UI (new, composed from reused primitives)

- `features/approvals/components/`: `approval-queue.tsx` (Table of pending, filter
  by type), `approval-card.tsx` (subject preview + Approve/Reject with note
  Dialog), `approval-history.tsx` (Timeline). Route `/app/approvals`. Reuses
  `Card`, `Table`, `Badge`, `Dialog`, `Avatar`, `StatCard`; no new primitives.
- Also surfaced inline: an "Approve/Reject" action on the dependency detail and the
  manager EOD review panel (`report-compliance`).

### Realtime events

- Publication: add `approvals`. Approver subscribes
  `approvals:{userId}` on `postgres_changes` (assignee_id = me) → queue badge +
  toast on new pending. Requester gets the decision via their
  `notifications:{userId}` channel.

### Permissions

- New helper `can_approve(uid, approval_id)` SECURITY DEFINER: true if
  `assignee_id = uid`, or the approver_scope role matches
  (`has_any_role`), or manager-of-requester, or `owner`/`super_admin`.
- RLS: read if requester, assignee, eligible approver, or admin. **No direct
  status writes** — only `decide_approval` (which re-checks `can_approve`). Insert
  via domain triggers / requester-initiated RPC.

---

## 5. Inbox

Net-new **unified read model** — not a new source of truth. One place for
"things needing my attention": notifications + mentions + assigned approvals +
assigned/blocked dependencies.

### Database

- View `public.inbox_items` (`security_invoker = on`) UNION-ing, keyed by
  `(kind inbox_item_kind, source_id)`:
  - unseen/unread `notifications` (recipient = me),
  - `my_mentions` (comments mentioning me, not yet read),
  - pending `approvals` (assignee = me),
  - open `dependency_requests` where I'm `owner_id` (needs action),
    projecting `kind, source_id, title, summary, priority, entity_type, entity_id,
href, at`. RLS applies through each underlying table.
- `public.inbox_state` (per-user overlay for non-notification items):
  `(user_id, kind, source_id) PK`, `status text` (`open`/`snoozed`/`done`),
  `snoozed_until`, `updated_at` — lets a user snooze/complete a mention/approval
  without mutating the source. Notification read-state stays on `notifications`.
- **Index**: `inbox_state (user_id, status)`; the view is ordered by `at DESC`.

### Services (`src/services/inbox/`)

- `InboxService` — `list(userId, {kind?, status?})` over `inbox_items` left-joined
  to `inbox_state`; `counts(userId)` (per-kind badges); `setState(userId, kind,
sourceId, status)`; `snooze(...)`.

### Repositories (`src/repositories/inbox/`)

- `InboxRepository` — `items(userId, filter)`, `unreadCounts(userId)`,
  `markDone`, `snooze`, `openAll` — composes `InboxService` and delegates the
  actual entity actions (mark-read, approve, resolve) to the owning repositories
  so a single click can both act and clear.

### UI (new, reuses notification widgets)

- `features/inbox/components/`: `inbox-list.tsx` (Tabs: All / Mentions / Approvals
  / Dependencies / Notifications), `inbox-item-row.tsx` (icon by `kind`, deep-link,
  snooze/done actions), `inbox-filters.tsx`. Route `/app/inbox`. Topbar bell can
  route here. Reuses `Tabs`, `Card`, `Badge`, `Avatar`, `notification-widgets`.

### Realtime events

- No new publication — the Inbox subscribes to the **same channels** its sources
  use (`notifications:{userId}`, `approvals:{userId}`, mention notifications) and
  invalidates the `inbox_items` query on any of them. `inbox_state` (add to
  publication) syncs snooze/done across tabs.

### Permissions

- The view is `security_invoker` so each row is gated by its source table's RLS —
  the Inbox can never surface something the user couldn't already read.
  `inbox_state`: self read+write (`user_id = auth.uid()`).

---

## 6. Dependency Requests

The cross-team request/blocker board — table already live; complete the
collaboration surface.

### Database

- `public.dependency_requests` **exists** (migration `20260630130000`): state enum
  `draft…closed`, `type`, `priority`, `requester_id`, `owner_id`, `department_id`,
  `related_task_id`, `tags[]`, `due_at`, `resolved_at`, RLS (read:
  requester/owner/same-dept/reviewers; insert self; update party; admin write).
- **Add**:
  - `public.dependency_activity` (§2) — state/priority/assignment history.
  - `project_id uuid → projects(id) SET NULL` column (planned in the attendance
    migration notes) now that projects exist; index `(project_id)`.
  - Comments reuse the polymorphic `comments` table (`parent_type='dependency'`).
- **State machine**: `set_dependency_state(id, new_state, note)` SECURITY DEFINER
  RPC validating allowed transitions (draft→pending→accepted→in_progress→
  resolved→closed; plus blocked/rejected/cancelled), stamping `resolved_at`,
  appending `dependency_activity`, and emitting events
  (`dependency.accepted/blocked/resolved` → notify requester+owner; a new request
  emits `dependency.created` → approval for the owner). Mirrors the attendance
  RPC pattern; replaces free-form UPDATE of `state`.

### Services (`src/services/dependencies/`)

- `DependencyRequestsService extends BaseService` — `listInbox(userId)` (owner=me,
  open), `listRequested(userId)`, `listByState`, `listByProject`,
  `boardColumns()`; state changes go through the RPC wrapper `setState`.
- `DependencyActivityService` — append-only history.

### Repositories (`src/repositories/dependencies/`)

- `DependencyRepository` — `board(filter)`, `create`, `assign(ownerId)`,
  `accept`/`reject`/`block`/`resolve`/`close` (→ `set_dependency_state`),
  `comment`/`thread` (→ `CommentRepository` with `parent_type='dependency'`),
  `activity(id)`. Reuses `commentRepository` + `dependencyActivityService`.

### UI (reuse — store-internal swap)

- `dependencies/store.ts` internals swap to `DependencyRepository`, keeping the
  public API so `dep-kanban`, `dep-table`, `dep-card`, `dep-timeline`,
  `dep-comments`, `dep-create-dialog`, `dep-filters`, `dep-widgets` are unchanged.
  Embedded `comments[]`/`activity[]` in the mock `Dependency` are hydrated from the
  comments + `dependency_activity` tables. People/department pickers source the
  live directory (same fix as the projects module).

### Realtime events

- Publication: add `dependency_requests`, `dependency_activity`.
- Channel `dependencies:board` (or per project/department) on `postgres_changes` →
  live kanban card moves; `dependencies:{id}` for the detail view (activity +
  comments). Owner/requester decision notifications via `notifications:{userId}`.

### Permissions

- Keep existing RLS; add `can_access_dependency(uid, id)` SECURITY DEFINER
  (requester OR owner OR same department OR reviewer role) reused by comments and
  activity RLS. State transitions only via `set_dependency_state` (re-checks the
  actor is requester/owner/admin); direct `state` UPDATE grant removed in favor of
  the RPC.

---

## 7. Realtime Events (transport layer)

The shared subscription infrastructure the six features above ride on.

### Database

- **Publication**: extend `supabase_realtime` to include `notifications`,
  `comments`, `comment_reactions`, `task_activity`, `dependency_activity`,
  `project_activity`, `dependency_requests`, `approvals`, `inbox_state`, `tasks`
  (kanban), and `time_logs` (floating timer) — one `ALTER PUBLICATION` per
  migration that creates the table.
- **Realtime Authorization**: enable RLS-backed authorization on
  `realtime.messages` so **broadcast + presence** channels are gated by policy
  (e.g. only project members can join `presence:project:{id}`). `postgres_changes`
  already respects each table's RLS — a client only receives row events it can
  read, so no data leaks through the socket.
- `REPLICA IDENTITY FULL` on tables whose `UPDATE`/`DELETE` payloads the client
  needs (e.g. notification state changes) so old-row filtering works.

### Services / integration (`src/integrations/supabase/realtime.ts` — new reusable module)

- `subscribeToTable({ table, filter, on })` — thin wrapper over
  `supabase.channel(...).on('postgres_changes', …)` returning an unsubscribe fn.
- `subscribePresence(channel, meta)` — presence (who's online / viewing a
  task/board), used for avatars + "typing…".
- `broadcast(channel, event, payload)` / `onBroadcast(...)` — ephemeral signals
  (typing indicators, cursor, "user is editing") that must **not** be persisted.
- `RealtimeManager` — reference-counts channels so N components sharing a
  `(table, filter)` reuse one socket subscription; tears down on last unmount.

### Repositories / cache wiring

- Each feature repository exposes a `subscribe(scope, onChange)` that maps realtime
  payloads to store/query-cache updates:
  - Mock-store features (notifications, dependencies, task-communication): realtime
    handler mutates the in-memory cache + `emit()` (same path as hydration).
  - Query-based features: `queryClient.invalidateQueries` / `setQueryData` on the
    relevant key.

### UI

- No bespoke UI — realtime silently keeps existing components live: unread badge,
  kanban boards, comment threads, activity feeds, inbox counts, presence avatars.
  A small `usePresence(channel)` hook powers "who's viewing" chips where useful.

### Realtime events (channel catalogue)

| Channel                                                   | Transport                    | Purpose                   |
| --------------------------------------------------------- | ---------------------------- | ------------------------- |
| `notifications:{userId}`                                  | postgres_changes             | live notification + badge |
| `approvals:{userId}`                                      | postgres_changes             | approval queue            |
| `inbox:{userId}`                                          | invalidation (fan-in)        | unified inbox counts      |
| `comments:{parentType}:{parentId}`                        | postgres_changes + broadcast | live threads + typing     |
| `activity:project:{projectId}`                            | postgres_changes             | project/task/dep activity |
| `dependencies:board` / `dependencies:{id}`                | postgres_changes             | kanban + detail           |
| `presence:project:{projectId}` / `presence:task:{taskId}` | presence                     | who's online/viewing      |

### Permissions

- `postgres_changes`: enforced by table RLS — subscribers only receive rows they
  can `SELECT`. Presence/broadcast: gated by `realtime.messages` RLS policies
  (join allowed only for members of the referenced entity). No service-role usage
  on the client. Quiet-hours/preference filtering for toasts is a **client-side
  second gate** on top of the server-side recipient filtering.

---

## 8. Build order (phased, each wave = one or more RLS-complete migrations)

1. **Foundation** — enums; `events` outbox + `emit_event`; realtime module
   (`integrations/supabase/realtime.ts`); `notifications` + `notification_preferences`
   - `notify()` + `tg_fanout_event`; publication + RLS. Swap notifications store.
2. **Mentions & Comments** — `comments` (+ polymorphic-integrity trigger) +
   `comment_reactions`; `tg_comment_mentions` → notifications; wire
   task-communication + dependency comments.
3. **Activity Feed** — `task_activity` + `dependency_activity` + `activity_feed`
   view + triggers; repoint manager/project/analytics feeds.
4. **Dependency Requests** — `dependency_activity` link, `project_id` column,
   `set_dependency_state` RPC, `can_access_dependency`; store swap; realtime board.
5. **Approvals** — `approvals` + `approval_decisions` + `decide_approval` +
   `can_approve`; approvals UI; wire EOD/dependency/membership/role side effects.
6. **Inbox** — `inbox_items` view + `inbox_state`; inbox UI; fan-in realtime.
7. **Hardening** — Edge Function outbox worker for complex targeting + email/slack
   channels; presence/typing; `audit_events` coverage of decisions; load/perf.

Regenerate `src/integrations/supabase/types.ts` after every migration.

---

## 9. Risks & open decisions

- **Notification generation site**: SQL triggers (simple, transactional) vs. Edge
  Function worker running the existing TS engine (preserves the rich `RecipientRule`
  DSL, channel routing). Recommend triggers for MVP fan-out + worker for
  email/slack/dept-manager targeting. Decide before Wave 1.
- **Mock-identity → real FK bridge**: dependencies/task-communication use
  `hr/mock-data` ids and name-string department/project fields — the same
  impedance resolved for projects. Store swaps must source people/departments from
  the live directory and pass real FKs (pickers change, layout doesn't).
- **Polymorphic FKs** (`comments`, `attachments`, `approvals`) need INSERT-time
  integrity triggers since declarative cross-type FKs aren't possible.
- **Realtime cost/scale**: reference-count channels; scope subscriptions to the
  open view (per project/board) not global; rely on RLS filtering to avoid
  over-delivery. Consider a single multiplexed user channel for
  notifications+approvals+inbox.
- **Ordering/dedupe**: the `events` outbox needs idempotent fan-out (unique
  `(event_id, recipient_id, category)` on notifications) so retries don't
  double-notify.
- **Attachments/Storage** (files in comments/tasks) are specced in
  `DATABASE_DESIGN.md §12` but out of scope here except where comments reference
  them; plan alongside Storage buckets.

---

## 10. Planned file inventory (no code written)

```
supabase/migrations/
  <ts>_collab_foundation.sql        # enums, events, notifications(+prefs), notify(), publication
  <ts>_collab_comments.sql          # comments (+integrity), comment_reactions, mention trigger
  <ts>_collab_activity.sql          # task_activity, dependency_activity, activity_feed view
  <ts>_collab_dependencies.sql      # dependency_activity link, project_id, set_dependency_state
  <ts>_collab_approvals.sql         # approvals, approval_decisions, decide_approval, can_approve
  <ts>_collab_inbox.sql             # inbox_items view, inbox_state

src/services/{notifications,comments,activity,approvals,inbox,dependencies}/    # BaseService subclasses + rules
src/repositories/{notifications,comments,activity,approvals,inbox,dependencies}/ # injected singletons + barrels
src/integrations/supabase/realtime.ts                                            # reusable subscription/presence/broadcast
src/features/approvals/  src/features/inbox/                                     # new UI (reuses ui/ primitives)
# notifications / dependencies / task-communication: store-internal swap only (UI unchanged)
```

_This is a plan. Implementation happens in later, migration-first waves; each
table ships with RLS in the same migration, and `types.ts` is regenerated after
each._
