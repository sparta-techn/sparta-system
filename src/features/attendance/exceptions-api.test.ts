import { describe, expect, it } from "vitest";

import { exceptionKeyFor, exceptionsByUserDate, type AttendanceException } from "./exceptions-api";

function make(partial: Partial<AttendanceException>): AttendanceException {
  return {
    id: "x",
    employee_id: "emp",
    exception_date: "2026-07-15",
    adjustment_minutes: 0,
    paid: true,
    reason: "r",
    created_by: null,
    updated_by: null,
    created_at: "",
    updated_at: "",
    userId: "u1",
    ...partial,
  };
}

describe("exceptionKeyFor", () => {
  it("keys by user id and date", () => {
    expect(exceptionKeyFor("u1", "2026-07-15")).toBe("u1|2026-07-15");
  });
});

describe("exceptionsByUserDate", () => {
  it("groups multiple exceptions under the same user|date", () => {
    const list = [
      make({ id: "a", userId: "u1", exception_date: "2026-07-15" }),
      make({ id: "b", userId: "u1", exception_date: "2026-07-15" }),
      make({ id: "c", userId: "u2", exception_date: "2026-07-15" }),
    ];
    const map = exceptionsByUserDate(list);
    expect(map.get("u1|2026-07-15")?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(map.get("u2|2026-07-15")?.map((e) => e.id)).toEqual(["c"]);
  });

  it("skips rows whose subject user id didn't resolve", () => {
    const map = exceptionsByUserDate([make({ id: "a", userId: null })]);
    expect(map.size).toBe(0);
  });
});
