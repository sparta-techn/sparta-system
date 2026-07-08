# Comments

Threaded discussion on a Task. **Not** a standalone chat product — comments only
exist inside a Task and live entirely on the Task Detail page.

## Data Model

```ts
TaskThreadComment {
  id: string
  taskId: string
  userId: string
  message: string                 // plain text + @handle tokens
  parentCommentId: string | null  // null = root, otherwise reply
  mentions: string[]              // employee ids, derived from message
  reactions: { emoji: string; userIds: string[] }[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null        // tombstone — UI shows "This comment was deleted."
}
```

Storage: localStorage key `spartaflow:task-communication:v1` via
`commStore` (reactive `useSyncExternalStore` facade in
`src/features/task-communication/store.ts`).

## Features

| Action               | UI                                                    |
| -------------------- | ----------------------------------------------------- |
| Add comment          | Top-level composer on the Comments tab                |
| Reply                | Reply button on each comment → nested composer        |
| Edit (author only)   | Kebab menu → Edit → inline composer                   |
| Delete (author only) | Kebab menu → Delete → tombstone                       |
| Mention `@handle`    | Type `@` → inline suggestions; tokens render as chips |
| Reactions            | Smile button → 8 quick emojis; toggle per user        |
| Submit shortcut      | ⌘/Ctrl + Enter                                        |

Mentions and reactions are **UI only** — they do not currently push to any
real notification queue. They do trigger toast feedback via `sonner`.

## Threading Rules

- Two-level rendering: root + replies. Replies-to-replies are flattened
  into the same reply group to keep the thread readable. This is a UI
  decision; the data model supports arbitrary depth.
- Roots sort oldest → newest. Replies sort oldest → newest under each root.
- Deleted comments keep their slot so reply context is not lost.

## Integration

`Task Detail → Comments tab` renders `<ThreadedComments taskId={...} />`.
The legacy flat `<TaskComments />` (Tasks-module store) is still rendered
inside the Overview tab and is intentionally separate — see
`TaskCommunication.md` for the rationale.

## Notifications (UI only)

`commStore.addComment` emits sonner toasts:

- Always: `"{author} commented"` with a preview of the message.
- If mentions are present: a follow-up `"Mention sent to {names}"` success toast.

## Mock Data

12 root tasks are seeded with discussion threads, including nested replies,
emoji reactions, and mention examples. Loaded once and cached in
localStorage.
