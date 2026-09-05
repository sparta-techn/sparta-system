/**
 * Dynamic RBAC service layer (`rbac_*` tables).
 *
 * ```ts
 * import { rbacService } from "@/services/rbac";
 * const roles = await rbacService.listRoleSummaries();
 * ```
 *
 * See `docs/RBAC_DYNAMIC.md`. Feature code should import the repository
 * (`@/repositories/rbac`) rather than this service directly.
 */
export { RbacService, rbacService } from "./rbac.service";
export type {
  PermissionScope,
  RbacPermission,
  RbacRole,
  RbacRoleSummary,
  RbacEffectivePermission,
  RbacUserRole,
  RbacGrantImpact,
  RbacRoleMember,
  RbacAssignableUser,
} from "./types";
