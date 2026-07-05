/**
 * Link-target sanitization for rendered markdown.
 *
 * Thin wrapper over the shared {@link safeUrl} primitive so the assistant's
 * markdown renderer and the rest of the app enforce the *same* URL policy:
 * `javascript:`, `data:`, `vbscript:` and other non-allow-listed schemes are
 * rejected; relative, in-page, http(s), mailto and tel links are allowed.
 *
 * @returns the href to use, or `null` when it must not be rendered as a link.
 */
import { safeUrl } from "@/lib/security/url";

export function safeHref(href: string): string | null {
  return safeUrl(href);
}
