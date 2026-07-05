/**
 * Supabase auth infrastructure.
 *
 * Thin, typed wrappers over `supabase.auth` — session primitives only (sign in /
 * out, session/user reads, auth-state subscription). Business rules (profiles,
 * roles, redirect URLs) live a layer up in `features/auth` and `src/services`;
 * this module deliberately stays low-level so both can compose it.
 *
 * Not wired into the app yet — see CLAUDE.md / task scope.
 */
import type {
  AuthChangeEvent,
  AuthResponse,
  OAuthResponse,
  Provider,
  Session,
  Subscription,
  User,
} from "@supabase/supabase-js";
import { supabaseClient } from "./client";

/** The underlying GoTrue auth namespace, for advanced use. */
export const auth = supabaseClient.auth;

/** Sign in with email + password. */
export function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  return auth.signInWithPassword({ email: email.trim(), password });
}

/** Register a new user with email + password and optional profile metadata. */
export function signUp(
  email: string,
  password: string,
  metadata?: Record<string, unknown>,
): Promise<AuthResponse> {
  return auth.signUp({
    email: email.trim(),
    password,
    options: metadata ? { data: metadata } : undefined,
  });
}

/** Begin an OAuth flow with the given provider. */
export function signInWithOAuth(provider: Provider, redirectTo?: string): Promise<OAuthResponse> {
  return auth.signInWithOAuth({
    provider,
    options: redirectTo ? { redirectTo } : undefined,
  });
}

/** Sign the current user out. */
export async function signOut(): Promise<void> {
  const { error } = await auth.signOut();
  if (error) throw error;
}

/** The active session, or `null` when signed out. */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  return data.session;
}

/** The current user, or `null` when signed out. */
export async function getUser(): Promise<User | null> {
  const { data, error } = await auth.getUser();
  if (error) throw error;
  return data.user;
}

/** Send a password-reset email. */
export async function resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
  const { error } = await auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw error;
}

/** Update the signed-in user's password and/or metadata. */
export async function updateUser(attributes: {
  password?: string;
  email?: string;
  data?: Record<string, unknown>;
}): Promise<User> {
  const { data, error } = await auth.updateUser(attributes);
  if (error) throw error;
  return data.user;
}

/**
 * Subscribe to auth-state changes. Returns the `Subscription` — call
 * `.unsubscribe()` (e.g. in a React cleanup) to detach.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): Subscription {
  const { data } = auth.onAuthStateChange(callback);
  return data.subscription;
}
