/**
 * ConversationList — the conversation-history sidebar. Start a new chat, switch
 * between saved conversations, or delete one. Backed by the local store.
 */
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "../types";

interface ConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r bg-muted/20">
      <div className="p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onNew}
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2 pt-0">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md",
                  c.id === activeId ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex-1 truncate px-2 py-2 text-left text-sm"
                  title={c.title}
                >
                  {c.title}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete conversation"
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
