/**
 * Presentation-layer error handler — the single entry point the UI uses to turn
 * *any* thrown value into (a) a stable {@link ErrorCategory}, (b) a friendly,
 * user-safe message, and (c) a retry decision.
 *
 * It does NOT replace the domain error contracts — it unifies them:
 *   - {@link ServiceError}     (`@/services/core/errors`)       — data layer
 *   - Supabase `AuthError`     (login / session / JWT)          — auth layer
 *   - `IntegrationError`       (`@/integrations/services/errors`)
 *   - `AIError`                (`@/ai/utils/errors`)
 *
 * Every service already normalizes its failures into one of the shapes above,
 * so classification here reads codes/status first and only falls back to
 * message sniffing for raw fetch/network errors that never reached a service.
 */
import { ServiceError } from "@/services/core/errors";
import { mapAuthError } from "@/features/auth/errors";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { errorLog } from "@/lib/logging";

/**
 * Coarse buckets that drive retry policy, messaging, and routing.
 *
 * - `network`     — offline / fetch failed / timeout → retryable.
 * - `auth`        — not signed in / bad credentials / expired session.
 * - `permission`  — signed in but not allowed (RLS / RBAC / 403).
 * - `not_found`   — the requested row/route doesn't exist (404).
 * - `validation`  — the request was rejected as invalid (400 / 422 / zod).
 * - `rate_limit`  — too many requests (429).
 * - `server`      — 5xx / provider unavailable → retryable.
 * - `unknown`     — anything unclassified → treated conservatively as retryable.
 */
export type ErrorCategory =
  | "network"
  | "auth"
  | "permission"
  | "not_found"
  | "validation"
  | "rate_limit"
  | "server"
  | "unknown";

/** Shape we read across the different error contracts without narrowing hard. */
interface ErrorLike {
  name?: string;
  message?: string;
  code?: string | number;
  status?: number;
  statusCode?: number;
  cause?: unknown;
}

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === "object") return error as ErrorLike;
  if (typeof error === "string") return { message: error };
  return {};
}

/**
 * A safe, lowercased message string. Some providers hand back a non-string
 * `.message` (e.g. Supabase's `AuthRetryableFetchError` on an empty 500 body,
 * whose `message` is `{}`) — calling `.toLowerCase()` on that would throw and
 * mask the real failure, so coerce to "" unless it's actually a string.
 */
function messageText(e: ErrorLike): string {
  return typeof e.message === "string" ? e.message.toLowerCase() : "";
}

/** Numeric HTTP status if the error carries one (Supabase auth, fetch, etc.). */
function httpStatus(e: ErrorLike): number | undefined {
  const raw = e.status ?? e.statusCode;
  if (typeof raw === "number") return raw;
  if (typeof e.code === "number") return e.code;
  return undefined;
}

/** True when the failure is a connectivity problem rather than a server reply. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const e = asErrorLike(error);
  const msg = messageText(e);
  return e.name === "TypeError" && msg.includes("fetch") // browser fetch failure
    ? true
    : msg.includes("failed to fetch") ||
        msg.includes("network") ||
        msg.includes("load failed") ||
        msg.includes("networkerror") ||
        e.code === "ECONNREFUSED" ||
        e.code === "ETIMEDOUT";
}

/**
 * Classify any thrown value into an {@link ErrorCategory}. Reads structured
 * codes/status first (our own error contracts + Supabase), then falls back to
 * message sniffing only for raw network errors.
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error == null) return "unknown";
  const e = asErrorLike(error);

  // 1. Network first — an offline client can't trust any other signal.
  if (isNetworkError(error)) return "network";

  const status = httpStatus(e);
  const code = typeof e.code === "string" ? e.code.toLowerCase() : "";
  const msg = messageText(e);

  // 2. Supabase AuthError (login / session / JWT) — name or 401/403 + auth code.
  if (e.name === "AuthError" || e.name === "AuthApiError" || e.name === "AuthSessionMissingError") {
    return status === 403 ? "permission" : "auth";
  }

  // 3. HTTP status (fetch, PostgREST, provider replies).
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limit";
  if (status != null && status >= 500) return "server";

  // 4. Stable codes from ServiceError / IntegrationError / PostgREST.
  if (code === "not_found" || code === "pgrst116") return "not_found";
  if (code === "unauthorized" || code === "invalid_credentials") return "auth";
  if (code === "permission_denied" || code === "42501" || code === "insufficient_privilege")
    return "permission";
  if (code === "rate_limited") return "rate_limit";
  if (code === "provider_unavailable" || code === "not_connected") return "server";
  if (code === "invalid_request" || code === "validation_error" || code === "23514")
    return "validation";
  if (code === "23505") return "validation"; // unique_violation → user must change input

  // 5. Message fallbacks for auth/session that never carried a status.
  if (msg.includes("jwt") && msg.includes("expired")) return "auth";
  if (msg.includes("not authenticated") || msg.includes("session")) return "auth";
  if (msg.includes("permission") || msg.includes("not allowed")) return "permission";
  if (msg.includes("not found")) return "not_found";
  if (msg.includes("rate limit") || msg.includes("too many")) return "rate_limit";

  return "unknown";
}

/** True for an auth/session failure that should push the user to sign in. */
export function isAuthError(error: unknown): boolean {
  return classifyError(error) === "auth";
}

