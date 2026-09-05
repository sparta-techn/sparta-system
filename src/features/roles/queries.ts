/**
 * TanStack Query option factories for the dynamic roles module.
 *
 * Mirrors the rewards/payroll pattern: a structured key hierarchy plus
 * `queryOptions` consumed by `useQuery`. All data comes from
 * `@/repositories/rbac`, never from Supabase directly.
 */
import { queryOptions } from "@tanstack/react-query";

import { rbacRepository } from "@/repositories/rbac";

export const roleKeys = {
  all: ["rbac"] as const,
  catalog: () => [...roleKeys.all, "catalog"] as const,
  summaries: () => [...roleKeys.all, "roles"] as const,
  editor: (roleId: string) => [...roleKeys.all, "role", roleId] as const,
  impact: (roleId: string) => [...roleKeys.all, "impact", roleId] as const,
  myPermissions: () => [...roleKeys.all, "me"] as const,
  userRoles: (userId: string) => [...roleKeys.all, "user", userId, "roles"] as const,
  effective: (userId: string) => [...roleKeys.all, "user", userId, "effective"] as const,
};

/** The permission catalog. Developer-seeded, so it changes only on deploy. */
export const permissionCatalogQuery = () =>
  queryOptions({
    queryKey: roleKeys.catalog(),
    queryFn: () => rbacRepository.listPermissions(),
    staleTime: 30 * 60_000,
  });

/** All roles with permission + user counts (single round trip). */
export const roleSummariesQuery = () =>
  queryOptions({
    queryKey: roleKeys.summaries(),
    queryFn: () => rbacRepository.listRoleSummaries(),
    staleTime: 30_000,
  });

/** Role + its grants + the catalog + removal impact, for the editor screen. */
export const roleEditorQuery = (roleId: string) =>
  queryOptions({
    queryKey: roleKeys.editor(roleId),
    queryFn: () => rbacRepository.getRoleEditorData(roleId),
    staleTime: 10_000,
  });

/** Per-permission blast radius for a role — used by the delete dialog. */
export const roleImpactQuery = (roleId: string, enabled = true) =>
  queryOptions({
    queryKey: roleKeys.impact(roleId),
    queryFn: () => rbacRepository.getGrantImpact(roleId),
    enabled,
    staleTime: 10_000,
  });

/**
 * The signed-in user's own dynamic permissions. Backs the client-side gate on
 * the role management screens — the authoritative check is the server-side
 * `has_permission()` inside every RPC.
 */
export const myPermissionsQuery = () =>
  queryOptions({
    queryKey: roleKeys.myPermissions(),
    queryFn: () => rbacRepository.listMyPermissions(),
    staleTime: 60_000,
  });

/** The roles assigned to one user. */
export const userRolesQuery = (userId: string, enabled = true) =>
  queryOptions({
    queryKey: roleKeys.userRoles(userId),
    queryFn: () => rbacRepository.listUserRoles(userId),
    enabled,
    staleTime: 30_000,
  });

/** A user's unioned permissions across every role they hold. */
export const effectivePermissionsQuery = (userId: string, enabled = true) =>
  queryOptions({
    queryKey: roleKeys.effective(userId),
    queryFn: () => rbacRepository.listEffectivePermissions(userId),
    enabled,
    staleTime: 30_000,
  });
