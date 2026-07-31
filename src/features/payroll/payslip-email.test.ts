import { describe, expect, it } from "vitest";

import { payslipDetailRows, renderPayslipEmail } from "./payslip-email";
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

const company = { name: "Acme", supportEmail: "hr@acme.test" };
const render = (l: PayrollLine) =>
  renderPayslipEmail({ line: l, periodLabel: "July 2026", company });

describe("renderPayslipEmail", () => {
  it("carries the report's own figures, never a recomputed total", () => {
    // A line whose total deliberately does NOT equal base + overtime: the email
    // must echo payroll_report's total_pay so it can't disagree with the sheet.
    const r = render(line({ base_pay: 20000, overtime_pay: 500, total_pay: 20500 }));
    expect(r.html).toContain("20,500.00 EGP");
    expect(r.text).toContain("TOTAL PAID: 20,500.00 EGP");
  });

  it("breaks overtime out separately from base pay", () => {
    const r = render(
      line({ base_pay: 18000, overtime_hours: 6.5, overtime_pay: 1200, total_pay: 19200 }),
    );
    expect(r.text).toContain("Base pay");
    expect(r.text).toContain("Overtime (6.5h approved): 1,200.00 EGP");
    // Base and overtime are never merged into one figure.
    expect(r.text).toContain("18,000.00 EGP");
  });

  it("omits the overtime row entirely when there is none", () => {
    const r = render(line({ overtime_hours: 0, overtime_pay: 0 }));
    expect(r.text).not.toContain("Overtime (");
  });

  it("shows unpaid absences instead of hiding them", () => {
    const r = render(line({ absence_days: 3, present_days: 19 }));
    expect(r.text).toContain("Unpaid absence days: 3");
    expect(r.html).toContain("Unpaid absence days");
  });

  it("shows paid and unpaid exceptions separately", () => {
    const r = render(
      line({
        paid_exception_count: 2,
        paid_exception_hours: 16,
        unpaid_exception_count: 1,
        unpaid_exception_hours: 8,
      }),
    );
    expect(r.text).toContain("Paid exceptions: 2 (16h)");
    expect(r.text).toContain("Unpaid exceptions: 1 (8h)");
  });

  it("tells the employee pending overtime was excluded", () => {
    const r = render(line({ overtime_pending_count: 5 }));
    expect(r.text).toContain("Overtime awaiting approval: 5 request(s)");
  });

  it("describes a part-time period in hours, not working days", () => {
    const r = render(
      line({
        employment_type: "part-time",
        monthly_salary: null,
        hourly_rate: 80,
        worked_hours: 51.17,
        base_pay: 4093.6,
        total_pay: 4093.6,
      }),
    );
    expect(r.text).toContain("Base pay (51.17h worked)");
    expect(r.text).not.toContain("Working days");
  });

  it("escapes HTML in employee and company names", () => {
    const r = renderPayslipEmail({
      line: line({ employee_name: '<img src=x onerror="alert(1)">' }),
      periodLabel: "July 2026",
      company: { name: "<script>evil</script>" },
    });
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).not.toContain("<script>evil");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("does not repeat the platform name when the org is SpartaFlow", () => {
    const r = renderPayslipEmail({
      line: line({}),
      periodLabel: "July 2026",
      company: { name: "SpartaFlow" },
    });
    expect(r.text).toContain("Sent by SpartaFlow.");
    expect(r.text).not.toContain("via SpartaFlow");
  });

  it("names the period in the subject", () => {
    expect(render(line({})).subject).toBe("Your July 2026 salary has been paid");
  });
});

describe("payslipDetailRows", () => {
  it("emits nothing optional for a clean full month", () => {
    const rows = payslipDetailRows(line({}));
    expect(rows.map((r) => r.label)).toEqual(["Working days", "Hours worked"]);
  });

  it("flags every unpaid item with warning emphasis", () => {
    const rows = payslipDetailRows(
      line({ absence_days: 2, unpaid_exception_count: 1, unpaid_exception_hours: 4 }),
    );
    const unpaid = rows.filter((r) => r.emphasis === "warning").map((r) => r.label);
    expect(unpaid).toEqual(["Unpaid exceptions", "Unpaid absence days"]);
  });
});
