import type { PayrollLine } from "./types";

/** Format a money amount with its currency, 2 dp. */
export function formatMoney(amount: number | null | undefined, currency: string | null): string {
  const n = Number(amount ?? 0);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? "EGP"}`;
}

/** "4.5h" / "0h" from a number of hours. */
function h(n: number | null | undefined): string {
  return `${Number(n ?? 0)}h`;
}

/**
 * A plain-language, one-line explanation of an employee's pay for the period —
 * the content of the export's "Summary" tab. Built purely from the payroll_report
 * figures so it always agrees with the numbers sheet.
 */
export function payrollSummarySentence(line: PayrollLine): string {
  const name = line.employee_name ?? "Unknown";
  const isPartTime = line.employment_type === "part-time";
  const money = (n: number | null | undefined) => formatMoney(n, line.currency);

  if (!line.has_pay_data) {
    return `${name} — no pay rate configured, so pay could not be calculated. Worked ${h(line.worked_hours)} this period.`;
  }

  const parts: string[] = [];

  if (isPartTime) {
    parts.push(
      `${name} — part-time: ${h(line.worked_hours)} worked` +
        ((line.paid_exception_hours ?? 0) > 0
          ? ` plus ${h(line.paid_exception_hours)} paid exception`
          : ""),
    );
  } else {
    parts.push(`${name} — worked ${line.present_days} of ${line.expected_days} working days`);
    if ((line.absence_days ?? 0) > 0) {
      parts.push(`${line.absence_days} unpaid absence day(s) with no exception logged`);
    }
  }

  const paidExc = line.paid_exception_count ?? 0;
  const unpaidExc = line.unpaid_exception_count ?? 0;
  if (paidExc + unpaidExc > 0) {
    parts.push(`${paidExc + unpaidExc} exception(s) logged (${paidExc} paid, ${unpaidExc} unpaid)`);
  }

  const ot: string[] = [];
  if ((line.overtime_hours ?? 0) > 0) ot.push(`${h(line.overtime_hours)} overtime approved`);
  if ((line.overtime_pending_count ?? 0) > 0) ot.push(`${line.overtime_pending_count} pending`);
  if ((line.overtime_rejected_count ?? 0) > 0) ot.push(`${line.overtime_rejected_count} rejected`);
  if (ot.length > 0) parts.push(ot.join(", "));

  const tail = `Base ${money(line.base_pay)} + overtime ${money(line.overtime_pay)} = ${money(line.total_pay)}`;
  return `${parts.join("; ")}. ${tail}.`;
}
