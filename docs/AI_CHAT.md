# SpartaFlow — AI Chat

> Reference for the AI Chat feature in `src/features/ai/`. A local-first chat UI
> for the SpartaFlow assistant: conversations and favorites persist to
> `localStorage`; replies run on the **offline mock provider** via `@/ai`
> (`docs/AI_FEATURES.md`). No external API is contacted.
>
> Snapshot date: 2026-07-01.

---

## 1. What's included

| Requirement | Where |
| --- | --- |
| **Conversation History** | `store.ts` (local) + `ConversationList` sidebar |
| **Suggested Prompts** | `suggested-prompts.ts` (role-aware) + `SuggestedPrompts` empty state |
| **Favorite Prompts** | `store.ts` favorites + star toggle in `SuggestedPrompts` |
| **Copy Response** | `useCopy` hook + copy buttons on assistant messages & code blocks |
| **Markdown Rendering** | `Markdown` (dependency-free) |
| **Code Blocks** | `CodeBlock` (language label + copy) |
| **Tables** | GFM pipe tables → shadcn `Table` |
| **Loading States** | typing indicator + send spinner |
| **Streaming-ready architecture** | `useChat` consumes `aiAssistant.chatStream`, accumulating deltas |

---

## 2. Structure (feature-first)

```
src/features/ai/
  index.ts                    # barrel
  types.ts                    # ChatConversation, ChatMessage, FavoritePrompt, SuggestedPrompt
  store.ts                    # localStorage-backed reactive store (useSyncExternalStore)
  suggested-prompts.ts        # role-aware starters
  hooks/
    use-chat.ts               # orchestrator: store + AI service, streaming send
    use-copy.ts               # clipboard + "copied" state + toast
  components/
    ai-chat.tsx               # assembled experience (sidebar + transcript + composer)
    conversation-list.tsx     # conversation history sidebar
    message-list.tsx          # scrollable transcript + auto-scroll + empty state
    chat-message.tsx          # one turn (markdown, copy, typing indicator)
    composer.tsx              # input (Enter=send, Shift+Enter=newline)
    suggested-prompts.tsx     # empty-state suggestions + favorites
    markdown.tsx              # Markdown renderer (React nodes)
    markdown-parse.ts         # pure block parser (unit-tested)
    code-block.tsx            # fenced code block + copy
```

Follows the project's feature-first architecture (components / hooks / store /
types) and reuses existing `ui/` primitives (Button, Avatar, Table, ScrollArea,
Textarea) — no new UI primitives.

---

## 3. Usage

Drop the assembled component into any authenticated page (it fills its container):

```tsx
import { AIChat } from "@/features/ai";

export function AssistantPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <AIChat />
    </div>
  );
}
```

`AIChat` needs the `AuthProvider` in scope (it reads the current user via
`useAuth`), which the authenticated app shell already provides.

Sub-components and the store are exported too, for custom layouts (e.g. a
`Sheet`-hosted assistant):

```tsx
import { useChat, MessageList, Composer } from "@/features/ai";
```

---

## 4. Local-first storage

`store.ts` is a `localStorage`-backed reactive facade (`useSyncExternalStore`),
the same pattern as the other SpartaFlow mock-backed features. State:

```ts
{ conversations: ChatConversation[]; activeId: string | null; favorites: FavoritePrompt[] }
```

Key: `spartaflow:ai-chat:v1`. Mutations (`createConversation`, `addUserMessage`,
`startAssistantMessage`, `appendDelta`, `finishAssistantMessage`,
`deleteConversation`, `toggleFavorite`) persist and notify subscribers. The shapes
mirror the future `ai_conversations` / `ai_messages` Supabase surface
(`docs/AI_ARCHITECTURE.md`), so the store can be swapped for server functions /
TanStack Query without touching components.

---

## 5. Streaming-first send path

`useChat.send(text)`:

1. Resolves or creates the active conversation.
2. Captures prior turns as `history` (excludes streaming/errored turns).
3. Appends the user message; opens an empty **streaming** assistant message.
4. Iterates `aiAssistant.chatStream({ user, prompt, history })`, calling
   `appendDelta` per chunk → the UI renders tokens as they arrive.
5. Finalizes the message (or marks it errored on failure).

The provider is the offline **mock** (`aiAssistant` default), which streams word
by word — so the streaming architecture is exercised today and swaps to a real
provider with no UI change. `sending` drives the composer spinner and guards
re-entry.

---

## 6. Markdown rendering

`Markdown` renders a safe subset **without dependencies or
`dangerouslySetInnerHTML`** (no HTML-injection surface):

- **Block parser** (`markdown-parse.ts`, pure/unit-tested): fenced code blocks,
  GFM pipe tables, headings, ordered/unordered lists, blockquotes, horizontal
  rules, paragraphs. Code fences are captured verbatim (no misparsing of `|` or
  `-` inside code).
- **Inline** (in `markdown.tsx`): `**bold**`, `*italic*`/`_italic_`,
  `` `code` ``, `[links](url)` (open in a new tab).
- **Code blocks** → `CodeBlock` (language label + hover copy).
- **Tables** → shadcn `Table` (scrolls on overflow).

Assistant turns render as Markdown; user turns render as plain, whitespace-safe
text. To upgrade to a full pipeline later, replace `markdown.tsx` — callers are
unaffected.

---

## 7. Suggested & favorite prompts

- **Suggested** — `suggestedPromptsFor(roles)` returns role-appropriate starters
  (employee / manager / owner), aligned with the AI feature catalog but as plain,
  ready-to-send messages (no template variables). Shown on the empty state; a
  click sends immediately.
- **Favorites** — any suggestion can be starred; favorites persist locally and
  appear in their own group on the empty state. `toggleFavorite` / `isFavorite`
  manage them.

---

## 8. Copy & loading states

- **Copy** — `useCopy` writes to the clipboard, shows a transient check + a toast.
  Available on each assistant message and each code block.
- **Loading** — an animated **typing indicator** shows while an assistant reply is
  streaming with no content yet; the composer's send button shows a spinner and is
  disabled during a turn.

---

## 9. Notes & follow-ups

- **Auth scope** — chat grounds context through the service layer (RLS-scoped);
  the assistant only sees what the user could open.
- **No route added** — the feature ships as components so it can be mounted where
  desired (e.g. a `/app/assistant` route or a global `Sheet`). Wiring a route is a
  one-file follow-up.
- **Persistence** — local-only for now by request; the store's shape is ready for
  the Supabase swap described in `docs/AI_ARCHITECTURE.md`.
- **Responsive** — the sidebar is a fixed column; hosting it in a `Sheet` on small
  screens is a straightforward enhancement.

---

## 10. Verification

- `npx tsc --noEmit` — **0 errors** (whole project).
- `npx eslint "src/features/ai/**/*.{ts,tsx}"` — clean (0 warnings).
- Markdown parser unit-checked: code blocks, GFM tables, headings/lists/quotes/hr,
  and verbatim code content.
