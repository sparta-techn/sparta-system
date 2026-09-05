import {
  RbacService,
  rbacService,
  type RbacEffectivePermission,
  type RbacGrantImpact,
  type RbacPermission,
  type RbacRole,
  type RbacRoleSummary,
  type RbacUserRole,
  type RbacRoleMember,
  type RbacAssignableUser,
} from "@/services/rbac";

/** A role together with the permission ids it grants — one editor payload. */
export interface RoleWithPermissions {
  role: RbacRole;
  permissionIds: string[];
}

/** Everything the role editor screen needs, fetched together. */
export interface RoleEditorData extends RoleWithPermissions {
  catalog: RbacPermission[];
  /** Blast radius per permission; empty for a protected role (nothing to warn about). */
  impact: RbacGrantImpact[];
}

/**
 * RbacRepository — domain entry point for the dynamic roles & permissions
 * system. Components and hooks talk to this; it composes {@link RbacService}.
 *
 * Authorization is enforced in Postgres by the SECURITY DEFINER RPCs the
 * service calls (`has_permission(uid, 'roles', …)`), not here. Everything in
 * this layer is convenience and aggregation.
 */
export class RbacRepository {
  constructor(private readonly service: RbacService = rbacService) {}

  // ------------------------------------------------------------------ reads

  /** The permission catalog (developer-seeded; safe to cache aggressively). */
  listPermissions(): Promise<RbacPermission[]> {
    return this.service.listPermissions();
  }

  /** All roles with permission + user counts, in one round trip. */
  listRoleSummaries(): Promise<RbacRoleSummary[]> {
    return this.service.listRoleSummaries();
  }

  /** The caller's own dynamic permissions — backs the client-side UI gate. */
  listMyPermissions(): Promise<Array<{ module: string; action: string; scope: string }>> {
    return this.service.listMyPermissions();
  }

  /**
   * Everything the editor screen needs for one role, in parallel: the role, its
   * current grants, the catalog, and the per-permission removal impact.
   *
   * Impact is skipped for protected roles — nothing about them can change, so
   * there is no warning to compute.
   */
  async getRoleEditorData(roleId: string): Promise<RoleEditorData> {
    const [role, permissionIds, catalog] = await Promise.all([
      this.service.getRole(roleId),
      this.service.listRolePermissionIds(roleId),
      this.service.listPermissions(),
    ]);
    if (!role) throw new Error("Role not found");

    const impact = role.is_protected ? [] : await this.service.getGrantImpact(roleId);
    return { role, permissionIds, catalog, impact };
  }

  /** Per-permission blast radius for a role (used by the delete dialog). */
  getGrantImpact(roleId: string): Promise<RbacGrantImpact[]> {
    return this.service.getGrantImpact(roleId);
  }

  /** Users holding a role — the role-side view of assignment. */
  listRoleMembers(roleId: string): Promise<RbacRoleMember[]> {
    return this.service.listRoleMembers(roleId);
  }

  /** Users not yet holding a role, for the assignment picker. */
  listAssignableUsers(roleId: string, search?: string): Promise<RbacAssignableUser[]> {
    return this.service.listAssignableUsers(roleId, search);
  }

  /** The roles assigned to one user. */
  listUserRoles(userId: string): Promise<RbacUserRole[]> {
    return this.service.listUserRoles(userId);
  }

  /** A user's unioned permissions across all their roles. */
  listEffectivePermissions(userId: string): Promise<RbacEffectivePermission[]> {
    return this.service.listEffectivePermissions(userId);
  }

  // ----------------------------------------------------------------- writes

  /** Create a role and immediately set its permission list. */
  async createRole(
    name: string,
    description: string | null,
    permissionIds: string[],
  ): Promise<string> {
    const roleId = await this.service.createRole(name, description);
    if (permissionIds.length > 0) {
      await this.service.replaceRolePermissions(roleId, permissionIds);
    }
    return roleId;
  }

  /**
   * Save an existing role: metadata, then a full-set permission replacement.
   * The replacement itself is atomic server-side (single transaction).
   */
  async saveRole(
    roleId: string,
    name: string,
    description: string | null,
    permissionIds: string[],
  ): Promise<void> {
    await this.service.updateRole(roleId, name, description);
    await this.service.replaceRolePermissions(roleId, permissionIds);
  }

  /** Delete a role; resolves to the number of user assignments removed. */
  deleteRole(roleId: string): Promise<number> {
    return this.service.deleteRole(roleId);
  }

  /** Grant a role to a user. */
  assignRole(userId: string, roleId: string): Promise<void> {
    return this.service.assignRole(userId, roleId);
  }

  /** Revoke a role from a user. */
  unassignRole(userId: string, roleId: string): Promise<void> {
    return this.service.unassignRole(userId, roleId);
  }
}

/** Shared singleton — import this, not the class. */
export const rbacRepository = new RbacRepository();
