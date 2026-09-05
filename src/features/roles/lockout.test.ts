import { describe, expect, it } from "vitest";

import type { RbacGrantImpact } from "@/services/rbac";

import {
  hasCriticalWarning,
  permissionLabel,
  summarize,
  warningsForDelete,
  warningsForRemoval,
} from "./lockout";

const impact = (
  permission_id: string,
  module: string,
  action: string,
  users_losing: number,
): RbacGrantImpact => ({ permission_id, module, action, scope: "all", users_losing });

const IMPACT: RbacGrantImpact[] = [
  impact("p1", "roles", "edit", 1), // critical
  impact("p2", "payroll", "export", 4), // more users, but not critical
  impact("p3", "tasks", "view", 0), // nobody actually loses it
];

describe("warningsForRemoval", () => {
  it("warns only about permissions someone actually loses", () => {
    const w = warningsForRemoval(["p1", "p2", "p3"], IMPACT);
    expect(w.map((x) => x.permissionId)).toEqual(["p1", "p2"]);
  });

  it("ignores permissions that are not being removed", () => {
    const w = warningsForRemoval(["p2"], IMPACT);
    expect(w).toHaveLength(1);
    expect(w[0].permissionId).toBe("p2");
  });

  it("sorts critical administrative permissions above higher user counts", () => {
    const w = warningsForRemoval(["p1", "p2"], IMPACT);
    expect(w[0].permissionId).toBe("p1");
    expect(w[0].critical).toBe(true);
    expect(w[1].critical).toBe(false);
  });

  it("returns nothing when the selection removed nothing", () => {
    expect(warningsForRemoval([], IMPACT)).toEqual([]);
  });

  it("returns nothing when no user is affected", () => {
    expect(warningsForRemoval(["p3"], IMPACT)).toEqual([]);
  });
});

describe("warningsForDelete", () => {
  it("treats a delete as removing every permission the role grants", () => {
    const w = warningsForDelete(IMPACT);
    expect(w.map((x) => x.permissionId)).toEqual(["p1", "p2"]);
  });

  it("is empty for a role nobody holds", () => {
    expect(warningsForDelete([impact("p1", "roles", "edit", 0)])).toEqual([]);
  });
});

describe("hasCriticalWarning", () => {
  it("flags administrative modules", () => {
    expect(hasCriticalWarning(warningsForRemoval(["p1"], IMPACT))).toBe(true);
    expect(hasCriticalWarning(warningsForRemoval(["p2"], IMPACT))).toBe(false);
  });
});

describe("summarize", () => {
  it("is null when there is nothing to warn about", () => {
    expect(summarize([])).toBeNull();
  });

  it("reports the worst-case user count and permission tally", () => {
    expect(summarize(warningsForRemoval(["p1", "p2"], IMPACT))).toBe(
      "up to 4 users will lose 2 permissions they have no other role granting.",
    );
  });

  it("uses singular wording for one user and one permission", () => {
    expect(summarize(warningsForRemoval(["p1"], IMPACT))).toBe(
      "1 user will lose 1 permission they have no other role granting.",
    );
  });
});

describe("permissionLabel", () => {
  it("renders module — action — scope", () => {
    expect(permissionLabel({ module: "payroll", action: "export", scope: "all" })).toBe(
      "Payroll — Export — All",
    );
    expect(permissionLabel({ module: "hr", action: "edit", scope: "team" })).toBe(
      "HR — Edit — Team",
    );
  });
});
