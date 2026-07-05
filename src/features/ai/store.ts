/**
 * AI Chat store — localStorage-backed reactive facade.
 *
 * Mirrors the future Supabase repository surface (`ai_conversations` /
 * `ai_messages`). Consumers call these functions; UI subscribes via
 * `useAIChatState`. Replace internals with server fns / TanStack Query once
 * persistence lands, without touching component code.
 */
import { useSyncExternalStore } from "react";
import type { ChatConversation, ChatMessage, FavoritePrompt } from "./types";

const KEY = "spartaflow:ai-chat:v1";

interface State {
  conversations: ChatConversation[];
  activeId: string | null;
  favorites: FavoritePrompt[];
}

function defaultState(): State {
  return { conversations: [], activeId: null, favorites: [] };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function set(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAIChatState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(defaultState()),
  );
}

// ── ids & helpers ────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Derive a short conversation title from the first user message. */
export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean || "New chat";
  return `${clean.slice(0, 47)}…`;
}

function mapConversation(
  s: State,
  id: string,
  fn: (c: ChatConversation) => ChatConversation,
): ChatConversation[] {
  return s.conversations.map((c) => (c.id === id ? fn(c) : c));
}

// ── reads ────────────────────────────────────────────────────────────────────

export function getConversation(id: string | null): ChatConversation | null {
  if (!id) return null;
  return state.conversations.find((c) => c.id === id) ?? null;
}

// ── conversation mutations ───────────────────────────────────────────────────

export function createConversation(title = "New chat"): ChatConversation {
  const now = new Date().toISOString();
  const conversation: ChatConversation = {
    id: uid("conv"),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  set({
    ...state,
    conversations: [conversation, ...state.conversations],
    activeId: conversation.id,
  });
  return conversation;
}

export function setActive(id: string | null): void {
  set({ ...state, activeId: id });
}

export function renameConversation(id: string, title: string): void {
  set({ ...state, conversations: mapConversation(state, id, (c) => ({ ...c, title })) });
}

export function deleteConversation(id: string): void {
  const conversations = state.conversations.filter((c) => c.id !== id);
  const activeId = state.activeId === id ? (conversations[0]?.id ?? null) : state.activeId;
  set({ ...state, conversations, activeId });
}

export function clearConversations(): void {
  set({ ...state, conversations: [], activeId: null });
}

// ── message mutations ────────────────────────────────────────────────────────

export function addUserMessage(conversationId: string, content: string): ChatMessage {
  const message: ChatMessage = {
    id: uid("msg"),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
  set({
    ...state,
    conversations: mapConversation(state, conversationId, (c) => ({
      ...c,
      messages: [...c.messages, message],
      updatedAt: message.createdAt,
      // First user message names the conversation.
      title: c.messages.length === 0 ? deriveTitle(content) : c.title,
    })),
  });
  return message;
}

/** Start an empty, streaming assistant message; returns its id. */
export function startAssistantMessage(conversationId: string): string {
  const message: ChatMessage = {
    id: uid("msg"),
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
    streaming: true,
  };
  set({
    ...state,
    conversations: mapConversation(state, conversationId, (c) => ({
      ...c,
      messages: [...c.messages, message],
      updatedAt: message.createdAt,
    })),
  });
  return message.id;
}

/** Append a streamed delta to an assistant message. */
export function appendDelta(conversationId: string, messageId: string, delta: string): void {
  set({
    ...state,
    conversations: mapConversation(state, conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + delta } : m,
      ),
    })),
  });
}

/** Finalize an assistant message (stop streaming; optionally mark error/content). */
export function finishAssistantMessage(
  conversationId: string,
  messageId: string,
  opts: { error?: boolean; content?: string } = {},
): void {
  set({
    ...state,
    conversations: mapConversation(state, conversationId, (c) => ({
      ...c,
      updatedAt: new Date().toISOString(),
      messages: c.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              streaming: false,
              error: opts.error ?? m.error,
              content: opts.content ?? m.content,
            }
          : m,
      ),
    })),
  });
}

// ── favorite prompts ─────────────────────────────────────────────────────────

export function isFavorite(id: string): boolean {
  return state.favorites.some((f) => f.id === id);
}

export function addFavorite(entry: FavoritePrompt): void {
  if (isFavorite(entry.id)) return;
  set({ ...state, favorites: [entry, ...state.favorites] });
}

export function removeFavorite(id: string): void {
  set({ ...state, favorites: state.favorites.filter((f) => f.id !== id) });
}

export function toggleFavorite(entry: FavoritePrompt): void {
  if (isFavorite(entry.id)) removeFavorite(entry.id);
  else addFavorite(entry);
}
