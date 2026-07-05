/**
 * ChatMessage — a single turn. Assistant replies render Markdown (code, tables,
 * lists) and expose a copy button; user turns render as plain text. While an
 * assistant reply streams with no content yet, a typing indicator shows.
 */
import { Bot, Check, Copy, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageModel } from "../types";
import { useCopy } from "../hooks/use-copy";
import { Markdown } from "./markdown";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageModel;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { copied, copy } = useCopy();
  const isUser = message.role === "user";
  const isEmptyStream = message.streaming && message.content.length === 0;

  return (
    <div className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(isUser ? "bg-primary/10 text-primary" : "bg-muted")}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-primary text-primary-foreground"
              : message.error
                ? "border border-destructive/40 bg-destructive/5 text-foreground"
                : "border bg-card text-card-foreground",
          )}
        >
          {isEmptyStream ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {!isUser && !message.streaming && message.content.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => copy(message.content)}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
    </div>
  );
}
