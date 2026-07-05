import { describe, expect, it } from "vitest";

import { evaluateAccess, mergeGuards, type GuardAuth, type RouteGuard } from "./route-guard";
import { permissionsForRoles } from "./permissions";
import type { AppRole, Permission } from "./types";

/** Build a GuardAuth snapshot from a set of roles (mirrors auth-context). */
function authFor(roles: AppRole[], authenticated = true): GuardAuth {
  const roleSet = new Set(roles);
  const permSet = permissionsForRoles(roles);
  return {
    isAuthenticated: authenticated,
    hasRole: (r) => roleSet.has(r),
    hasAnyRole: (rs) => rs.some((r) => roleSet.has(r)),
    hasPermission: (p) => permSet.has(p),
    hasAnyPermission: (ps) => ps.some((p) => permSet.has(p)),
  };
}

describe("mergeGuards", () => {
  it("defaults to authRequired: true", () => {
    expect(mergeGuards([undefined, {}])).toEqual({ authRequired: true });
  });

  it("lets any level opt out of auth", () => {
    expect(mergeGuards([{ authRequired: true }, { authRequired: false }]).authRequired).toBe(false);
  });

  it("accumulates roles and permissions across the chain (union)", () => {
    const merged = mergeGuards([
      { permissions: ["projects.read"] },
      { permissions: ["dashboard.executive.view"], roles: ["owner"] },
    ]);
    expect(merged.roles).toEqual(["owner"]);
    expect(new Set(merged.permissions)).toEqual(
      new Set<Permission>(["projects.read", "dashboard.executive.view"]),
    );
  });

  it("is sticky on requireAllRoles", () => {
    expect(mergeGuards([{ requireAllRoles: true }, {}]).requireAllRoles).toBe(true);
  });
});

describe("evaluateAccess — authentication", () => {
  it("returns unauthenticated when auth is required but missing", () => {
    expect(evaluateAccess({ authRequired: true }, authFor([], false))).toBe("unauthenticated");
  });

  it("allows public routes without a session", () => {
    expect(evaluateAccess({ authRequired: false }, authFor([], false))).toBe("ok");
  });
});

describe("evaluateAccess — roles", () => {
  const guard: RouteGuard = { roles: ["owner", "admin", "hr"] };

  it("allows a user holding one of the roles", () => {
    expect(evaluateAccess(guard, authFor(["hr"]))).toBe("ok");
  });

  it("forbids a user holding none of the roles", () => {
    expect(evaluateAccess(guard, authFor(["employee"]))).toBe("forbidden");
  });

  it("requireAllRoles demands every listed role", () => {
    const all: RouteGuard = { roles: ["admin", "hr"], requireAllRoles: true };
    expect(evaluateAccess(all, authFor(["admin"]))).toBe("forbidden");
    expect(evaluateAccess(all, authFor(["admin", "hr"]))).toBe("ok");
  });
});

describe("evaluateAccess — permissions", () => {
  it("gates the executive dashboard to owner", () => {
    const guard: RouteGuard = { permissions: ["dashboard.executive.view"] };
    expect(evaluateAccess(guard, authFor(["owner"]))).toBe("ok");
    // admin lacks dashboard.executive.view by design (see ROLE_PERMISSIONS)
    expect(evaluateAccess(guard, authFor(["admin"]))).toBe("forbidden");
    expect(evaluateAccess(guard, authFor(["employee"]))).toBe("forbidden");
  });

  it("lets every role read the employee directory (employees.read)", () => {
    const guard: RouteGuard = { permissions: ["employees.read"] };
    for (const role of [
      "owner",
      "admin",
      "hr",
      "project_manager",
      "team_lead",
      "employee",
      "intern",
    ] as AppRole[]) {
      expect(evaluateAccess(guard, authFor([role]))).toBe("ok");
    }
  });

  it("requires every listed permission (all-of by default)", () => {
    const guard: RouteGuard = { permissions: ["projects.read", "projects.delete"] };
    // employee can read but not delete projects
    expect(evaluateAccess(guard, authFor(["employee"]))).toBe("forbidden");
    // owner has both
    expect(evaluateAccess(guard, authFor(["owner"]))).toBe("ok");
  });
});

describe("evaluateAccess — precedence", () => {
  it("checks authentication before role/permission", () => {
    const guard: RouteGuard = { roles: ["owner"], permissions: ["company.manage"] };
    expect(evaluateAccess(guard, authFor([], false))).toBe("unauthenticated");
  });

  it("an empty guard is always ok for a signed-in user", () => {
    expect(evaluateAccess({}, authFor(["intern"]))).toBe("ok");
  });
});

describe("merge + evaluate (end to end)", () => {
  it("a leaf inherits its layout's requirement and can tighten it", () => {
    // analytics layout requires analytics.view; the executive leaf adds
    // dashboard.executive.view — a PM passes the layout but not the leaf.
    const chain: RouteGuard[] = [
      { permissions: ["analytics.view"] },
      { permissions: ["dashboard.executive.view"] },
    ];
    const merged = mergeGuards(chain);
    expect(evaluateAccess(merged, authFor(["project_manager"]))).toBe("forbidden");
    expect(evaluateAccess(merged, authFor(["owner"]))).toBe("ok");
  });
});
