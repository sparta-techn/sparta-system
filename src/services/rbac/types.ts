/**
 * Row and payload shapes for the dynamic RBAC tables/RPCs created in
 * `supabase/migrations/20260905120000_rbac_dynamic_roles_phase1.sql` and
 * `…130000_rbac_role_management_api.sql`.
 *
 * These are the `rbac_*` tables — the dynamic, admin-defined system. They are
 * NOT the legacy `permissions` / `role_permissions` / `user_roles` tables that
 * still back `has_any_role()` and today's RLS. See `docs/RBAC_DYNAMIC.md`.
 */

/** The three scope tiers a permission can be stored at. */
export type PermissionScope = "own" | "team" | "all";

/** One row of the developer-owned permission catalog (`rbac_permissions`). */
export interface RbacPermission {
  id: string;
  module: string;
  action: string;
  scope: PermissionScope;
  description: string | null;
}

/** An admin-defined role (`rbac_roles`). */
export interface RbacRole {
  id: string;
  name: string;
  description: string | null;
  is_protected: boolean;
  created_at: string;
}

/** A role plus its pre-aggregated counts, from `rbac_role_summaries()`. */
export interface RbacRoleSummary {
  id: string;
  name: string;
  description: string | null;
  is_protected: boolean;
  permission_count: number;
  user_count: number;
  created_at: string;
}

/** One entry of a user's unioned access, from `rbac_effective_permissions()`. */
export interface RbacEffectivePermission {
  module: string;
  action: string;
  scope: PermissionScope;
  /** Names of the roles that contribute this permission. */
  granted_by: string[];
}

/** A role assignment on a user, from `rbac_user_roles_for()`. */
export interface RbacUserRole {
  role_id: string;
  name: string;
  description: string | null;
  is_protected: boolean;
  granted_at: string;
}

/**
 * How many of a role's users would lose each permission outright if the role
 * stopped granting it — from `rbac_role_grant_impact()`. Backs the lockout
 * warning in the editor and the delete dialog.
 */
export interface RbacGrantImpact {
  permission_id: string;
  module: string;
  action: string;
  scope: PermissionScope;
  users_losing: number;
}
