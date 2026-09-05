import { BaseService } from "../core/base-service";
import { db } from "../core/client";
import { toServiceError } from "../core/errors";
import type {
  RbacEffectivePermission,
  RbacGrantImpact,
  RbacPermission,
  RbacRole,
  RbacRoleSummary,
  RbacUserRole,
} from "./types";

/**
 * RbacService — the dynamic roles & permissions system (`rbac_*` tables).
 *
 * Every **mutation** and every cross-user **read** goes through a SECURITY
 * DEFINER RPC rather than a direct table write. That is deliberate: those RPCs
 * re-check `has_permission(auth.uid(), 'roles', <action>, 'all')` inside
 * Postgres and reject protected-role edits there, so authorization does not
 * depend on the client behaving. Nothing here can be bypassed by editing the
 * form payload or calling PostgREST directly.
 *
 * `BaseService` is extended for the plain catalog reads only.
 *
 * @see docs/RBAC_DYNAMIC.md
 */
export class RbacService extends BaseService<RbacRole> {
  protected readonly table = "rbac_roles";
  protected readonly entity = "Role";
  protected readonly defaultOrderBy = "name";

  // ---------------------------------------------------------------- catalog

  /** The full permission catalog, ordered for grouped display. */
  async listPermissions(): Promise<RbacPermission[]> {
    try {
      const { data, error } = await db
        .from("rbac_permissions")
        .select("id, module, action, scope, description")
        .order("module", { ascending: true })
        .order("action", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RbacPermission[];
    } catch (error) {
      throw toServiceError(error, "Failed to load the permission catalog");
    }
  }

  // ------------------------------------------------------------------ reads

  /**
   * All roles with their permission and user counts.
   *
   * Both counts are computed by `rbac_role_summaries()` from two pre-aggregated
   * subqueries joined once — a single round trip for the whole table, never a
   * count query per role.
   */
  async listRoleSummaries(): Promise<RbacRoleSummary[]> {
    try {
      const { data, error } = await db.rpc("rbac_role_summaries");
      if (error) throw error;
      return (data ?? []) as unknown as RbacRoleSummary[];
    } catch (error) {
      throw toServiceError(error, "Failed to load roles");
    }
  }

  /** The permission ids a role currently grants. */
  async listRolePermissionIds(roleId: string): Promise<string[]> {
    try {
      const { data, error } = await db.rpc("rbac_role_permission_ids", { p_role_id: roleId });
      if (error) throw error;
      return ((data ?? []) as Array<{ permission_id: string }>).map((r) => r.permission_id);
    } catch (error) {
      throw toServiceError(error, "Failed to load the role's permissions");
    }
  }

  /** A single role by id. */
  async getRole(roleId: string): Promise<RbacRole | null> {
    return this.getById(roleId, "id, name, description, is_protected, created_at");
  }

  /**
   * A user's permissions unioned across every role they hold, annotated with
   * the roles that grant each one. One grouped query server-side.
   */
  async listEffectivePermissions(userId: string): Promise<RbacEffectivePermission[]> {
    try {
      const { data, error } = await db.rpc("rbac_effective_permissions", { p_user_id: userId });
      if (error) throw error;
      return (data ?? []) as unknown as RbacEffectivePermission[];
    } catch (error) {
      throw toServiceError(error, "Failed to load effective permissions");
    }
  }

  /** The roles assigned to a user. */
  async listUserRoles(userId: string): Promise<RbacUserRole[]> {
    try {
      const { data, error } = await db.rpc("rbac_user_roles_for", { p_user_id: userId });
      if (error) throw error;
      return (data ?? []) as unknown as RbacUserRole[];
    } catch (error) {
      throw toServiceError(error, "Failed to load the user's roles");
    }
  }

  /** The caller's own effective permissions — backs the client-side UI gate. */
  async listMyPermissions(): Promise<Array<{ module: string; action: string; scope: string }>> {
    try {
      const { data, error } = await db.rpc("rbac_my_permissions");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        module: string;
        action: string;
        scope: string;
      }>;
    } catch (error) {
      throw toServiceError(error, "Failed to load your permissions");
    }
  }

  /**
   * Per-permission blast radius for a role: how many of its users would lose
   * each permission outright if the grant were removed. Single grouped query.
   */
  async getGrantImpact(roleId: string): Promise<RbacGrantImpact[]> {
    try {
      const { data, error } = await db.rpc("rbac_role_grant_impact", { p_role_id: roleId });
      if (error) throw error;
      return (data ?? []) as unknown as RbacGrantImpact[];
    } catch (error) {
      throw toServiceError(error, "Failed to assess the impact of this change");
    }
  }

  // ----------------------------------------------------------------- writes

  /** Create a role. Never protected — `is_protected` is not client-settable. */
  async createRole(name: string, description?: string | null): Promise<string> {
    try {
      const { data, error } = await db.rpc("rbac_create_role", {
        p_name: name,
        p_description: description ?? null,
      });
      if (error) throw error;
      return data as unknown as string;
    } catch (error) {
      throw toServiceError(error, "Failed to create the role");
    }
  }

  /** Rename / re-describe a role (protected roles: description only). */
  async updateRole(roleId: string, name: string, description?: string | null): Promise<void> {
    try {
      const { error } = await db.rpc("rbac_update_role", {
        p_role_id: roleId,
        p_name: name,
        p_description: description ?? null,
      });
      if (error) throw error;
    } catch (error) {
      throw toServiceError(error, "Failed to update the role");
    }
  }

  /**
   * Replace a role's entire permission set.
   *
   * The RPC deletes every existing grant and inserts the new set inside one
   * PL/pgSQL function body — a single transaction. A failed save rolls both
   * statements back, so a role can never be left with a partial set. Protected
   * roles are rejected server-side before any write happens.
   *
   * @returns the number of grants the role now holds.
   */
  async replaceRolePermissions(roleId: string, permissionIds: string[]): Promise<number> {
    try {
      const { data, error } = await db.rpc("rbac_replace_role_permissions", {
        p_role_id: roleId,
        p_permission_ids: permissionIds,
      });
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    } catch (error) {
      throw toServiceError(error, "Failed to save the role's permissions");
    }
  }

  /**
   * Delete a role, clearing its `rbac_user_roles` and `rbac_role_permissions`
   * rows in the same transaction. Protected roles are rejected server-side.
   *
   * @returns how many user assignments were removed.
   */
  async deleteRole(roleId: string): Promise<number> {
    try {
      const { data, error } = await db.rpc("rbac_delete_role", { p_role_id: roleId });
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    } catch (error) {
      throw toServiceError(error, "Failed to delete the role");
    }
  }

  /** Grant a role to a user (idempotent). */
  async assignRole(userId: string, roleId: string): Promise<void> {
    try {
      const { error } = await db.rpc("rbac_assign_role", {
        p_user_id: userId,
        p_role_id: roleId,
      });
      if (error) throw error;
    } catch (error) {
      throw toServiceError(error, "Failed to assign the role");
    }
  }

  /** Revoke a role from a user. */
  async unassignRole(userId: string, roleId: string): Promise<void> {
    try {
      const { error } = await db.rpc("rbac_unassign_role", {
        p_user_id: userId,
        p_role_id: roleId,
      });
      if (error) throw error;
    } catch (error) {
      throw toServiceError(error, "Failed to remove the role");
    }
  }
}

/** Shared singleton — import this, not the class. */
export const rbacService = new RbacService();