/**
 * True when the session specifically *expired* (vs. never signed in). Used to
 * route to `/auth/session-expired` rather than the generic sign-in screen.
 */
export function isSessionExpired(error: unknown): boolean {
  if (!isAuthError(error)) return false;
  const e = asErrorLike(error);
  const msg = messageText(e);
  const code = typeof e.code === "string" ? e.code.toLowerCase() : "";
  return (
    msg.includes("expired") ||
    msg.includes("jwt") ||
    e.name === "AuthSessionMissingError" ||
    code === "session_expired" ||
    httpStatus(e) === 401
  );
}

const CATEGORY_MESSAGE: Record<ErrorCategory, string> = {
  network: "Connection problem. Check your internet and try again.",
  auth: "Your session has ended. Please sign in again.",
  permission: "You don't have permission to do that.",
  not_found: "We couldn't find what you were looking for.",
  validation: "Some details look off. Please review and try again.",
  rate_limit: "Too many requests. Please wait a moment and try again.",
  server: "Something went wrong on our end. Please try again shortly.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * Turn any thrown value into a concise, user-safe message.
 *
 * - Auth errors defer to {@link mapAuthError} (already sanitized to avoid
 *   leaking which factor failed).
 * - Our own typed errors (ServiceError with a validation code) may surface their
 *   message since it was authored for users; everything else uses the category
 *   default so raw persistence/provider text never reaches the UI.
 */
export function getErrorMessage(error: unknown): string {
  const category = classifyError(error);
  if (category === "auth") return mapAuthError(error);

  // Validation messages from our own service layer are authored for humans.
  if (category === "validation" && error instanceof ServiceError && error.message) {
    return error.message;
  }
  return CATEGORY_MESSAGE[category];
}

/** Categories that represent a client/logic error — never worth retrying. */
const NON_RETRYABLE: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  "auth",
  "permission",
  "not_found",
  "validation",
  "rate_limit",
]);

/** True when retrying could plausibly succeed (network blip / transient 5xx). */
export function isRetryable(error: unknown): boolean {
  return !NON_RETRYABLE.has(classifyError(error));
}

/** Max automatic attempts for a retryable *read* before giving up. */
export const MAX_QUERY_RETRIES = 3;

/**
 * TanStack Query `retry` predicate. Retries only transient failures, and only
 * up to {@link MAX_QUERY_RETRIES}. Client/logic errors fail fast so the user
 * sees the real problem instead of a spinner that loops three times first.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  return isRetryable(error);
}

/**
 * Exponential backoff with jitter, capped at 15s. `attempt` is 0-indexed
 * (the first retry). Matches TanStack Query's `retryDelay` signature.
 */
export function retryDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

/**
 * Report an error to the observability pipeline. Fans out to:
 *   - the structured logging system ({@link errorLog}, category "error"), which
 *     routes to the console today and to Sentry/Logtail/OTel once wired; and
 *   - the Lovable in-editor error transport (client-only).
 *
 * The single entry point the app uses for "something went wrong" — global
 * query/mutation handlers and error boundaries all funnel through here.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  const category = classifyError(error);
  errorLog.capture(error, { data: context, context: { category } });
  reportLovableError(error, { category, ...context });
}
