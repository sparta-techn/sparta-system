import { afterEach, describe, expect, it } from "vitest";

import {
  __resetEmployeeMgmt,
  assignManager,
  assignRole,
  assignTeam,
  auditFor,
  changeDepartment,
  createEmployee,
  deactivateEmployee,
  editEmployee,
  isSoftDeleted,
  mergeEmployees,
  reactivateEmployee,
  resetPassword,
  restoreEmployee,
  softDeleteEmployee,
  suspendEmployee,
} from "./employees-store";
import type { HrEmployee } from "./mock-data";

afterEach(() => __resetEmployeeMgmt());

function baseEmployee(overrides: Partial<HrEmployee> = {}): HrEmployee {
  return {
    id: "emp_001",
    name: "River Song",
    initials: "RS",
    email: "river.song@spartaflow.dev",
    avatarHue: 120,
    department: "Engineering",
    team: "Platform",
    jobTitle: "Software Engineer",
    role: "employee",
    status: "active",
    managerId: null,
    joinedAt: new Date().toISOString(),
    birthday: "01-01",
    location: "Berlin, DE",
    timezone: "CET",
    employmentType: "Full-time",
    workMode: "Remote",
    ...overrides,
  };
}

describe("createEmployee", () => {
  it("adds a local record with initials, normalised email, and an audit entry", () => {
    const created = createEmployee({
      name: "  New Hire  ",
      email: "New.Hire@Spartaflow.dev",
      department: "Design",
      role: "team_lead",
    });

    expect(created.name).toBe("New Hire");
    expect(created.initials).toBe("NH");
    expect(created.email).toBe("new.hire@spartaflow.dev");
    expect(created.status).toBe("active");

    const merged = mergeEmployees([]);
    expect(merged.map((e) => e.id)).toContain(created.id);
    expect(auditFor(created.id).some((a) => a.action === "created")).toBe(true);
  });
});

describe("overrides merge onto the fetched base", () => {
  it("editEmployee patches fields and recomputes initials", () => {
    editEmployee("emp_001", { name: "River B. Song", jobTitle: "Staff Engineer" });
    const [e] = mergeEmployees([baseEmployee()]);
    expect(e.name).toBe("River B. Song");
    expect(e.initials).toBe("RB");
    expect(e.jobTitle).toBe("Staff Engineer");
  });

  it("changeDepartment / assignTeam / assignRole apply", () => {
    changeDepartment("emp_001", "Data");
    assignTeam("emp_001", "ML");
    assignRole("emp_001", "manager");
    const [e] = mergeEmployees([baseEmployee()]);
    expect(e.department).toBe("Data");
    expect(e.team).toBe("ML");
    expect(e.role).toBe("manager");
  });

  it("assignManager sets and clears the manager id", () => {
    assignManager("emp_001", "emp_099", "Boss Person");
    expect(mergeEmployees([baseEmployee()])[0].managerId).toBe("emp_099");
    assignManager("emp_001", null);
    expect(mergeEmployees([baseEmployee()])[0].managerId).toBeNull();
  });
});

describe("lifecycle status transitions", () => {
  it("deactivate → reactivate", () => {
    deactivateEmployee("emp_001");
    expect(mergeEmployees([baseEmployee()])[0].status).toBe("deactivated");
    reactivateEmployee("emp_001");
    expect(mergeEmployees([baseEmployee()])[0].status).toBe("active");
  });

  it("suspend puts the account on hold", () => {
    suspendEmployee("emp_001");
    expect(mergeEmployees([baseEmployee()])[0].status).toBe("suspended");
  });
});

describe("soft delete", () => {
  it("hides the record by default but keeps it with includeDeleted, and restores", () => {
    softDeleteEmployee("emp_001");
    expect(isSoftDeleted("emp_001")).toBe(true);
    expect(mergeEmployees([baseEmployee()])).toHaveLength(0);
    expect(mergeEmployees([baseEmployee()], { includeDeleted: true })).toHaveLength(1);

    restoreEmployee("emp_001");
    expect(isSoftDeleted("emp_001")).toBe(false);
    expect(mergeEmployees([baseEmployee()])).toHaveLength(1);
  });
});

describe("resetPassword", () => {
  it("records an audit entry without changing the record", () => {
    resetPassword("emp_001", "river.song@spartaflow.dev");
    const [e] = mergeEmployees([baseEmployee()]);
    expect(e.status).toBe("active");
    expect(auditFor("emp_001").some((a) => a.action === "password_reset")).toBe(true);
  });
});
