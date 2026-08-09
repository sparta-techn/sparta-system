import { describe, expect, it } from "vitest";

import { overlayCorrections, round2, totalOf } from "./corrections";

describe("overlayCorrections", () => {
  const base = { basePay: 10_000, overtimeHours: 4 };

  it("leaves the computed figures alone when nothing is corrected", () => {
    expect(overlayCorrections(base, [])).toEqual({
      basePay: 10_000,
      overtimeHours: 4,
      correctedFields: [],
    });
  });

  it("takes a correction as an absolute value, not a delta", () => {
    const result = overlayCorrections(base, [{ field: "base_pay", newValue: 12_000 }]);
    expect(result.basePay).toBe(12_000);
    expect(result.correctedFields).toEqual(["base_pay"]);
  });

  it("leaves the untouched figure untouched", () => {
    const result = overlayCorrections(base, [{ field: "base_pay", newValue: 12_000 }]);
    expect(result.overtimeHours).toBe(4);
  });

  // The correction log is append-only, so a figure fixed twice arrives as two
  // rows. The later one is the one that stands.
  it("lets the last correction to a field win", () => {
    const result = overlayCorrections(base, [
      { field: "base_pay", newValue: 12_000 },
      { field: "base_pay", newValue: 11_500 },
    ]);
    expect(result.basePay).toBe(11_500);
    expect(result.correctedFields).toEqual(["base_pay"]);
  });

  it("applies corrections to both figures independently", () => {
    const result = overlayCorrections(base, [
      { field: "base_pay", newValue: 12_000 },
      { field: "overtime_hours", newValue: 6.5 },
    ]);
    expect(result).toEqual({
      basePay: 12_000,
      overtimeHours: 6.5,
      correctedFields: ["base_pay", "overtime_hours"],
    });
  });

  it("reports overtime_hours as corrected so the pay gets repriced", () => {
    const result = overlayCorrections(base, [{ field: "overtime_hours", newValue: 0 }]);
    expect(result.correctedFields).toContain("overtime_hours");
    expect(result.overtimeHours).toBe(0);
  });

  it("rounds a corrected figure to 2dp, matching the payroll report", () => {
    const result = overlayCorrections(base, [{ field: "base_pay", newValue: 10_000.005 }]);
    expect(result.basePay).toBe(10_000.01);
  });
});

describe("totalOf", () => {
  it("sums base and overtime rather than netting anything off", () => {
    expect(totalOf(10_000, 500)).toBe(10_500);
  });

  it("does not leave binary floating-point dust in the total", () => {
    expect(totalOf(0.1, 0.2)).toBe(0.3);
  });
});

describe("round2", () => {
  it("rounds half up", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  // A naive `(v + Number.EPSILON) * 100` rounds these DOWN, shaving a cent off
  // a corrected figure at payroll-sized magnitudes while looking correct at 1.005.
  it("rounds half up at payroll-sized magnitudes too", () => {
    expect(round2(10_000.005)).toBe(10_000.01);
    expect(round2(123_456.785)).toBe(123_456.79);
  });

  it("leaves an already-2dp figure exactly as it is", () => {
    expect(round2(10_500.25)).toBe(10_500.25);
    expect(round2(0)).toBe(0);
  });
});
