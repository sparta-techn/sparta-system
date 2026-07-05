/**
 * Contracts for the one-time bootstrap process. Safe to import from anywhere
 * (client or server) — the privileged orchestration lives in
 * `bootstrap.server.ts` and is never bundled to the browser.
 */

/** Operator-supplied parameters for the initial owner + company. */
export interface BootstrapInput {
  owner: {
    email: string;
    /** Plaintext password for the initial owner; email is auto-confirmed. */
    password: string;
    fullName?: string;
  };
  company?: {
    name?: string;
    slug?: string;
    timezone?: string;
  };
  workspace?: {
    name?: string;
    slug?: string;
  };
  /**
   * Whether to disable public self-registration once bootstrap completes.
   * Defaults to `true` (the platform is invite-only after setup).
   */
  disablePublicRegistration?: boolean;
}

/** Read-only view of where the platform stands. */
export interface BootstrapStatus {
  isBootstrapped: boolean;
  publicRegistrationEnabled: boolean;
  companyId: string | null;
  bootstrappedAt: string | null;
}

/** Summary of the resources a bootstrap run created (or found already present). */
export interface BootstrapResult {
  ownerUserId: string;
  companyId: string;
  workspaceId: string;
  departmentCount: number;
  permissionCount: number;
  roleCount: number;
  publicRegistrationEnabled: boolean;
  /** `true` when nothing was created because the platform was already set up. */
  alreadyBootstrapped: boolean;
}
