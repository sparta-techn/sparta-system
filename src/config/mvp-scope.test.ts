import { describe, expect, it } from "vitest";

import { isFeatureInMvp, isPathInMvp, MVP_SCOPE } from "./mvp-scope";

/**
 * Scope-gate regression tests.
 *
 * Route gating alone has leaked before: a feature hidden from the sidebar and
 * its own route kept rendering inside pages that were themselves in scope. The
 * `overtime` cases below pin both halves of the gate — the route AND the id used
 * by the component-level `SHOW_OVERTIME` constants — so the two can't drift.
 */
describe("MVP scope catalogue", () => {
  it("has no duplicate ids", () => {
    const ids = MVP_SCOPE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves a route by its most specific entry", () => {
    // /app/tasks is in scope; the more specific /app/tasks/time is not.
    expect(isPathInMvp("/app/tasks")).toBe(true);
    expect(isPathInMvp("/app/tasks/time")).toBe(false);
  });

  it("defaults an uncatalogued id and path to in-scope (fail-open)", () => {
    expect(isFeatureInMvp("no-such-feature")).toBe(true);
    expect(isPathInMvp("/app/no-such-route")).toBe(true);
  });
});

describe("overtime is out of scope", () => {
  it("gates the route, overriding the in-scope /app/attendance parent", () => {
    expect(isPathInMvp("/app/attendance")).toBe(true);
    expect(isPathInMvp("/app/attendance/overtime")).toBe(false);
  });

  it("gates the component-level surfaces under the same id", () => {
    // Every SHOW_OVERTIME constant reads this: the attendance card, the finish
    // summary, the team .xlsx export, the payroll table, the payroll .xlsx, the
    // payslip email and the correction dialog.
    expect(isFeatureInMvp("overtime")).toBe(false);
  });
});
