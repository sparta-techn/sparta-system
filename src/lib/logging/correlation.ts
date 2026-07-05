/**
 * Correlation + ambient context.
 *
 * A correlation id threads a single logical operation (a request, a user
 * gesture) across every log stream — application, error, audit, auth,
 * performance — and, on the server, into DB audit rows via
 * `set_config('request.correlation_id')` (see `docs/AuditSystem.md` §7).
 *
 * The "current context" here is a lightweight module-level store: it holds the
 * ambient {@link LogContext} the default logger stamps onto records. It is
 * deliberately simple (no `AsyncLocalStorage`) so the module stays isomorphic
 * across browser / SSR / edge builds. Server request middleware should prefer
 * {@link runWithContext} to scope a correlation id to one request and restore
 * the previous context afterwards.
 */
import type { LogContext } from "./types";

/** RFC-4122 v4 id, using the platform crypto when available. */
export function newCorrelationId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback for runtimes without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let currentContext: LogContext = {};

/** The ambient context merged into every record by the default logger. */
export function getLogContext(): LogContext {
  return currentContext;
}

/** Merge fields into the ambient context (shallow). Returns the new context. */
export function setLogContext(patch: LogContext): LogContext {
  currentContext = { ...currentContext, ...patch };
  return currentContext;
}

/** Replace the ambient context wholesale (rarely needed; prefer merge). */
export function resetLogContext(next: LogContext = {}): void {
  currentContext = next;
}

/** Ensure a correlation id exists in the ambient context; returns it. */
export function ensureCorrelationId(): string {
  if (!currentContext.correlationId) {
    currentContext = { ...currentContext, correlationId: newCorrelationId() };
  }
  return currentContext.correlationId as string;
}

/**
 * Run `fn` with `context` merged into the ambient context, restoring the
 * previous context afterwards (even if `fn` throws). Synchronous scoping is
 * sufficient for our request/gesture boundaries; the previous context is
 * captured by closure so nested calls compose.
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  const previous = currentContext;
  currentContext = { ...previous, ...context };
  try {
    return fn();
  } finally {
    currentContext = previous;
  }
}
