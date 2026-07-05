/**
 * AI Chat feature — barrel.
 *
 * Local-first chat UI for the SpartaFlow assistant. Conversations and favorites
 * persist to `localStorage`; the assistant runs on the offline mock provider via
 * `@/ai`. See `docs/AI_CHAT.md`.
 */

// Components
export { AIChat } from "./components/ai-chat";
export { ConversationList } from "./components/conversation-list";
export { MessageList } from "./components/message-list";
export { Composer } from "./components/composer";
export { ChatMessage } from "./components/chat-message";
export { SuggestedPrompts } from "./components/suggested-prompts";
export { Markdown } from "./components/markdown";
export { parseMarkdown } from "./components/markdown-parse";
export type { MarkdownBlock } from "./components/markdown-parse";
export { CodeBlock } from "./components/code-block";

// Hooks
export { useChat } from "./hooks/use-chat";
export type { UseChat } from "./hooks/use-chat";
export { useCopy } from "./hooks/use-copy";

// Store & suggestions
export {
  useAIChatState,
  createConversation,
  deleteConversation,
  renameConversation,
  setActive,
  toggleFavorite,
  isFavorite,
} from "./store";
export { suggestedPromptsFor } from "./suggested-prompts";

// Types
export type {
  ChatRole,
  ChatMessage as ChatMessageModel,
  ChatConversation,
  FavoritePrompt,
  SuggestedPrompt,
} from "./types";
