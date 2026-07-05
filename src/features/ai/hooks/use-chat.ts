/**
 * useChat — orchestrates the chat experience: local conversation store +
 * the AI service (offline mock provider today), with a streaming-first send
 * path. Accumulates streamed deltas into the active assistant message so the UI
 * renders tokens as they arrive.
 */
import { useCallback, useMemo, useState } from "react";
import { aiAssistant } from "@/ai";
import type { PromptUser } from "@/ai";
import { useAuth } from "@/features/auth/auth-context";
import {
  addUserMessage,
  appendDelta,
  createConversation,
  deleteConversation as deleteConversationStore,
  finishAssistantMessage,
  getConversation,
  setActive,
  startAssistantMessage,
  useAIChatState,
} from "../store";
import type { ChatConversation } from "../types";

export interface UseChat {
  conversations: ChatConversation[];
  active: ChatConversation | null;
  activeId: string | null;
  /** True while a reply is streaming. */
  sending: boolean;
  send: (text: string) => Promise<void>;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
}

export function useChat(): UseChat {
  const { user, profile, roles } = useAuth();
  const conversations = useAIChatState((s) => s.conversations);
  const activeId = useAIChatState((s) => s.activeId);
  const active = useAIChatState((s) => s.conversations.find((c) => c.id === s.activeId) ?? null);
  const [sending, setSending] = useState(false);

  const promptUser = useMemo<PromptUser>(
    () => ({
      id: user?.id ?? "anonymous",
      displayName: profile?.display_name ?? profile?.full_name ?? user?.email ?? "there",
      roles: roles as string[],
    }),
    [user?.id, user?.email, profile?.display_name, profile?.full_name, roles],
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || sending) return;
      setSending(true);

      // Resolve (or create) the conversation and capture prior turns first.
      let conversationId = activeId;
      if (!conversationId) conversationId = createConversation().id;
      const prior = getConversation(conversationId)?.messages ?? [];
      const history = prior
        .filter((m) => !m.streaming && !m.error && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      addUserMessage(conversationId, prompt);
      const assistantId = startAssistantMessage(conversationId);

      try {
        for await (const chunk of aiAssistant.chatStream({
          user: promptUser,
          prompt,
          history,
        })) {
          if (chunk.delta) appendDelta(conversationId, assistantId, chunk.delta);
        }
        finishAssistantMessage(conversationId, assistantId);
      } catch {
        finishAssistantMessage(conversationId, assistantId, {
          error: true,
          content: "Sorry — I couldn't complete that request. Please try again.",
        });
      } finally {
        setSending(false);
      }
    },
    [activeId, sending, promptUser],
  );

  const newConversation = useCallback(() => setActive(null), []);
  const selectConversation = useCallback((id: string) => setActive(id), []);
  const deleteConversation = useCallback((id: string) => deleteConversationStore(id), []);

  return {
    conversations,
    active,
    activeId,
    sending,
    send,
    newConversation,
    selectConversation,
    deleteConversation,
  };
}
