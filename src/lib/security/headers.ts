/**
 * HTTP security response headers.
 *
 * Applied to every server response in `src/server.ts`. Split into:
 *  - **always-on** hardening (cheap, non-breaking): nosniff, referrer policy,
 *    permissions policy, cross-domain policy, DNS-prefetch.
 *  - **production-only**: `Strict-Transport-Security`, `X-Frame-Options: DENY`
 *    (clickjacking). These are gated off in dev so the Lovable preview iframe
 *    keeps working.
 *  - **Content-Security-Policy** shipped in **Report-Only** mode by default so it
 *    cannot break the app during rollout. Flip `enforceCsp` on once the report
 *    stream is clean. See `docs/SECURITY.md`.
 */

export interface SecurityHeaderOptions {
  isProduction: boolean;
  /** Supabase project origin, used to scope `connect-src`. */
  supabaseUrl?: string;
  /** Emit `Content-Security-Policy` (enforcing) instead of Report-Only. */
  enforceCsp?: boolean;
}

/** Build the CSP directive string. */
export function buildContentSecurityPolicy(supabaseUrl?: string): string {
  const connectExtra: string[] = ["'self'"];
  if (supabaseUrl) {
    try {
      const { origin, host } = new URL(supabaseUrl);
      connectExtra.push(origin, `wss://${host}`);
    } catch {
      /* ignore malformed URL */
    }
  } else {
    // Fall back to Supabase's public domains for REST + realtime websockets.
    connectExtra.push("https://*.supabase.co", "wss://*.supabase.co");
  }

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "base-uri": "'self'",
    "object-src": "'none'",
    "frame-ancestors": "'none'",
    "form-action": "'self'",
    // SSR hydration injects inline bootstrap; without per-request nonces this
    // needs 'unsafe-inline'. Upgrade to nonce-based script-src when ready.
    "script-src": "'self' 'unsafe-inline'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob: https:",
    "font-src": "'self' data:",
    "connect-src": connectExtra.join(" "),
    "worker-src": "'self' blob:",
  };

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ");
}

/**
 * Header name/value pairs to merge onto a response. Never overwrites an existing
 * header (call sites use `.set` only for keys not already present).
 */
export function securityHeaders(opts: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  };

  const csp = buildContentSecurityPolicy(opts.supabaseUrl);
  headers[opts.enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"] =
    csp;

  if (opts.isProduction) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
    headers["X-Frame-Options"] = "DENY";
  }

  return headers;
}

/** True for HTML responses that should carry the full header set. */
export function shouldApplySecurityHeaders(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  // Apply to documents and API/data responses alike; skip pre-flight/redirects
  // with no body-bearing content type only when clearly non-navigational.
  return contentType.length === 0 || /text\/html|application\/json|text\//.test(contentType);
}
