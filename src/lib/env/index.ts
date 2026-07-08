/**
 * Environment schema + validation (isomorphic, side-effect-free).
 *
 * This module only DECLARES schemas and pure `validate*` helpers — it never
 * reads `process.env` / `import.meta.env` at import time, so importing it can
 * never pull a secret into a bundle. Callers pass the source object:
 *   • server / scripts → `process.env`
 *   • browser build     → `import.meta.env`
 *
 * Used by `scripts/validate-env.ts` (fail-fast in CI / prebuild). See
 * docs/ENVIRONMENT.md. The actual env READS still live in the existing Supabase
 * clients and logging config — this only guards that they'll find valid values.
 */
import { z } from "zod";

const nonEmpty = z.string().min(1);
const urlLike = z.string().url();
const logLevel = z.enum(["debug", "info", "warn", "error"]);
const boolish = z.enum(["true", "false"]);

/** VITE_* values — public, inlined into the browser bundle at build time. */
export const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: urlLike,
  VITE_SUPABASE_PUBLISHABLE_KEY: nonEmpty,
  VITE_SUPABASE_PROJECT_ID: nonEmpty,
  VITE_LOG_LEVEL: logLevel.optional(),
  VITE_RELEASE: z.string().optional(),
  VITE_COMMIT_SHA: z.string().optional(),
});

/** Server-side values — read at runtime via process.env. Secrets live here. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: urlLike,
  SUPABASE_PUBLISHABLE_KEY: nonEmpty,
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  SUPABASE_PROJECT_ID: z.string().optional(),
  ENFORCE_CSP: boolish.optional(),
  LOG_LEVEL: logLevel.optional(),
  RELEASE: z.string().optional(),
  COMMIT_SHA: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Which slice of the environment to validate. */
export type EnvScope = "client" | "server";

export interface EnvValidationResult {
  success: boolean;
  /** Human-readable `KEY: message` lines for each failure. */
  errors: string[];
  /** Non-fatal advisories (e.g. a secret mistakenly given a VITE_ name). */
  warnings: string[];
}

/** Keys that must NEVER appear with a VITE_ prefix (would leak to the client). */
const FORBIDDEN_VITE_KEYS = ["VITE_SUPABASE_SERVICE_ROLE_KEY"] as const;

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

/** Detect secrets that were accidentally exposed via a VITE_ prefix. */
function leakWarnings(source: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  for (const key of FORBIDDEN_VITE_KEYS) {
    if (source[key] !== undefined && source[key] !== "") {
      warnings.push(
        `${key} is set — a service-role/secret must NEVER be VITE_-prefixed (it inlines into the browser bundle).`,
      );
    }
  }
  return warnings;
}

/**
 * Validate one scope of the environment against its schema.
 * Returns a structured result; never throws (use {@link assertEnv} to throw).
 */
export function validateEnv(scope: EnvScope, source: Record<string, unknown>): EnvValidationResult {
  const schema = scope === "client" ? clientEnvSchema : serverEnvSchema;
  const parsed = schema.safeParse(source);
  const warnings = scope === "server" ? leakWarnings(source) : [];
  return {
    success: parsed.success,
    errors: parsed.success ? [] : formatIssues(parsed.error),
    warnings,
  };
}

/** Validate and throw a formatted error on failure. Returns the parsed env. */
export function assertEnv<S extends EnvScope>(
  scope: S,
  source: Record<string, unknown>,
): S extends "client" ? ClientEnv : ServerEnv {
  const schema = scope === "client" ? clientEnvSchema : serverEnvSchema;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = formatIssues(parsed.error)
      .map((l) => `  - ${l}`)
      .join("\n");
    throw new Error(`Invalid ${scope} environment:\n${lines}`);
  }
  return parsed.data as S extends "client" ? ClientEnv : ServerEnv;
}
