# Task Communication

Umbrella module covering **Comments** and **Files** on a Task. Both
share one feature folder, one store, and one activity stream.

## Scope

- **In**: threaded comments, replies, edits, deletes, mentions,
  reactions, file attachments, file previews, UI-only download &
  delete, activity events, sonner toasts.
- **Out**: standalone chat, DMs, channels, real file storage, push
  notifications, server-side aggregation.

## Architecture

```
src/features/task-communication/
  types.ts                              # TaskThreadComment, TaskFile, activity
  utils.ts                              # bytes, time, mention parsing, kind
  mock-data.ts                          # 12 seeded tasks w/ comments + files
  store.ts                              # localStorage reactive facade
  components/
    comment-composer.tsx                # textarea + @mentions + emoji insert
    comment-item.tsx                    # single comment w/ reactions, edit, delete, reply
    threaded-comments.tsx               # roots + replies + composer
    task-files-panel.tsx                # dropzone + list + preview dialog
    communication-activity.tsx          # activity stream injected into Activity tab
```

Mirrors the future Supabase repository surface (one table per entity,
one events stream). Swap `store.ts` for server calls without changing
any component.

## Store API

```ts
commStore.addComment({ taskId, userId, message, parentCommentId? })
commStore.editComment(id, message)
commStore.deleteComment(id)
commStore.toggleReaction(id, emoji, userId)
commStore.addFile({ taskId, userId, fileName, fileType, fileSize, previewUrl?, kind? })
commStore.deleteFile(id)
```

Reactive hook:

```ts
const comments = useCommState(selectTaskComments(taskId));
const files = useCommState(selectTaskFiles(taskId));
const activity = useCommState(selectTaskCommActivity(taskId));
```

## Task Detail Integration

Three additions to `Task Detail`:

| Tab          | Component                                                | Notes                                               |
| ------------ | -------------------------------------------------------- | --------------------------------------------------- |
| **Comments** | `<ThreadedComments />`                                   | New tab with full thread + composer                 |
| **Files**    | `<TaskFilesPanel />`                                     | Replaces the old read-only stub                     |
| **Activity** | `<TaskActivityTimeline />` + `<CommunicationActivity />` | Tasks-module events + comm events rendered together |

The Tasks-module `<TaskComments />` (a flat, single-store comment list)
still renders inside the **Overview** tab. Why both? Comm comments live
in a separate store/file so the Tasks module is unmodified. Overview
keeps the at-a-glance flat list users expect; the dedicated **Comments**
tab adds threading, mentions, reactions, and richer composer affordances.

## Mentions Pipeline (UI only)

1. User types `@` in the composer → inline popover of 25 mock employees.
2. On select, the handle is inserted (`@firstnamelastname`).
3. On submit, `extractMentions` parses tokens against the directory.
4. Mentions are persisted on the comment + surfaced as a sonner toast.

In production this hook-point is where notification-fanout (event-bus
`notification.mention`) would publish — left as a documented TODO to
avoid extending the central `EventName` union in this turn.

## Activity Linking

Every mutation pushes a `TaskCommActivity` record:

| Action         | Kind              | Summary                                    |
| -------------- | ----------------- | ------------------------------------------ |
| Add comment    | `comment_added`   | `added a comment` / `replied to a comment` |
| Edit comment   | `comment_edited`  | `edited a comment`                         |
| Delete comment | `comment_deleted` | `deleted a comment`                        |
| Upload file    | `file_uploaded`   | `uploaded {name}`                          |
| Delete file    | `file_deleted`    | `deleted {name}`                           |

Rendered by `<CommunicationActivity />` inside the Task Detail Activity
tab, beneath the Tasks-module timeline.

## Responsive Behavior

- **Desktop**: full-width threads, two-column file grid, hover-reveal
  row actions.
- **Tablet**: same as desktop with reduced gutter.
- **Mobile**: composer collapses to 2-row textarea, files stack to a
  single column, row action buttons are always visible.

## Notifications (UI only)

| Trigger        | Toast                                            |
| -------------- | ------------------------------------------------ |
| New comment    | `"{author} commented"` with message preview      |
| Mention parsed | `"Mention sent to {names}"` success toast        |
| File uploaded  | `"{uploader} uploaded {fileName}"` success toast |
| Mock download  | `"Download started · {fileName}"` info toast     |

All via `sonner`. No event-bus changes, no central notification-store
writes — that wiring belongs to the backend phase.

## Module Rules Honored

- **Tasks module**: not modified (no `types.ts`, `store.ts`, or
  `utils.ts` edits). `task-detail.tsx` is touched only to register the
  new tabs and activity slot — the same minimal-edit pattern used for
  Time Tracking.
- **Kanban / Sprint / Time Tracking modules**: not touched.
- No standalone chat. No real file backend. No new integration with
  the central event bus or notification store.

## Future Backend Mapping

| Client call              | Server function                            | Notes                                                |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------- |
| `addComment`             | `add_task_comment`                         | RLS: project membership; parses mentions server-side |
| `editComment`            | `update_task_comment`                      | author-only via RLS                                  |
| `deleteComment`          | `delete_task_comment`                      | soft-delete                                          |
| `toggleReaction`         | `toggle_task_comment_reaction`             | upsert/delete on `(comment_id, user_id, emoji)`      |
| `addFile`                | `create_task_file_record` + Storage upload | signed PUT URL flow                                  |
| `deleteFile`             | `delete_task_file`                         | also deletes Storage object                          |
| Mentions → notifications | trigger / event-bus subscriber             | publishes `notification.mention`                     |
