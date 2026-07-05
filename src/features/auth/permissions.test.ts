import { describe, expect, it } from "vitest";

import {
  ALL_PERMISSIONS,
  canAdministerAttendance,
  canReviewReports,
  canViewAllAttendance,
  isAttendanceReadOnly,
  PERMISSION_CATALOG,
  permissionsForRoles,
  ROLE_PERMISSIONS,
  rolesHavePermission,
} from "./permissions";
import { ENTERPRISE_ROLES, type AppRole, type Permission } from "./types";

describe("granular permission catalog", () => {
  it("has unique keys and matches ALL_PERMISSIONS", () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ALL_PERMISSIONS)).toEqual(new Set(keys));
  });

  it("every role only references catalog permissions", () => {
    const catalog = new Set<Permission>(ALL_PERMISSIONS);
    for (const role of Object.keys(ROLE_PERMISSIONS) as AppRole[]) {
      for (const key of ROLE_PERMISSIONS[role]) expect(catalog.has(key)).toBe(true);
    }
  });
});

describe("role → permission matrix", () => {
  it("owner holds everything except attendance.manage (owners are read-only)", () => {
    const owner = permissionsForRoles(["owner"]);
    for (const p of ALL_PERMISSIONS) {
      expect(owner.has(p)).toBe(p !== "attendance.manage");
    }
  });

  it("admin is the platform admin, minus owner-exclusive capabilities", () => {
    expect(rolesHavePermission(["admin"], "settings.manage")).toBe(true);
    expect(rolesHavePermission(["admin"], "roles.assign")).toBe(true);
    expect(rolesHavePermission(["admin"], "attendance.manage")).toBe(true);
    expect(rolesHavePermission(["admin"], "company.manage")).toBe(false);
    expect(rolesHavePermission(["admin"], "dashboard.executive.view")).toBe(false);
  });

  it("only the owner can open the executive dashboard", () => {
    for (const role of ENTERPRISE_ROLES) {
      expect(rolesHavePermission([role], "dashboard.executive.view")).toBe(role === "owner");
    }
  });

  it("interns are the most limited active role (no task edits)", () => {
    expect(rolesHavePermission(["intern"], "reports.submit")).toBe(true);
    expect(rolesHavePermission(["intern"], "tasks.read")).toBe(true);
    expect(rolesHavePermission(["intern"], "tasks.edit")).toBe(false);
    expect(rolesHavePermission(["intern"], "employees.create")).toBe(false);
  });

  it("unions permissions across multiple held roles", () => {
    expect(rolesHavePermission(["employee", "project_manager"], "tasks.assign")).toBe(true);
  });
});

describe("managers can review reports", () => {
  it("allows owner, admin, hr, project_manager and team_lead", () => {
    for (const role of ["owner", "admin", "hr", "project_manager", "team_lead"] as AppRole[]) {
      expect(canReviewReports([role])).toBe(true);
    }
  });

  it("denies plain employees and viewers", () => {
    expect(canReviewReports(["employee"])).toBe(false);
    expect(canReviewReports(["viewer"])).toBe(false);
    expect(canReviewReports([])).toBe(false);
  });

  it("grants access when any held role qualifies", () => {
    expect(canReviewReports(["employee", "team_lead"])).toBe(true);
  });
});

describe("owners have read-only access to all attendance", () => {
  it("lets owner view everyone's attendance", () => {
    expect(canViewAllAttendance(["owner"])).toBe(true);
  });

  it("does NOT let owner administer (write) attendance", () => {
    expect(canAdministerAttendance(["owner"])).toBe(false);
    expect(isAttendanceReadOnly(["owner"])).toBe(true);
  });

  it("keeps admin / hr as attendance administrators (not read-only)", () => {
    expect(canAdministerAttendance(["admin"])).toBe(true);
    expect(canAdministerAttendance(["hr"])).toBe(true);
    expect(isAttendanceReadOnly(["admin"])).toBe(false);
    expect(isAttendanceReadOnly(["hr"])).toBe(false);
  });

  it("treats plain employees as neither viewers-of-all nor admins", () => {
    expect(canViewAllAttendance(["employee"])).toBe(false);
    expect(canAdministerAttendance(["employee"])).toBe(false);
    expect(isAttendanceReadOnly(["employee"])).toBe(false);
  });
});
