/**
 * Minimal contenteditable rich-text editor — bold, italic, lists, links.
 *
 * Deliberately not a WYSIWYG library. The broadcast body needs four formatting
 * options, and the output is sanitized to a twelve-tag allow-list before it is
 * stored, so a full editor framework would be several hundred kilobytes spent
 * producing markup that is then thrown away.
 *
 * `document.execCommand` is formally deprecated but remains the only built-in
 * way to do this without a dependency, and is still implemented across every
 * current browser. It is confined to this component: everything downstream sees
 * plain HTML, so replacing this editor later touches nothing else.
 *
 * The editor is UNCONTROLLED by design — writing `innerHTML` on every keystroke
 * would reset the caret to the start of the field on every character typed.
 * The parent receives changes through `onChange` and must not feed `value` back.
 */
import { useCallback, useEffect, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { safeUrl } from "@/lib/security/url";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  /** Initial HTML. Read ONCE on mount — see the note above about the caret. */
  initialHtml?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  "aria-labelledby"?: string;
}

interface ToolbarAction {
  icon: typeof Bold;
  label: string;
  command: string;
}

const ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: "Bold", command: "bold" },
  { icon: Italic, label: "Italic", command: "italic" },
  { icon: List, label: "Bulleted list", command: "insertUnorderedList" },
  { icon: ListOrdered, label: "Numbered list", command: "insertOrderedList" },
];

export function RichTextEditor({
  initialHtml = "",
  onChange,
  placeholder = "Write your message…",
  className,
  "aria-labelledby": labelledBy,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Seed the initial content once. Re-running this on every `initialHtml`
  // change would fight the user's caret while they type.
  useEffect(() => {
    const el = editorRef.current;
    if (el && initialHtml && el.innerHTML === "") el.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    onChange(editorRef.current?.innerHTML ?? "");
  }, [onChange]);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      emit();
    },
    [emit],
  );

  const addLink = useCallback(() => {
    const input = window.prompt("Link URL");
    if (!input) return;
    // Validated with the same helper the sanitizer uses, so an unusable link is
    // rejected here rather than silently stripped on send.
    const href = safeUrl(input);
    if (!href) {
      window.alert("That link isn't a valid web or email address.");
      return;
    }
    exec("createLink", href);
  }, [exec]);

  // Paste as PLAIN TEXT. Pasted rich markup would be stripped by the sanitizer
  // anyway, so accepting it would show formatting in the composer that silently
  // disappears from the sent email.
  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emit();
    },
    [emit],
  );

  return (
    <div className={cn("rounded-lg border border-border bg-background", className)}>
      <div className="flex items-center gap-0.5 border-b border-border p-1">
        {ACTIONS.map(({ icon: Icon, label, command }) => (
          <Tooltip key={command}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                // onMouseDown, not onClick: clicking a button blurs the editor
                // and collapses the selection before the command would run.
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec(command);
                }}
                aria-label={label}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onMouseDown={(e) => {
                e.preventDefault();
                addLink();
              }}
              aria-label="Insert link"
            >
              <Link2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert link</TooltipContent>
        </Tooltip>
      </div>

      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        dir="auto"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        className={cn(
          "min-h-40 max-h-80 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          "[&_a]:text-primary [&_a]:underline",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        )}
      />
    </div>
  );
}
