import { describe, expect, it } from "vitest";

import { formatMoney, payrollSummarySentence } from "./summary";
import type { PayrollLine } from "./types";

function line(p: Partial<PayrollLine>): PayrollLine {
  return {
    employee_id: "e",
    employee_name: "Sara Hassan",
    employment_type: "full-time",
    currency: "EGP",
    monthly_salary: 20000,
    hourly_rate: null,
    working_days: 22,
    expected_days: 22,
    present_days: 22,
    absence_days: 0,
    expected_hours: 176,
    worked_hours: 176,
    paid_exception_count: 0,
    unpaid_exception_count: 0,
    paid_exception_hours: 0,
    unpaid_exception_hours: 0,
    base_pay: 20000,
    overtime_hours: 0,
    overtime_pay: 0,
    overtime_pending_count: 0,
    overtime_rejected_count: 0,
    total_pay: 20000,
    has_pay_data: true,
    ...p,
  };
}

describe("formatMoney", () => {
  it("formats with two decimals and currency", () => {
    expect(formatMoney(19090.9, "EGP")).toBe("19,090.90 EGP");
    expect(formatMoney(null, null)).toBe("0.00 EGP");
  });
});

describe("payrollSummarySentence", () => {
  it("summarizes a full-time month with absences, exceptions and overtime", () => {
    const s = payrollSummarySentence(
      line({
        present_days: 20,
        absence_days: 1,
        paid_exception_count: 1,
        unpaid_exception_count: 1,
        overtime_hours: 4.5,
        overtime_pending_count: 1,
        base_pay: 19090.91,
        overtime_pay: 767.05,
        total_pay: 19857.96,
      }),
    );
    expect(s).toContain("worked 20 of 22 working days");
    expect(s).toContain("1 unpaid absence day(s) with no exception logged");
    expect(s).toContain("2 exception(s) logged (1 paid, 1 unpaid)");
    expect(s).toContain("4.5h overtime approved");
    expect(s).toContain("1 pending");
    expect(s).toContain("Base 19,090.91 EGP + overtime 767.05 EGP = 19,857.96 EGP");
  });

  it("summarizes a part-time month by hours", () => {
    const s = payrollSummarySentence(
      line({
        employee_name: "Omar Ali",
        employment_type: "part-time",
        monthly_salary: null,
        hourly_rate: 60,
        worked_hours: 82,
        paid_exception_hours: 3,
        paid_exception_count: 1,
        base_pay: 5100,
        total_pay: 5100,
      }),
    );
    expect(s).toContain("part-time: 82h worked plus 3h paid exception");
    expect(s).toContain("= 5,100.00 EGP");
  });

  it("flags a missing pay rate instead of inventing a number", () => {
    const s = payrollSummarySentence(line({ has_pay_data: false, base_pay: 0, total_pay: 0 }));
    expect(s).toContain("no pay rate configured");
  });
});
