# SpartaFlow — Collaboration Backend (Services + Repositories)

> Reference for the backend data layer over the collaboration tables
> (migration `20260701120000`: `notifications`, `notification_preferences`,
> `mentions`, `activity_feed`, `approval_requests`, `approval_actions`).
> **UI is not connected** — these are the service/repository singletons the hooks
> and inbox/approval routes will call next. Snapshot: 2026-07-01.

---

## 1. Layering

Same two-tier boundary as the rest of the app (`docs/SERVICES.md`,
`docs/REPOSITORIES.md`, `docs/PROJECT_EXECUTION_BACKEND.md`):

```
hook / TanStack Query / store swap
      │ (calls a repository singleton)
      ▼
Repository — domain verbs, orchestration (approval decision + audit append)
      │ (composes one or more services)
      ▼
Service (extends BaseService) — one table each, CRUD + finders
      │ (relaxed `db` client — these tables aren't in generated types yet)
      ▼
Supabase (RLS enforced: recipient-scoped / project-scoped / party-scoped)
```

- **Services** extend `BaseService<Row, Insert, Update>` over the relaxed `db`
  client, with explicit **snake-case** row types matching the SQL exactly.
  `notification_preferences` is keyed by `user_id` (not `id`), so its service is
  standalone (get/upsert/update) — same shape as `WorkspaceService`.
- **Repositories** live in their own folders with a barrel, **not** re-exported
  from the root `@/repositories` barrel — same convention as `projects` / `hr` /
  `attendance` / `reports`. Import from `@/repositories/notifications` and
  `@/repositories/activity`.
- **Append-only tables** (`activity_feed`, `approval_actions`) expose
  `log()` + reads and **reject** `update`/`upsert`/`remove` at the service layer,
  matching the SELECT/INSERT-only grants.

### Realignment note

A pre-existing scaffold `services/notifications/notifications.service.ts` was
typed against the **mock** `AppNotification` (camelCase `readAt`/`deletedAt`).
It has been **realigned to the migration schema** (snake-case, `state`
lifecycle enum) — the class/singleton names are unchanged, so the root
`@/services` barrel export still resolves.

---

## 2. Services

### `@/services/notifications`

| Service / singleton                                                 | Table                                    | Key methods                                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `NotificationsService` / `notificationsService`                     | `notifications`                          | `listForRecipient`, `listByState`, `unreadCount`, `markSeen`, `markRead`, `markAllRead`, `archive`, `dismiss` (+ inherited CRUD) |
| `NotificationPreferencesService` / `notificationPreferencesService` | `notification_preferences` (user_id key) | `get`, `upsert`, `update`                                                                                                        |
| `MentionsService` / `mentionsService`                               | `mentions`                               | `listForUser`, `listUnseen` (uses `IS NULL`), `listForSource`, `markSeen` (+ CRUD)                                               |

### `@/services/activity`

| Service / singleton                           | Table           | Key methods                                                                              |
| --------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `ActivityFeedService` / `activityFeedService` | `activity_feed` | `log`, `listForProject`, `listForActor`, `listForSource`, `listRecent` — **append-only** |

### `@/services/approvals`

| Service / singleton                                   | Table               | Key methods                                                                                           |
| ----------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| `ApprovalRequestsService` / `approvalRequestsService` | `approval_requests` | `listForApprover`, `listForRequester`, `listForEntity`, `pendingCount`, `decide`, `reassign` (+ CRUD) |
| `ApprovalActionsService` / `approvalActionsService`   | `approval_actions`  | `log`, `listForRequest` — **append-only**                                                             |

---

## 3. Repositories

### `@/repositories/notifications` (the collaboration / inbox domain)

