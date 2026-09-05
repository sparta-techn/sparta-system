/**
 * Lockout safeguard.
 *
 * Removing a permission from a role, or deleting the role outright, can strip
 * access from every user who held it only through that role. The database
 * computes the blast radius (`rbac_role_grant_impact` → {@link RbacGrantImpact}:
 * how many of the role's users would lose each permission *entirely*). This
 * module turns that into the warnings the UI shows.
 *
 * This is a **soft warning, never a block**. The protected Owner role always
 * retains the whole catalog, so a true organization-wide lockout is impossible
 * by construction — but an admin can still accidentally strip access from
 * everyone except themselves, and should be told before they do.
 *
 * Users who also hold Owner are already excluded upstream: Owner grants
 * everything, so they never "lose" a permission.
 */
import type { RbacGrantImpact } from "@/services/rbac";

import { actionLabel, moduleLabel, SCOPE_LABELS } from "./permission-tree";

/**
 * Modules whose loss is disruptive enough to warn about even for a single
 * user. `roles` is the self-lockout case the brief calls out; the others are
 * the administrative surfaces with no alternative route in the product.
 */
const CRITICAL_MODULES = new Set(["roles", "settings", "audit"]);

/** One line of the "this will remove access" warning. */
export interface LockoutWarning {
  permissionId: string;
  /** e.g. "Roles & permissions — Edit — All". */
  label: string;
  /** How many users lose this permission outright. */
  usersLosing: number;
  /** Whether this is an administrative permission with no fallback path. */
  critical: boolean;
}

/** "Payroll — Export — All" */
export function permissionLabel(p: {
  module: string;
  action: string;
  scope: keyof typeof SCOPE_LABELS;
}): string {
  return `${moduleLabel(p.module)} — ${actionLabel(p.action)} — ${SCOPE_LABELS[p.scope]}`;
}

/**
 * Warnings for revoking a specific set of permissions from a role.
 *
 * Only permissions that at least one user would actually lose are returned;
 * removing a grant nobody relies on is not worth interrupting for. Critical
 * modules sort first, then by how many users are affected.
 */
export function warningsForRemoval(
  removedPermissionIds: readonly string[],
  impact: readonly RbacGrantImpact[],
): LockoutWarning[] {
  if (removedPermissionIds.length === 0) return [];
  const removed = new Set(removedPermissionIds);

  return impact
    .filter((i) => removed.has(i.permission_id) && i.users_losing > 0)
    .map((i) => ({
      permissionId: i.permission_id,
      label: permissionLabel(i),
      usersLosing: i.users_losing,
      critical: CRITICAL_MODULES.has(i.module),
    }))
    .sort(
      (a, b) =>
        Number(b.critical) - Number(a.critical) ||
        b.usersLosing - a.usersLosing ||
        a.label.localeCompare(b.label),
    );
}

/**
 * Warnings for deleting a role entirely — every permission it grants goes away
 * at once, so this is {@link warningsForRemoval} over the whole impact set.
 */
export function warningsForDelete(impact: readonly RbacGrantImpact[]): LockoutWarning[] {
  return warningsForRemoval(
    impact.map((i) => i.permission_id),
    impact,
  );
}

/** Whether any warning concerns a critical administrative permission. */
export function hasCriticalWarning(warnings: readonly LockoutWarning[]): boolean {
  return warnings.some((w) => w.critical);
}

/** One-line summary for the confirmation dialog, or `null` when nothing is at risk. */
export function summarize(warnings: readonly LockoutWarning[]): string | null {
  if (warnings.length === 0) return null;
  const users = new Set<number>();
  let peak = 0;
  for (const w of warnings) {
    peak = Math.max(peak, w.usersLosing);
    users.add(w.usersLosing);
  }
  const perms = warnings.length === 1 ? "1 permission" : `${warnings.length} permissions`;
  const people = peak === 1 ? "1 user" : `up to ${peak} users`;
  return `${people} will lose ${perms} they have no other role granting.`;
}
