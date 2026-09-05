import { describe, expect, it } from "vitest";

import type { RbacPermission } from "@/services/rbac";

import {
  bulkState,
  distinctActions,
  groupByModule,
  idsForAction,
  idsForScope,
  moduleLabel,
  removedIds,
  toggleMany,
} from "./permission-tree";

const perm = (
  id: string,
  module: string,
  action: string,
  scope: RbacPermission["scope"],
): RbacPermission => ({ id, module, action, scope, description: null });

const CATALOG: RbacPermission[] = [
  perm("p1", "payroll", "view", "own"),
  perm("p2", "payroll", "view", "all"),
  perm("p3", "payroll", "export", "all"),
  perm("p4", "hr", "view", "team"),
  perm("p5", "hr", "edit", "team"),
  perm("p6", "hr", "create", "all"),
];

describe("groupByModule", () => {
  it("groups module -> action -> scope cells", () => {
    const groups = groupByModule(CATALOG);
    expect(groups.map((g) => g.module)).toEqual(["hr", "payroll"]); // A–Z by label
    const payroll = groups.find((g) => g.module === "payroll")!;
    expect(payroll.actions.map((a) => a.action)).toEqual(["view", "export"]); // ACTION_ORDER
    expect(payroll.allIds.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("orders scopes narrowest first", () => {
    const payroll = groupByModule(CATALOG).find((g) => g.module === "payroll")!;
    const view = payroll.actions.find((a) => a.action === "view")!;
    expect(view.cells.map((c) => c.scope)).toEqual(["own", "all"]);
  });

  it("puts view before create before edit, per the display order", () => {
    const hr = groupByModule(CATALOG).find((g) => g.module === "hr")!;
    expect(hr.actions.map((a) => a.action)).toEqual(["view", "create", "edit"]);
  });

  it("returns nothing for an empty catalog", () => {
    expect(groupByModule([])).toEqual([]);
  });
});

describe("bulk selection targets", () => {
  it("selects one action across every module", () => {
    expect(idsForAction(CATALOG, "view").sort()).toEqual(["p1", "p2", "p4"]);
  });

  it("selects one scope tier across every module", () => {
    expect(idsForScope(CATALOG, "all").sort()).toEqual(["p2", "p3", "p6"]);
  });

  it("lists distinct actions in display order", () => {
    expect(distinctActions(CATALOG)).toEqual(["view", "create", "edit", "export"]);
  });
});

describe("toggleMany", () => {
  it("adds a batch without disturbing the rest", () => {
    const next = toggleMany(new Set(["p9"]), ["p1", "p2"], true);
    expect([...next].sort()).toEqual(["p1", "p2", "p9"]);
  });

  it("removes a batch", () => {
    const next = toggleMany(new Set(["p1", "p2", "p9"]), ["p1", "p2"], false);
    expect([...next]).toEqual(["p9"]);
  });

  it("does not mutate the input set", () => {
    const original = new Set(["p1"]);
    toggleMany(original, ["p2"], true);
    expect([...original]).toEqual(["p1"]);
  });
});

describe("bulkState", () => {
  it("reports none / partial / all", () => {
    const ids = ["p1", "p2", "p3"];
    expect(bulkState(new Set(), ids)).toBe("none");
    expect(bulkState(new Set(["p1"]), ids)).toBe("partial");
    expect(bulkState(new Set(ids), ids)).toBe("all");
  });

  it("treats an empty group as none, not all", () => {
    expect(bulkState(new Set(["p1"]), [])).toBe("none");
  });
});

describe("removedIds", () => {
  it("finds grants the pending selection would revoke", () => {
    expect(removedIds(["p1", "p2", "p3"], new Set(["p2"]))).toEqual(["p1", "p3"]);
  });

  it("is empty when nothing was dropped", () => {
    expect(removedIds(["p1"], new Set(["p1", "p2"]))).toEqual([]);
  });
});

describe("moduleLabel", () => {
  it("uses the friendly name when known", () => {
    expect(moduleLabel("hr")).toBe("HR");
    expect(moduleLabel("reports")).toBe("Daily reports");
  });

  it("title-cases an unknown slug rather than showing it raw", () => {
    expect(moduleLabel("time_tracking")).toBe("Time tracking");
  });
});
