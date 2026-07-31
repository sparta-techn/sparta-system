/**
 * Service-layer error contract.
 *
 * Every service normalizes failures (Supabase/Postgrest errors, auth errors,
 * validation failures) into a {@link ServiceError} so callers — hooks,
 * components, TanStack Query — handle a single, predictable shape.
 */
export class ServiceError extends Error {
  /** Stable machine-readable code (e.g. Postgrest code, `not_found`). */
  readonly code: string;
  /** Originating error, preserved for logging/audit. */
  readonly cause?: unknown;

  constructor(message: string, code = "service_error", cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
  }
}

interface MaybePostgrestError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Wrap any thrown/returned error into a {@link ServiceError}. Used by every
 * service method so persistence details never leak raw into the UI.
 */
export function toServiceError(error: unknown, fallback = "Request failed"): ServiceError {
  if (error instanceof ServiceError) return error;

  if (error && typeof error === "object") {
    const e = error as MaybePostgrestError;
    return new ServiceError(e.message ?? fallback, e.code ?? "service_error", error);
  }

  if (typeof error === "string") return new ServiceError(error);
  return new ServiceError(fallback, "service_error", error);
}

/** Throw when a single-row lookup returns nothing. */
export function notFound(entity: string, id: string): ServiceError {
  return new ServiceError(`${entity} "${id}" was not found`, "not_found");
}

/**
 * Thrown when a delete matched **zero rows**.
 *
 * PostgREST does not treat this as an error: when RLS filters the target row
 * out of the delete's scope (or the row is simply already gone) it returns
 * `200` with an empty array and no `error`. Without an explicit check, the
 * caller cannot distinguish "deleted" from "silently refused" — the delete
 * looks successful while nothing happened.
 *
 * Callers that legitimately tolerate an already-absent row should pass
 * `{ allowNoRows: true }` to `BaseService.remove` rather than catching this.
 */
export class DeleteAffectedNoRowsError extends ServiceError {
  /** Entity name of the service that attempted the delete. */
  readonly entity: string;
  /** Id that matched no rows. */
  readonly id: string;

  constructor(entity: string, id: string) {
    super(
      `Couldn't delete ${entity} "${id}" — it no longer exists, or you don't have permission to delete it.`,
      "delete_affected_no_rows",
    );
    this.name = "DeleteAffectedNoRowsError";
    this.entity = entity;
    this.id = id;
  }
}
