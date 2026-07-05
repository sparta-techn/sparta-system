/**
 * Supabase infrastructure — client + environment loading.
 *
 * This module is the infrastructure entry point for `src/lib/supabase`. It owns
 * environment-variable resolution and re-exports the app's single browser
 * Supabase client so auth / storage / realtime helpers all share one instance
 * (a second client would break auth-token sharing and realtime sockets).
 *
 * It intentionally reuses the generated client in `@/integrations/supabase`
 * rather than constructing a duplicate (see CLAUDE.md — no duplicate clients).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Strongly-typed Supabase client bound to the generated `Database` schema. */
export type AppSupabaseClient = SupabaseClient<Database>;

/** Resolved, validated Supabase environment configuration. */
export interface SupabaseEnv {
  url: string;
  publishableKey: string;
  projectId: string;
}

/**
 * Read a Supabase env var across both runtimes.
 *
 * - Browser / Vite build: `import.meta.env.VITE_*` (statically replaced).
 * - SSR / server functions: `process.env.*` (no `VITE_` prefix).
 */
function readEnv(viteKey: string, serverKey: string): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)[viteKey]
      : undefined;
  const fromProcess = typeof process !== "undefined" ? process.env?.[serverKey] : undefined;
  return fromVite || fromProcess;
}

let _env: SupabaseEnv | undefined;

/**
 * Resolve and validate the Supabase environment once.
 *
 * Throws a descriptive error listing every missing variable so misconfiguration
 * fails fast and loudly instead of producing opaque network errors later.
 */
export function getSupabaseEnv(): SupabaseEnv {
  if (_env) return _env;

  const url = readEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const publishableKey = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
  const projectId = readEnv("VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID");

  const missing = [
    ...(!url ? ["SUPABASE_URL"] : []),
    ...(!publishableKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
  if (missing.length > 0) {
    throw new Error(
      `[Supabase] Missing environment variable(s): ${missing.join(", ")}. ` +
        `See docs/SUPABASE_SETUP.md.`,
    );
  }

  _env = {
    url: url as string,
    publishableKey: publishableKey as string,
    projectId: projectId ?? "",
  };
  return _env;
}

/** `true` when the required Supabase env vars are present (non-throwing). */
export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * The shared browser Supabase client. Lazily initialized — importing this module
 * does not connect to Supabase; the client is created on first property access.
 */
export const supabaseClient: AppSupabaseClient = supabase;

/** Accessor form, for call sites that prefer a function over the binding. */
export function getSupabaseClient(): AppSupabaseClient {
  return supabaseClient;
}
