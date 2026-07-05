/**
 * Redaction — scrub sensitive values before a record leaves the process.
 *
 * Logs, audit `before`/`after` snapshots, and error payloads routinely carry
 * fields that must never reach a console or a third-party sink (passwords,
 * tokens, government ids, salary bands — see `docs/AuditSystem.md` §9 and
 * `docs/SECURITY.md`). This runs at emit time on every structured payload, so
 * call sites don't have to remember to sanitize.
 *
 * Depth- and cycle-safe: deep structures are truncated and repeated references
 * collapse to `"<circular>"` so redaction can't blow the stack or loop forever.
 */

/** The placeholder written in place of a sensitive value. */
export const REDACTED = "<redacted>";

/** Key patterns whose values are always masked (case-insensitive substrings). */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /pass(word|phrase)?/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /access[-_]?key/i,
  /client[-_]?secret/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /private[-_]?key/i,
  /ssn|social[-_]?security/i,
  /salary|compensation|pay[-_]?rate/i,
  /card[-_]?number|cvv|cvc/i,
  /pin\b/i,
  /otp|one[-_]?time/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

export interface RedactOptions {
  /** Max nesting depth before truncating with "<max-depth>". Default 6. */
  maxDepth?: number;
  /** Additional key patterns to treat as sensitive. */
  extraKeys?: readonly RegExp[];
}

/**
 * Return a redacted deep copy of `value`. Objects/arrays are cloned; sensitive
 * keys are replaced with {@link REDACTED}; functions and symbols are dropped.
 */
export function redact(value: unknown, options: RedactOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? 6;
  const extra = options.extraKeys ?? [];
  const seen = new WeakSet<object>();

  const sensitive = (key: string) => isSensitiveKey(key) || extra.some((re) => re.test(key));

  function walk(input: unknown, depth: number): unknown {
    if (input === null || typeof input !== "object") {
      return typeof input === "function" || typeof input === "symbol" ? undefined : input;
    }
    if (depth >= maxDepth) return "<max-depth>";
    if (seen.has(input as object)) return "<circular>";
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map((item) => walk(item, depth + 1));
    }

    // Preserve common non-plain objects as readable primitives.
    if (input instanceof Date) return input.toISOString();
    if (input instanceof Error) {
      return { name: input.name, message: input.message };
    }

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      out[key] = sensitive(key) ? REDACTED : walk(val, depth + 1);
    }
    return out;
  }

  return walk(value, 0);
}

/** Redact a plain record, guaranteeing an object result (or undefined). */
export function redactRecord(
  value: Record<string, unknown> | null | undefined,
  options?: RedactOptions,
): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  return redact(value, options) as Record<string, unknown>;
}

/**
 * Mask an email to `j***@e***.com` — enough to correlate reports without
 * storing the address in plaintext. Non-emails return {@link REDACTED}.
 */
export function maskEmail(email: string | undefined | null): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at < 1) return REDACTED;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const tld = dot > -1 ? domain.slice(dot) : "";
  const maskedLocal = `${local[0]}***`;
  const maskedDomain = domain.length > 0 ? `${domain[0]}***` : "***";
  return `${maskedLocal}@${maskedDomain}${tld}`;
}