| Repository / singleton                                                  | Feature                      | Verbs                                                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NotificationRepository` / `notificationRepository`                     | **Notification CRUD**        | `inbox(recipientId, state?)`, `badgeCount`, `create`, `update`, `remove`, `markSeen`/`markRead`/`markAllRead`/`archive`/`dismiss`  |
| `NotificationPreferenceRepository` / `notificationPreferenceRepository` | **Notification Preferences** | `get`, `save` (upsert), `update`                                                                                                   |
| `MentionRepository` / `mentionRepository`                               | **Mentions**                 | `listForUser`, `listUnseen`, `listForSource`, `create`, `markSeen`, `remove`                                                       |
| `ApprovalRepository` / `approvalRepository`                             | **Approval Requests**        | `queue(assigneeId, status?)`, `raised`, `forEntity`, `pendingCount`, `history`, `raise`, `approve`, `reject`, `cancel`, `reassign` |

> Approval requests live under `repositories/notifications/` (the inbox domain)
> rather than a separate folder — only `repositories/notifications/` and
> `repositories/activity/` were created.

### `@/repositories/activity`

| Repository / singleton                              | Feature           | Verbs                                                  |
| --------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| `ActivityFeedRepository` / `activityFeedRepository` | **Activity Feed** | `forProject`, `forActor`, `forSource`, `recent`, `log` |

The `ApprovalRepository` decision verbs update the request **and** append an
immutable `approval_actions` row (audit trail). `raise` logs a `requested`
action; `approve`/`reject`/`cancel` log the matching action; `reassign` logs
`reassigned`.

---

## 4. Supported operations → call sites

| Operation                | Call                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Notification CRUD        | `notificationRepository.inbox(userId)` · `.badgeCount(userId)` · `.markRead(id)` · `.markAllRead(userId)`                      |
| Notification preferences | `notificationPreferenceRepository.get(userId)` · `.save({ user_id, categories, channels, quiet_hours })`                       |
| Mentions                 | `mentionRepository.listUnseen(userId)` · `.create({ mentioned_user_id, source_type, source_id })` · `.markSeen(id)`            |
| Activity feed            | `activityFeedRepository.forProject(projectId)` · `.recent(50)` · `.log({ source_type, source_id, kind, summary })`             |
| Approval requests        | `approvalRepository.queue(userId)` · `.raise({ title, type, assignee_id })` · `.approve(id, deciderId, note)` · `.history(id)` |

Actor/recipient come from the authenticated session; RLS + `DEFAULT auth.uid()`
audit columns enforce and stamp server-side.

---

## 5. Permissions (enforced by RLS, mirrored by the services)

- **Notifications** — recipient reads/updates/deletes own; may only insert
  notifications addressed to self. Cross-user fan-out is done by future
  SECURITY DEFINER functions / the service role, **not** the client — so the
  repository intentionally has no "notify another user" verb.
- **Preferences** — self read+write (`user_id = auth.uid()`).
- **Mentions** — mentioned user + author read; author inserts; recipient marks seen.
- **Activity feed** — project members / actor / elevated roles read; actor inserts;
  append-only.
- **Approval requests** — requester/assignee/admins read; requester raises;
  assignee/requester/admins act; `approval_actions` readable to anyone who can
  read the parent request; append-only.

---

## 6. Known limitations / next steps

1. **Tables not in generated types yet** — services use the relaxed `db` client.
   Regenerate `src/integrations/supabase/types.ts` after the migration is applied,
   then tighten the explicit row types onto the generated ones.
2. **Non-atomic approval decisions** — `ApprovalRepository` updates the request
   then appends the action as a second statement. A `decide_approval` SECURITY
   DEFINER RPC (planned, `COLLABORATION_PLAN.md §4`) would make it transactional
   and enforce approver eligibility + the side effect server-side.
3. **No notification generation here** — creating notifications for _other_ users
   (mention fan-out, event → notification) is server-side (triggers / Edge
   Function outbox worker per `COLLABORATION_PLAN.md §0`); these services only
   read the recipient's own inbox and let a user self-notify.
4. **Realtime not wired** — the tables are not yet in the `supabase_realtime`
   publication and no client subscribes; that is a later wave.
5. **UI not connected** (by request). Next: swap the `features/notifications`
   store internals to `notificationRepository` (public API unchanged), and build
   the Inbox / Approvals query hooks + routes.

---

## 7. Files added / changed

```
src/services/notifications/
  types.ts                       # NEW — notification / preferences / mention rows
  notifications.service.ts       # REALIGNED to snake-case + state lifecycle
  preferences.service.ts         # NEW — NotificationPreferencesService (user_id key)
  mentions.service.ts            # NEW — MentionsService
  index.ts                       # extended barrel

src/services/activity/
  types.ts                       # NEW — activity_feed row
  activity-feed.service.ts       # NEW — ActivityFeedService (append-only)
  index.ts

src/services/approvals/
  types.ts                       # NEW — approval request / action rows
  approval-requests.service.ts   # NEW — ApprovalRequestsService
  approval-actions.service.ts    # NEW — ApprovalActionsService (append-only)
  index.ts

src/repositories/notifications/
  notification.repository.ts             # NEW
  notification-preference.repository.ts  # NEW
  mention.repository.ts                  # NEW
  approval.repository.ts                 # NEW
  index.ts

src/repositories/activity/
  activity-feed.repository.ts    # NEW
  index.ts
```

No frontend/UI code was modified. The root `@/repositories` barrel was not
touched. `tsc --noEmit` clean · `eslint` clean · `vitest` 48 passing.
