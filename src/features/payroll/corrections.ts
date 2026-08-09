/**
 * The pure arithmetic of a payslip correction — no database, no I/O.
 *
 * Split out from `corrections.server.ts` so the rules that decide WHAT a
 * corrected payslip says are testable on their own: which correction wins when
 * a figure is corrected twice, and how the total is rebuilt afterwards.
 *
 * Pricing corrected overtime hours is deliberately NOT here. That has to happen
 * in the database (`overtime_pay_for_hours`), so the rate and rounding are the
 * payroll report's own rather than a second implementation of them.
 */

/** The two figures a correction may restate. Overtime is hours, not money. */
export type CorrectableField = "base_pay" | "overtime_hours";

/** Enough of a correction to apply it; the full row lives server-side. */
export interface CorrectionInput {
  field: CorrectableField;
  /** Unit follows `field`: money for base_pay, hours for overtime_hours. */
  newValue: number;
}

export interface CorrectionOverlay {
  basePay: number;
  overtimeHours: number;
  /** Which figures were restated — drives whether overtime needs repricing. */
  correctedFields: CorrectableField[];
}

/**
 * Money rounding, matching the payroll report's 2dp.
 *
 * The `toPrecision(15)` step matters: scaling by 100 leaves values like 10000.005
 * sitting at 1000000.4999999999 in binary floating point, which would round DOWN
 * and quietly shave a cent off a corrected figure. Trimming to 15 significant
 * digits first — comfortably inside a double's ~15–17 digits of real precision —
 * restores the decimal the operator actually typed, at any magnitude. (Nudging
 * by `Number.EPSILON` instead does not work here: EPSILON is relative to 1.0, so
 * it corrects 1.005 but does nothing at payroll-sized numbers.)
 */
export function round2(value: number): number {
  return Math.round(Number((value * 100).toPrecision(15))) / 100;
}

/**
 * Lay corrections over the computed figures.
 *
 * `corrections` must be OLDEST FIRST: each is an absolute restatement, so when
 * a figure is corrected more than once the last one is the one that stands.
 */
export function overlayCorrections(
  base: { basePay: number; overtimeHours: number },
  corrections: ReadonlyArray<CorrectionInput>,
): CorrectionOverlay {
  let basePay = base.basePay;
  let overtimeHours = base.overtimeHours;
  const corrected = new Set<CorrectableField>();

  for (const c of corrections) {
    if (c.field === "base_pay") basePay = c.newValue;
    else overtimeHours = c.newValue;
    corrected.add(c.field);
  }

  return {
    basePay: round2(basePay),
    overtimeHours: round2(overtimeHours),
    correctedFields: [...corrected],
  };
}

/**
 * Base and overtime are always reported separately and summed — never netted
 * against absences or anything else (the payroll report's rule).
 */
export function totalOf(basePay: number, overtimePay: number): number {
  return round2(basePay + overtimePay);
}
