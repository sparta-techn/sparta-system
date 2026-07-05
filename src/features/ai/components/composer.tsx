/**
 * Composer — the message input. Enter sends, Shift+Enter inserts a newline. The
 * send button shows a spinner while a reply streams.
 */
import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ComposerProps {
  sending: boolean;
  onSend: (text: string) => void;
}

export function Composer({ sending, onSend }: ComposerProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || sending) return;
    onSend(text);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t bg-background p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the assistant…  (Enter to send, Shift+Enter for a new line)"
          rows={1}
          className="max-h-40 min-h-[44px] resize-none"
        />
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0"
          disabled={!value.trim() || sending}
          onClick={submit}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
