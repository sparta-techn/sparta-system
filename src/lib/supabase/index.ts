/**
 * Supabase infrastructure layer (`src/lib/supabase`).
 *
 * Low-level, framework-agnostic Supabase primitives — the shared client, env
 * loading, and typed auth / storage / realtime helpers. Higher layers
 * (`src/services`, `features/*`) compose these. Not wired into the UI yet.
 */
export { supabaseClient, getSupabaseClient, getSupabaseEnv, isSupabaseConfigured } from "./client";
export type { AppSupabaseClient, SupabaseEnv } from "./client";

export * as supabaseAuth from "./auth";
export * as supabaseStorage from "./storage";
export * as supabaseRealtime from "./realtime";
