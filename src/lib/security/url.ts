/**
 * URL / link sanitization — the single source of truth for deciding whether a
 * user- or model-supplied URL is safe to place in an `href`/`src`.
 *
 * Blocks script-bearing schemes (`javascript:`, `data:`, `vbscript:`, `file:`)
 * that turn a link into an XSS or local-file-read vector. Used by the markdown
 * renderer and anywhere untrusted URLs are surfaced.
 */

/** Absolute schemes we allow in rendered links. */
export const SAFE_URL_SCHEMES = ["http:", "https:", "mailto:", "tel:"] as const;

// ASCII control characters (incl. tab/newline) — browsers ignore these when
// resolving a scheme, so `java\tscript:` executes. Strip them before matching.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/** True for relative, root-relative, or in-page (hash/query) links. */
function isRelativeLink(value: string): boolean {
  return /^(\/|\.|#|\?)/.test(value);
}

/**
 * Returns a safe href, or `null` when the URL must not be rendered as a link.
 * Relative and in-page links are allowed; absolute URLs must use an allow-listed
 * scheme. Control characters (a classic `javascript:` obfuscation) are removed
 * before the scheme is examined.
 */
export function safeUrl(value: string): string | null {
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (!cleaned) return null;
  if (isRelativeLink(cleaned)) return cleaned;

  const lower = cleaned.toLowerCase();
  if (SAFE_URL_SCHEMES.some((scheme) => lower.startsWith(scheme))) return cleaned;

  // Reject any other explicit scheme (e.g. `javascript:`, `data:`, `vbscript:`).
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return null;

  // A bare `example.com/path` (no scheme, not relative) — treat as external https.
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(cleaned)) return `https://${cleaned}`;

  return null;
}

/** Boolean form of {@link safeUrl}. */
export function isSafeUrl(value: string): boolean {
  return safeUrl(value) !== null;
}
