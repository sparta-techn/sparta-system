/**
 * Markdown — a small, dependency-free renderer for the subset the assistant
 * produces: headings, bold/italic, inline code, fenced code blocks, GFM pipe
 * tables, ordered/unordered lists, blockquotes, horizontal rules and links.
 *
 * Intentionally minimal and safe: it builds React nodes (no
 * `dangerouslySetInnerHTML`), so there is no HTML-injection surface. Swap for a
 * full markdown pipeline later without changing callers. Block parsing lives in
 * `markdown-parse.ts`.
 */
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";
import { safeHref } from "./link-safety";
import { parseMarkdown, type MarkdownBlock } from "./markdown-parse";

const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;

/** Render inline markdown (code, bold, italic, links) into React nodes. */
function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  INLINE_RE.lastIndex = 0;

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = linkMatch ? safeHref(linkMatch[2]) : null;
      if (linkMatch && href) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>,
        );
      } else if (linkMatch) {
        // Unsafe scheme (e.g. javascript:) — render the label as plain text.
        nodes.push(linkMatch[1]);
      } else {
        nodes.push(token);
      }
    } else {
      // *italic* or _italic_
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlock(block: MarkdownBlock, key: string): ReactNode {
  switch (block.type) {
    case "code":
      return <CodeBlock key={key} code={block.code} language={block.lang} />;

    case "table":
      return (
        <div key={key} className="my-3 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {block.headers.map((h, hi) => (
                  <TableHead key={hi}>{renderInline(h, `${key}-h${hi}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => (
                    <TableCell key={ci}>{renderInline(cell, `${key}-r${ri}c${ci}`)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case "heading": {
      const sizes: Record<number, string> = {
        1: "text-xl font-semibold",
        2: "text-lg font-semibold",
        3: "text-base font-semibold",
        4: "text-sm font-semibold",
        5: "text-sm font-medium",
        6: "text-sm font-medium text-muted-foreground",
      };
      return (
        <p key={key} className={cn("mt-4 mb-1 first:mt-0", sizes[block.level])}>
          {renderInline(block.text, key)}
        </p>
      );
    }

    case "list": {
      const cls = "my-2 ml-5 space-y-1 " + (block.ordered ? "list-decimal" : "list-disc");
      const items = block.items.map((item, ii) => (
        <li key={ii} className="leading-relaxed">
          {renderInline(item, `${key}-li${ii}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} className={cls}>
          {items}
        </ol>
      ) : (
        <ul key={key} className={cls}>
          {items}
        </ul>
      );
    }

    case "quote":
      return (
        <blockquote
          key={key}
          className="my-3 border-l-2 border-border pl-3 text-muted-foreground italic"
        >
          {renderInline(block.text, key)}
        </blockquote>
      );

    case "hr":
      return <hr key={key} className="my-4 border-border" />;

    case "paragraph":
      return (
        <p key={key} className="my-2 leading-relaxed first:mt-0 last:mb-0">
          {renderInline(block.text, key)}
        </p>
      );
  }
}

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  const blocks = parseMarkdown(content);
  return (
    <div className={cn("text-sm text-foreground", className)}>
      {blocks.map((block, i) => renderBlock(block, `b${i}`))}
    </div>
  );
}
