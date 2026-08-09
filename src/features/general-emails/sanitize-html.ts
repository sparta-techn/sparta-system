/**
 * Allow-list sanitizer for the broadcast composer's rich text.
 *
 * The composer produces HTML that is stored, re-rendered into the preview, and
 * mailed to every employee — three places where untrusted markup would be a
 * problem. Everything outside the allow-list below is removed.
 *
 * Deliberately dependency-free and PURE: it must run on the server, where there
 * is no DOM, so a DOM-based sanitizer would drag in jsdom for a body that only
 * ever needs bold, italics, links and lists. It is a tokenizer over a tiny tag
 * set rather than a general-purpose HTML parser — which is exactly why the tag
 * set has to stay tiny.
 *
 * The rules:
 *   * Only the tags in {@link ALLOWED_TAGS} survive; unknown tags are dropped
 *     but their TEXT is kept, so pasting from a word processor loses formatting
 *     rather than content.
 *   * {@link VOID_CONTENT_TAGS} are dropped along with everything inside them —
 *     keeping the body of a `<script>` as escaped text would be inert but
 *     absurd.
 *   * Attributes are dropped entirely except `href` on `<a>`, which must pass
 *     `safeUrl()` (the same gate the markdown renderer uses). Surviving links
 *     are forced to `rel="noopener noreferrer"`.
 *   * Text is HTML-escaped, so a stray `<` or `&` can never reopen a tag.
 */
import { safeUrl } from "@/lib/security/url";

/** Tags a broadcast body may contain. Bold, italics, links, lists, structure. */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
]);

/** Tags whose CONTENT is discarded along with the tag itself. */
const VOID_CONTENT_TAGS = new Set(["script", "style", "iframe", "object", "embed", "template"]);

/** Tags that never have a closing partner. */
const SELF_CLOSING = new Set(["br"]);

/**
 * A `&` that does NOT already begin a valid character reference. Escaping those
 * too would turn `&amp;` into `&amp;amp;` on every pass, so a body sanitized
 * twice — stored, then re-sanitized on edit — would visibly corrupt. An entity
 * reference cannot open a tag, so leaving intact ones alone is safe.
 */
const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g;

/** Escape text so it can never reopen a tag. Idempotent. */
export function escapeText(value: string): string {
  return value
    .replace(BARE_AMPERSAND, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pull the `href` out of a tag's raw attribute string, if present. */
function extractHref(attributes: string): string | null {
  const match = attributes.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? null;
}

/**
 * Sanitize a rich-text body to the allow-list above.
 *
 * Returns HTML safe to store, preview and email. Unbalanced or stray closing
 * tags are dropped rather than trusted, and any tag left open by the author is
 * closed at the end so the surrounding email layout cannot be broken.
 */
export function sanitizeEmailHtml(input: string): string {
  const out: string[] = [];
  const openTags: string[] = [];
  // Name of the void-content tag we're currently inside (and discarding).
  let skipping: string | null = null;

  const tokenizer = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenizer.exec(input)) !== null) {
    const text = input.slice(lastIndex, match.index);
    if (!skipping && text) out.push(escapeText(text));
    lastIndex = tokenizer.lastIndex;

    const raw = match[0];
    // Comments carry no content worth keeping and can hide conditional markup.
    if (raw.startsWith("<!--")) continue;

    const name = (match[1] ?? "").toLowerCase();
    const isClosing = raw.startsWith("</");

    if (skipping) {
      // Only the matching close ends a discarded region.
      if (isClosing && name === skipping) skipping = null;
      continue;
    }

    if (VOID_CONTENT_TAGS.has(name)) {
      if (!isClosing && !raw.endsWith("/>")) skipping = name;
      continue;
    }

    if (!ALLOWED_TAGS.has(name)) continue; // Drop the tag, keep surrounding text.

    if (isClosing) {
      // Ignore a closing tag with no matching open — it would leak into the shell.
      const at = openTags.lastIndexOf(name);
      if (at === -1) continue;
      // Close anything still open inside it, innermost first.
      for (let i = openTags.length - 1; i >= at; i--) out.push(`</${openTags[i]}>`);
      openTags.splice(at);
      continue;
    }

    if (SELF_CLOSING.has(name)) {
      out.push(`<${name} />`);
      continue;
    }

    if (name === "a") {
      const href = extractHref(match[2] ?? "");
      const safe = href ? safeUrl(href) : null;
      if (!safe) continue; // An unsafe link becomes plain text, not a dead <a>.
      out.push(`<a href="${escapeText(safe)}" rel="noopener noreferrer">`);
      openTags.push("a");
      continue;
    }

    // Every other allowed tag keeps its name and loses all attributes.
    out.push(`<${name}>`);
    openTags.push(name);
  }

  const tail = input.slice(lastIndex);
  if (!skipping && tail) out.push(escapeText(tail));

  // Close anything the author left open, innermost first.
  for (let i = openTags.length - 1; i >= 0; i--) out.push(`</${openTags[i]}>`);

  return out.join("").trim();
}

/** True when a sanitized body has no visible content (only markup/whitespace). */
export function isEmptyHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim().length === 0
  );
}
