/**
 * Declarative route guards.
 *
 * Every route can declare its access policy in `staticData.guard`
 * (`{ authRequired, roles, permissions, ... }`). The policy of a rendered route
 * is the **merge of its whole matched chain** (root → leaf), so a leaf inherits
 * its group layout's requirements and may only tighten them. Enforcement is a
 * single client-side gate (`<RouteGuardGate>`) mounted in the `_authenticated`
 * layout — see `docs/ROUTE_GUARDS.md`.
 *
 * This mirrors, for the UI, the authoritative RBAC enforced by Postgres RLS.
 * It is a UX layer, not a security boundary: never rely on it for data access.
 */
import type { AppRole, AuthState, Permission } from "./types";

/** Access policy a route declares (all optional; unset = "any authenticated"). */
export interface RouteGuard {
  /** Whether a signed-in user is required. Defaults to `true` for guarded routes. */
  authRequired?: boolean;
  /** Allowed roles — the user needs **any** of them (roles are alternatives). */
  roles?: AppRole[];
  /**
   * Required permissions — the user needs **all** of them (they are
   * *requirements*). This makes inheritance work: a leaf adds a permission its
   * ancestors' also-required permissions must be held alongside.
   */
  permissions?: Permission[];
  /** Require *all* listed roles instead of any. */
  requireAllRoles?: boolean;
}

/** Outcome of evaluating a guard against the current identity. */
export type AccessResult = "ok" | "unauthenticated" | "forbidden";

/** The auth surface the evaluator needs (a subset of {@link AuthState}). */
export type GuardAuth = Pick<
  AuthState,
  "isAuthenticated" | "hasRole" | "hasAnyRole" | "hasPermission" | "hasAnyPermission"
>;

/** Sugar for a route's `staticData`: `staticData: routeGuard({ ... })`. */
export function routeGuard(guard: RouteGuard): { guard: RouteGuard } {
  return { guard };
}

/**
 * Merge a matched chain of guards into one effective, most-restrictive policy.
 * Roles/permissions accumulate (all levels must pass); `authRequired` is true
 * unless a level explicitly opts out; `requireAll*` is sticky once set.
 */
export function mergeGuards(guards: (RouteGuard | undefined)[]): RouteGuard {
  const merged: RouteGuard = {};
  const roles = new Set<AppRole>();
  const permissions = new Set<Permission>();
  let sawRoles = false;
  let sawPermissions = false;

  for (const g of guards) {
    if (!g) continue;
    if (g.authRequired === false) merged.authRequired = false;
    if (g.roles) {
      sawRoles = true;
      for (const r of g.roles) roles.add(r);
    }
    if (g.permissions) {
      sawPermissions = true;
      for (const p of g.permissions) permissions.add(p);
    }
    if (g.requireAllRoles) merged.requireAllRoles = true;
  }

  if (merged.authRequired !== false) merged.authRequired = true;
  if (sawRoles) merged.roles = [...roles];
  if (sawPermissions) merged.permissions = [...permissions];
  return merged;
}

/**
 * Evaluate an (already merged) guard against the current identity.
 *
 * Order matters: authentication first (→ `unauthenticated`), then role and
 * permission checks (→ `forbidden`). An empty guard is always `ok`.
 */
export function evaluateAccess(guard: RouteGuard, auth: GuardAuth): AccessResult {
  if (guard.authRequired !== false && !auth.isAuthenticated) return "unauthenticated";

  if (guard.roles && guard.roles.length > 0) {
    const ok = guard.requireAllRoles
      ? guard.roles.every((r) => auth.hasRole(r))
      : auth.hasAnyRole(guard.roles);
    if (!ok) return "forbidden";
  }

  if (guard.permissions && guard.permissions.length > 0) {
    // Permissions are requirements: the user must hold every one.
    if (!guard.permissions.every((p) => auth.hasPermission(p))) return "forbidden";
  }

  return "ok";
}

// Type the `staticData.guard` field on every route.
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    guard?: RouteGuard;
  }
}
