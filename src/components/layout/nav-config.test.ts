import { describe, expect, it } from "vitest";

import type { AppRole } from "@/features/auth/types";
import { isNavItemVisible, PRIMARY_NAV, SYSTEM_NAV, TEAM_NAV, type NavItem } from "./nav-config";

const ALL_ITEMS: NavItem[] = [...PRIMARY_NAV, ...TEAM_NAV, ...SYSTEM_NAV];

function item(id: string): NavItem {
  const found = ALL_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`nav item "${id}" not found`);
  return found;
}

/** Which item ids are visible for a user holding exactly `roles`. */
function visibleIds(roles: AppRole[]): Set<string> {
  return new Set(ALL_ITEMS.filter((i) => isNavItemVisible(i, roles)).map((i) => i.id));
}

describe("nav visibility — leadership (owner/admin)", () => {
  it("hides the personal daily-workflow items (check-in / midday / eod) from owner", () => {
    const v = visibleIds(["owner"]);
    expect(v.has("check-in")).toBe(false);
    expect(v.has("midday")).toBe(false);
    expect(v.has("eod")).toBe(false);
  });

  it("hides the same personal items from admin", () => {
    const v = visibleIds(["admin"]);
    expect(v.has("check-in")).toBe(false);
    expect(v.has("midday")).toBe(false);
    expect(v.has("eod")).toBe(false);
  });

  it("shows leadership/company items to owner and admin", () => {
    for (const role of ["owner", "admin"] as AppRole[]) {
      const v = visibleIds([role]);
      expect(v.has("admin")).toBe(true); // Admin Console
      expect(v.has("executive")).toBe(true); // future item, leadership-gated
      expect(v.has("manager")).toBe(true);
      expect(v.has("hr")).toBe(true);
    }
  });
});

describe("nav visibility — team_lead (the reported bug)", () => {
  const v = visibleIds(["team_lead"]);

  it("does NOT show the Manager dashboard to a team lead", () => {
    expect(v.has("manager")).toBe(false);
  });

  it("does NOT show admin/owner-only items to a team lead", () => {
    expect(v.has("admin")).toBe(false);
    expect(v.has("executive")).toBe(false);
    expect(v.has("audit")).toBe(false);
    expect(v.has("hr")).toBe(false);
  });

  it("still shows a team lead their review surfaces and daily workflow", () => {
    expect(v.has("report-review")).toBe(true);
    expect(v.has("directory")).toBe(true);
    expect(v.has("check-in")).toBe(true);
  });
});

describe("nav visibility — managers (hr / project_manager)", () => {
  it("shows the Manager dashboard and daily workflow to HR and project managers", () => {
    for (const role of ["hr", "project_manager"] as AppRole[]) {
      const v = visibleIds([role]);
      expect(v.has("manager")).toBe(true);
      expect(v.has("check-in")).toBe(true);
      expect(v.has("report-review")).toBe(true);
    }
  });

  it("keeps admin/executive out of reach for hr and project managers", () => {
    for (const role of ["hr", "project_manager"] as AppRole[]) {
      const v = visibleIds([role]);
      expect(v.has("admin")).toBe(false);
      expect(v.has("executive")).toBe(false);
    }
  });

  it("shows HR workspace to HR but not to a project manager", () => {
    expect(visibleIds(["hr"]).has("hr")).toBe(true);
    expect(visibleIds(["project_manager"]).has("hr")).toBe(false);
  });
});

describe("nav visibility — individual contributors (employee / intern)", () => {
  it("shows the daily workflow but no team/admin surfaces", () => {
    for (const role of ["employee", "intern"] as AppRole[]) {
      const v = visibleIds([role]);
      expect(v.has("check-in")).toBe(true);
      expect(v.has("midday")).toBe(true);
      expect(v.has("eod")).toBe(true);
      expect(v.has("manager")).toBe(false);
      expect(v.has("report-review")).toBe(false);
      expect(v.has("hr")).toBe(false);
      expect(v.has("admin")).toBe(false);
      expect(v.has("executive")).toBe(false);
    }
  });
});

describe("nav visibility — items open to everyone", () => {
  const roles: AppRole[] = [
    "owner",
    "admin",
    "hr",
    "project_manager",
    "team_lead",
    "employee",
    "intern",
    "viewer",
  ];

  it("shows Dashboard to every role", () => {
    for (const role of roles) {
      const v = visibleIds([role]);
      expect(v.has("dashboard")).toBe(true);
    }
  });

  it("restricts Settings to leadership (owner/admin) and drops the removed Help item", () => {
    for (const role of roles) {
      const isLeadership = role === "owner" || role === "admin";
      expect(visibleIds([role]).has("settings")).toBe(isLeadership);
    }
    // Help was removed entirely — no such nav item exists anymore.
    expect(ALL_ITEMS.some((i) => i.id === "help")).toBe(false);
  });
});

describe("nav visibility — invited multi-role case", () => {
  it("treats employee + team_lead like a team lead (no manager, keeps check-in)", () => {
    const v = visibleIds(["employee", "team_lead"]);
    expect(v.has("manager")).toBe(false);
    expect(v.has("check-in")).toBe(true);
    expect(v.has("report-review")).toBe(true);
    expect(v.has("admin")).toBe(false);
  });

  it("an item with no role allowlist is visible regardless of role", () => {
    expect(item("dashboard").roles).toBeUndefined();
    expect(isNavItemVisible(item("dashboard"), ["intern"])).toBe(true);
  });
});
