import {
  fetchProfile,
  fetchRoles,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
} from "@/features/auth/auth-service";
import type { AppRole, Profile } from "@/features/auth/types";
import { BaseService } from "../core/base-service";
import { supabase } from "../core/client";
import { toServiceError } from "../core/errors";

type ProfileInsert = Partial<Profile> & { id: string };
type ProfileUpdate = Partial<Profile>;

/**
 * AuthService — single entry point for authentication, the current session and
 * profile/role records.
 *
 * CRUD verbs (`getById`, `update`, `list`, …) operate on the `profiles` table;
 * session/credential operations compose the existing `features/auth`
 * functions so behaviour stays identical and is defined in one place.
 */
export class AuthService extends BaseService<Profile, ProfileInsert, ProfileUpdate> {
  protected readonly table = "profiles";
  protected readonly entity = "Profile";
  protected readonly defaultOrderBy = "full_name";

  // ── Session / credentials (composed from features/auth) ──────────────────

  /** Sign in with email + password. */
  signIn(email: string, password: string): Promise<void> {
    return signInWithPassword(email, password);
  }

  /** Sign the current user out. */
  signOut(): Promise<void> {
    return signOut();
  }

  /** Send a password-reset email. */
  requestPasswordReset(email: string): Promise<void> {
    return requestPasswordReset(email);
  }

  /** Update the signed-in user's password (and optional metadata). */
  updatePassword(newPassword: string, metadata?: Record<string, unknown>): Promise<void> {
    return updatePassword(newPassword, metadata);
  }

  /** The current Supabase auth user, or `null` when signed out. */
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error) {
      throw toServiceError(error, "Failed to load current user");
    }
  }

  /** The active session, or `null` when signed out. */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      throw toServiceError(error, "Failed to load session");
    }
  }

  // ── Profile / roles ──────────────────────────────────────────────────────

  /** Fetch a user's profile (composes the canonical feature query). */
  getProfile(userId: string): Promise<Profile | null> {
    return fetchProfile(userId);
  }

  /** List the application roles assigned to a user. */
  getRoles(userId: string): Promise<AppRole[]> {
    return fetchRoles(userId);
  }
}

/** Shared singleton — import this, not the class. */
export const authService = new AuthService();
