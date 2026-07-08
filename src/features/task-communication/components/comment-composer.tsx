import { useMemo, useRef, useState } from "react";
import { AtSign, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MENTIONABLE_USERS, QUICK_EMOJIS } from "../types";

/**
 * Comment composer with UI-only @mentions and emoji insertion.
 * Notifications and persistence are handled by the parent via `onSubmit`.
 */
export function CommentComposer({
  placeholder = "Write a comment… use @ to mention",
  autoFocus = false,
  initialValue = "",
  submitLabel = "Comment",
  onSubmit,
  onCancel,
  compact = false,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (message: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const mentionQuery = useMemo(() => {
    const ta = ref.current;
    const caret = ta?.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const m = upto.match(/(?:^|\s)@([a-z0-9_]*)$/i);
    return m ? m[1].toLowerCase() : null;
  }, [value]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return MENTIONABLE_USERS.filter((u) =>
      mentionQuery === "" ? true : u.handle.includes(mentionQuery),
    ).slice(0, 6);
  }, [mentionQuery]);

  function applyMention(handle: string) {
    const ta = ref.current;
    const caret = ta?.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = upto.replace(/@([a-z0-9_]*)$/i, `@${handle} `);
    const next = replaced + after;
    setValue(next);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = replaced.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  function insertEmoji(emoji: string) {
    const ta = ref.current;
    const caret = ta?.selectionStart ?? value.length;
    const next = value.slice(0, caret) + emoji + value.slice(caret);
    setValue(next);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = caret + emoji.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const msg = value.trim();
    if (!msg) return;
    onSubmit(msg);
    setValue("");
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={ref}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          rows={compact ? 2 : 3}
          placeholder={placeholder}
          className="resize-none pr-2"
        />
        {suggestions.length > 0 ? (
          <div className="absolute left-2 top-full z-20 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
            <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Mention
            </p>
            <ul>
              {suggestions.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => applyMention(u.handle)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>{u.name}</span>
                    <span className="text-xs text-muted-foreground">@{u.handle}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
            >
              <Smile className="size-4" /> Emoji
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1">
            <div className="flex gap-1">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="rounded p-1 text-lg hover:bg-accent"
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => insertEmoji("@")}
        >
          <AtSign className="size-4" /> Mention
        </Button>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          ⌘/Ctrl + Enter to send
        </span>
        <div className={cn("ml-auto flex items-center gap-2")}>
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={submit} disabled={!value.trim()}>
            <Send className="size-3.5" /> {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
