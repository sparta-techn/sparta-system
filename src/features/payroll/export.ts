import { downloadXlsxWorkbook, type XlsxColumn } from "@/lib/xlsx";

import { payrollSummarySentence } from "./summary";
import type { PayrollLine } from "./types";

const num = (v: number | null | undefined) => (v == null ? "" : Number(v));

/**
 * Sheet 1 — "Payroll": every figure as a native numeric cell so Excel can sum
 * and audit them. Base pay and overtime pay stay in separate columns (never
 * merged), and unpaid days/absences get their own visible columns.
 */
export const PAYROLL_COLUMNS: readonly XlsxColumn<PayrollLine>[] = [
  { header: "Employee", value: (r) => r.employee_name ?? "", width: 24 },
  { header: "Employment type", value: (r) => r.employment_type ?? "", width: 16 },
  { header: "Currency", value: (r) => r.currency ?? "", width: 9 },
  { header: "Monthly salary", value: (r) => num(r.monthly_salary), width: 14 },
  { header: "Hourly rate", value: (r) => num(r.hourly_rate), width: 12 },
  { header: "Working days (month)", value: (r) => num(r.working_days), width: 12 },
  { header: "Expected days", value: (r) => num(r.expected_days), width: 12 },
  { header: "Present days", value: (r) => num(r.present_days), width: 12 },
  { header: "Absence days (no exception)", value: (r) => num(r.absence_days), width: 14 },
  { header: "Expected hours", value: (r) => num(r.expected_hours), width: 12 },
  { header: "Worked hours", value: (r) => num(r.worked_hours), width: 12 },
  { header: "Paid exceptions", value: (r) => num(r.paid_exception_count), width: 12 },
  { header: "Paid exception hours", value: (r) => num(r.paid_exception_hours), width: 14 },
  { header: "Unpaid exceptions", value: (r) => num(r.unpaid_exception_count), width: 12 },
  { header: "Unpaid exception hours", value: (r) => num(r.unpaid_exception_hours), width: 14 },
  { header: "Base pay", value: (r) => num(r.base_pay), width: 13 },
  { header: "Overtime hours", value: (r) => num(r.overtime_hours), width: 12 },
  { header: "Overtime pay", value: (r) => num(r.overtime_pay), width: 13 },
  { header: "OT pending", value: (r) => num(r.overtime_pending_count), width: 10 },
  { header: "OT rejected", value: (r) => num(r.overtime_rejected_count), width: 10 },
  { header: "TOTAL PAY", value: (r) => num(r.total_pay), width: 14 },
  { header: "Pay data configured", value: (r) => (r.has_pay_data ? "Yes" : "NO"), width: 12 },
];

interface SummaryRow {
  employee: string;
  summary: string;
}

const SUMMARY_COLUMNS: readonly XlsxColumn<SummaryRow>[] = [
  { header: "Employee", value: (r) => r.employee, width: 24 },
  { header: "Summary", value: (r) => r.summary, width: 120 },
];

/** `payroll-2026-07.xlsx` from the period's `from` date. */
export function payrollFilename(from: string): string {
  return `payroll-${from.slice(0, 7)}.xlsx`;
}

/**
 * Download the two-tab payroll workbook: "Payroll" (the numbers) and "Summary"
 * (a plain-language line per employee). Both tabs are derived from the same
 * `lines`, so they can never disagree.
 */
export function downloadPayrollWorkbook(from: string, lines: readonly PayrollLine[]): void {
  const summaryRows: SummaryRow[] = lines.map((l) => ({
    employee: l.employee_name ?? "",
    summary: payrollSummarySentence(l),
  }));
  downloadXlsxWorkbook(payrollFilename(from), [
    { name: "Payroll", rows: lines, columns: PAYROLL_COLUMNS },
    { name: "Summary", rows: summaryRows, columns: SUMMARY_COLUMNS },
  ]);
}
