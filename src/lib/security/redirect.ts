/**
 * Post-login redirect hardening.
 *
 * The auth flow round-trips the page the user was heading to via a `redirect`
 * search param. Without validation this is a classic **open-redirect**: an
 * attacker links to `/auth?redirect=https://evil.example` and the victim is
 * bounced off-site (credential phishing) right after authenticating.
 *
 * {@link toSafeInternalPath} guarantees the value is a *same-origin path* and
 * never an absolute or protocol-relative URL.
 */

const DEFAULT_PATH = "/app";

/**
 * Normalize an untrusted redirect target to a safe, same-origin path.
 *
 * Accepts either a bare path (`/app/tasks`) or a full same-origin href and
 * returns `path + search + hash`. Anything cross-origin, protocol-relative
 * (`//evil.com`), backslash-tricked (`/\evil.com`), or scheme-bearing collapses
 * to {@link DEFAULT_PATH}.
 */
export function toSafeInternalPath(
  value: string | undefined | null,
  fallback: string = DEFAULT_PATH,
): string {
  if (!value) return fallback;
  const raw = value.trim();

  // Reject protocol-relative (`//host`) and backslash variants outright.
  if (/^[\\/]{2}/.test(raw) || raw.startsWith("/\\") || raw.startsWith("\\")) return fallback;

  // Bare path: must start with a single "/" and not be a scheme.
  if (raw.startsWith("/")) return raw;

  // Otherwise try to parse as an absolute URL and keep it only if same-origin.
  try {
    const origin =
      typeof window !== "undefined" && window.location ? window.location.origin : undefined;
    if (!origin) return fallback;
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}
