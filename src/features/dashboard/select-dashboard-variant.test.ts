import { describe, expect, it } from "vitest";

import type { AppRole } from "@/features/auth/types";
import { selectDashboardVariant } from "./select-dashboard-variant";

describe("selectDashboardVariant", () => {
  it("routes owner and admin to the owner dashboard", () => {
    expect(selectDashboardVariant(["owner"])).toBe("owner");
    expect(selectDashboardVariant(["admin"])).toBe("owner");
  });

  it("routes HR and project managers to the manager dashboard", () => {
    expect(selectDashboardVariant(["hr"])).toBe("manager");
    expect(selectDashboardVariant(["project_manager"])).toBe("manager");
  });

  it("routes a team lead to the personal dashboard (not manager)", () => {
    // The reported bug: a Team Lead was landing on the Manager dashboard.
    expect(selectDashboardVariant(["team_lead"])).toBe("personal");
  });

  it("routes employees, interns and viewers to the personal dashboard", () => {
    expect(selectDashboardVariant(["employee"])).toBe("personal");
    expect(selectDashboardVariant(["intern"])).toBe("personal");
    expect(selectDashboardVariant(["viewer"])).toBe("personal");
  });

  it("handles the invited multi-role case (employee + team_lead) as personal", () => {
    // Invited users receive a baseline `employee` role plus their assigned role.
    expect(selectDashboardVariant(["employee", "team_lead"])).toBe("personal");
  });

  it("gives precedence to the highest-privilege role when several are held", () => {
    expect(selectDashboardVariant(["employee", "owner"])).toBe("owner");
    expect(selectDashboardVariant(["team_lead", "project_manager"])).toBe("manager");
    expect(selectDashboardVariant(["hr", "admin"])).toBe("owner");
  });

  it("defaults to personal when no roles are present", () => {
    expect(selectDashboardVariant([] as AppRole[])).toBe("personal");
  });
});
