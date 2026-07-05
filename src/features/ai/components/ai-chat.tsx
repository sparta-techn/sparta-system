/**
 * AIChat — the assembled chat experience: conversation-history sidebar +
 * transcript + composer. Connects to the AI service through `useChat` (offline
 * mock provider today) with a streaming-first send path. Drop it into any page.
 */
import { cn } from "@/lib/utils";
import { useChat } from "../hooks/use-chat";
import { ConversationList } from "./conversation-list";
import { MessageList } from "./message-list";
import { Composer } from "./composer";

interface AIChatProps {
  className?: string;
}

export function AIChat({ className }: AIChatProps) {
  const {
    conversations,
    active,
    activeId,
    sending,
    send,
    newConversation,
    selectConversation,
    deleteConversation,
  } = useChat();

  return (
    <div className={cn("flex h-full overflow-hidden rounded-lg border bg-background", className)}>
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onNew={newConversation}
        onSelect={selectConversation}
        onDelete={deleteConversation}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MessageList conversation={active} onPickPrompt={send} />
        <Composer sending={sending} onSend={send} />
      </div>
    </div>
  );
}
