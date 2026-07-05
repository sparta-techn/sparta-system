/**
 * Pure markdown block parser (no React). Splits a markdown string into a flat
 * list of blocks the {@link Markdown} component renders. Kept dependency-free and
 * separate from the component so it stays unit-testable and fast-refresh-clean.
 */

export type MarkdownBlock =
  | { type: "code"; lang?: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

const CODE_FENCE = /^```(\w*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^(?:---|\*\*\*|___)\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+\.\s+/;
const QUOTE = /^>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?[\s:|-]+\|?\s*$/;

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Parse a markdown string into a flat list of blocks. */
export function parseMarkdown(input: string): MarkdownBlock[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(CODE_FENCE);
    if (fence) {
      const lang = fence[1] || undefined;
      const body: string[] = [];
      i++;
      while (i < lines.length && !CODE_FENCE.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "code", lang, code: body.join("\n") });
      continue;
    }

    // Blank line.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule.
    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading.
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // GFM table: header row + separator row.
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      TABLE_SEP.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // Blockquote (consecutive).
    if (QUOTE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quote.push(lines[i].replace(QUOTE, "$1"));
        i++;
      }
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }

    // List (consecutive items).
    if (LIST_ITEM.test(line)) {
      const ordered = ORDERED_ITEM.test(line);
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(lines[i].replace(LIST_ITEM, "$1"));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph (consecutive plain lines).
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !CODE_FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !HR.test(lines[i]) &&
      !LIST_ITEM.test(lines[i]) &&
      !QUOTE.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}
