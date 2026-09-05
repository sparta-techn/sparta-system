/**
 * Dynamic RBAC repository — the domain entry point for the role management UI.
 *
 * ```ts
 * import { rbacRepository } from "@/repositories/rbac";
 * ```
 */
export { RbacRepository, rbacRepository } from "./rbac.repository";
export type { RoleWithPermissions, RoleEditorData } from "./rbac.repository";
