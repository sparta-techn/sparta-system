/**
 * AI Chat — feature domain types. Local-first: conversations and favorites are
 * persisted to `localStorage` today (see `store.ts`) and shaped to mirror the
 * future `ai_conversations` / `ai_messages` Supabase surface so the store can be
 * swapped for server functions without touching components.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** True while the assistant reply is still streaming in. */
  streaming?: boolean;
  /** True when the turn ended in an error. */
  error?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/** A user-saved prompt, reusable across conversations. */
export interface FavoritePrompt {
  id: string;
  title: string;
  prompt: string;
}

/** A one-click starter shown on the empty state (role-aware). */
export interface SuggestedPrompt {
  id: string;
  title: string;
  prompt: string;
}
