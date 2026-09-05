/**
 * Client-side access checks against the *dynamic* RBAC system.
 *
 * This mirrors, for the UI, the authoritative `has_permission()` engine in
 * Postgres. It is a UX layer, not a security boundary — every mutation is
 * re-authorized server-side inside a SECURITY DEFINER RPC, so hiding a button
 * here is a convenience, never the enforcement.
 *
 * Distinct from `useAuth().hasPermission`, which reads the LEGACY static
 * role→permission matrix in `features/auth/permissions.ts`. That one still
 * gates the rest of the app; this one gates the role management screens.
 */
import { useQuery } from "@tanstack/react-query";

import type { PermissionScope } from "@/services/rbac";

import { myPermissionsQuery } from "./queries";

/** Scope tiers ordered narrowest → widest. A wider stored scope covers a narrower request. */
const SCOPE_RANK: Record<string, number> = { own: 0, team: 1, all: 2 };

export interface DynamicPermissionState {
  /** True once the permission set has loaded. */
  ready: boolean;
  loading: boolean;
  /** The check failed to load (network/RLS) — treat as "no access", but distinguishable. */
  error: boolean;
  /**
   * Whether the user holds `module.action` at a scope covering `scope`.
   *
   * Mirrors the SQL lattice: a stored `all` covers any request, `team` covers
   * `team`/`own`, `own` covers `own`. The resource-owner half of the SQL check
   * cannot be evaluated client-side, so this answers "could the user ever do
   * this?" — enough to decide whether to render a screen.
   */
  can: (module: string, action: string, scope?: PermissionScope) => boolean;
}

/** Read the signed-in user's dynamic permissions and expose a `can()` check. */
export function useDynamicPermissions(): DynamicPermissionState {
  const { data, isLoading, isError, isSuccess } = useQuery(myPermissionsQuery());

  const can = (module: string, action: string, scope: PermissionScope = "all"): boolean => {
    if (!data) return false;
    const wanted = SCOPE_RANK[scope] ?? 2;
    return data.some(
      (p) => p.module === module && p.action === action && (SCOPE_RANK[p.scope] ?? -1) >= wanted,
    );
  };

  return { ready: isSuccess, loading: isLoading, error: isError, can };
}

/** Convenience for a single check. */
export function useCanManageRoles(): { loading: boolean; allowed: boolean } {
  const { loading, can } = useDynamicPermissions();
  return { loading, allowed: can("roles", "view", "all") };
}
