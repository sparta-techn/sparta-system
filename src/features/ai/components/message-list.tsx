/**
 * MessageList — scrollable transcript. Auto-scrolls to the newest content as the
 * assistant streams. Shows the suggested-prompts empty state when a conversation
 * has no messages yet.
 */
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatConversation } from "../types";
import { ChatMessage } from "./chat-message";
import { SuggestedPrompts } from "./suggested-prompts";

interface MessageListProps {
  conversation: ChatConversation | null;
  onPickPrompt: (prompt: string) => void;
}

export function MessageList({ conversation, onPickPrompt }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];

  // Total streamed length drives the auto-scroll effect.
  const streamedLength = messages.reduce((n, m) => n + m.content.length, 0);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamedLength]);

  if (messages.length === 0) {
    return (
      <ScrollArea className="flex-1">
        <SuggestedPrompts onPick={onPickPrompt} />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
