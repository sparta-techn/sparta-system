/**
 * Validation boundary for write paths.
 *
 * Every mutation that reaches Supabase should first pass through a `zod` schema
 * so malformed, oversized, or unexpected input never becomes a persisted row.
 * `validate` runs a schema and, on failure, throws a normalized
 * {@link ValidationError} that carries field-level issues for the UI.
 */
import { z } from "zod";

export interface FieldIssue {
  path: string;
  message: string;
}

/** Thrown when input fails schema validation at a service/mutation boundary. */
export class ValidationError extends Error {
  readonly issues: FieldIssue[];

  constructor(message: string, issues: FieldIssue[]) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * Parse `input` against `schema`, returning the typed, sanitized value.
 * Throws {@link ValidationError} (never a raw `ZodError`) on failure.
 */
export function validate<T>(schema: z.ZodType<T>, input: unknown, label = "input"): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issues: FieldIssue[] = result.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  const summary = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");
  throw new ValidationError(`Invalid ${label}: ${summary}`, issues);
}

/** Non-throwing variant — returns `{ ok, data | issues }`. */
export function tryValidate<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; issues: FieldIssue[] } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}
