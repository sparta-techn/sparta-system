/**
 * Integration-layer error contract. Mirrors `AIError` (`src/ai/utils/errors.ts`)
 * and `ServiceError` (`src/services/core/errors.ts`): one predictable shape with
 * a stable, machine-readable code so callers never handle raw provider errors.
 */

export type IntegrationErrorCode =
  | "not_implemented"
  | "unknown_provider"
  | "invalid_request"
  | "unauthorized"
  | "not_connected"
  | "rate_limited"
  | "provider_unavailable"
  | "sync_conflict";

export interface IntegrationErrorDetail {
  field?: string;
  message: string;
}

export class IntegrationError extends Error {
  /** Stable, machine-readable code. */
  readonly code: IntegrationErrorCode;
  /** Optional field-level detail (e.g. from `validate`). */
  readonly details?: IntegrationErrorDetail[];
  /** Originating error, preserved for logging/audit. */
  readonly cause?: unknown;

  constructor(
    code: IntegrationErrorCode,
    message: string,
    options: { details?: IntegrationErrorDetail[]; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.details = options.details;
    this.cause = options.cause;
  }
}

/**
 * Thrown by placeholder adapters until a real integration is wired. Keeps the
 * "no external APIs yet" boundary explicit and greppable.
 */
export function notImplemented(what: string): never {
  throw new IntegrationError(
    "not_implemented",
    `${what} is not implemented yet (placeholder — no external API calls wired).`,
  );
}
