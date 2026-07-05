import type { AppRole, Profile } from "@/features/auth/types";
import { AuthService, authService } from "@/services/auth";

/** Aggregated identity for the signed-in user. */
export interface CurrentIdentity {
  userId: string;
  email: string | undefined;
  profile: Profile | null;
  roles: AppRole[];
}

/**
 * AuthRepository — domain entry point for authentication and the current
 * identity. Delegates persistence to {@link AuthService}; adds aggregate reads
 * (e.g. user + profile + roles in one call) that the UI/services consume.
 *
 * The service is injected (defaulting to the shared singleton) so the repository
 * stays unit-testable with a stubbed service.
 */
export class AuthRepository {
  constructor(private readonly service: AuthService = authService) {}

  // ── Credentials / session ────────────────────────────────────────────────

  signIn(email: string, password: string): Promise<void> {
    return this.service.signIn(email, password);
  }

  signOut(): Promise<void> {
    return this.service.signOut();
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.service.requestPasswordReset(email);
  }

  updatePassword(newPassword: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.service.updatePassword(newPassword, metadata);
  }

  getSession() {
    return this.service.getSession();
  }

  getCurrentUser() {
    return this.service.getCurrentUser();
  }

  // ── Aggregate reads ──────────────────────────────────────────────────────

  /** Fetch a user's profile. */
  getProfile(userId: string): Promise<Profile | null> {
    return this.service.getProfile(userId);
  }

  /** Fetch a user's assigned roles. */
  getRoles(userId: string): Promise<AppRole[]> {
    return this.service.getRoles(userId);
  }

  /**
   * Resolve the full current identity (auth user + profile + roles) in one call.
   * Returns `null` when no user is signed in.
   */
  async getCurrentIdentity(): Promise<CurrentIdentity | null> {
    const user = await this.service.getCurrentUser();
    if (!user) return null;

    const [profile, roles] = await Promise.all([
      this.service.getProfile(user.id),
      this.service.getRoles(user.id),
    ]);

    return { userId: user.id, email: user.email, profile, roles };
  }
}

/** Shared singleton — import this, not the class. */
export const authRepository = new AuthRepository();
