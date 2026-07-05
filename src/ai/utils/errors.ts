/**
 * AI-layer error contract. Mirrors the service layer's `ServiceError` idea: a
 * single, predictable error shape with a stable machine-readable code so callers
 * (services, hooks, UI) never handle raw provider errors.
 */

export type AIErrorCode =
  | "not_implemented"
  | "unknown_provider"
  | "unknown_model"
  | "invalid_request"
  | "provider_error"
  | "aborted";

export class AIError extends Error {
  /** Stable, machine-readable code. */
  readonly code: AIErrorCode;
  /** Originating error, preserved for logging/audit. */
  readonly cause?: unknown;

  constructor(code: AIErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.cause = cause;
  }
}

/** Thrown by placeholder adapters until a real integration lands. */
export function notImplemented(what: string): never {
  throw new AIError(
    "not_implemented",
    `${what} is not implemented yet (placeholder — no API calls wired).`,
  );
}
