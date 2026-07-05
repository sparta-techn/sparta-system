/**
 * Supabase (platform) provider config.
 *
 * This is the *monitoring* adapter for SpartaFlow's own Supabase project (project
 * health, storage, custom-domain SSL, compute size) — distinct from
 * `src/integrations/supabase/`, which is the app's runtime DB/auth client. It
 * lives in its own folder to keep those concerns separate.
 *
 * Reads go through the Supabase Management API with a personal access token; the
 * project **service-role key is never used here** (CLAUDE.md Security).
 */

export interface SupabasePlatformClientConfig {
  /** Management API base, e.g. https://api.supabase.com. */
  apiBaseUrl?: string;
  /** The Supabase project ref being monitored. */
  projectRef?: string;
  /** Resolves the Management API personal access token for the account. */
  resolveToken?: (accountId: string) => Promise<string>;
}
