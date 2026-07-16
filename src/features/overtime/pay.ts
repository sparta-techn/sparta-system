/**
 * Overtime pay formula (pure, side-effect-free).
 *
 * This is the TypeScript **mirror** of the authoritative server-side functions
 * in `supabase/migrations/20260716130000_overtime_flow.sql`
 * (`overtime_full_time_hourly_rate`, `overtime_pay_amount`,
 * `working_days_in_month`). The Postgres functions remain the single source of
 * truth that both the UI and the Phase-4 payroll export read — this module
 * exists to (a) unit-test the formula as a contract and (b) render *estimates*
 * client-side before a session is approved. Any displayed *final* amount must
 * come from the `overtime_pay_report` RPC, never from this module, so the two
 * can never disagree. The parity is pinned by `pay.test.ts`.
 *
 * Confirmed product rules:
 *  - Full-time base = monthly_salary / (expected_daily_hours × working_days_in_month)
 *  - Part-time base = hourly_rate
 *  - Multiplier: full-time 1.5×, part-time 1.0×
 */

export const OVERTIME_MULTIPLIER_FULL_TIME = 1.5;
export const OVERTIME_MULTIPLIER_PART_TIME = 1.0;

/** Round to 2 decimals (matches Postgres `round(numeric, 2)`, half-away-from-zero). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Count working days in the calendar month containing `ref`: weekdays that are
 * neither a weekend (per `weekendDays`, 0=Sun..6=Sat) nor a full-day holiday.
 * Mirrors `public.working_days_in_month`.
 */
export function workingDaysInMonth(
  ref: Date,
  weekendDays: number[],
  fullDayHolidays: ReadonlySet<string> = new Set(),
): number {
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  const weekend = new Set(weekendDays);
  let count = 0;
  for (let day = 1; ; day++) {
    const d = new Date(Date.UTC(year, month, day));
    if (d.getUTCMonth() !== month) break;
    const iso = d.toISOString().slice(0, 10);
    if (!weekend.has(d.getUTCDay()) && !fullDayHolidays.has(iso)) count++;
  }
  return count;
}

/**
 * Full-time hourly base rate from a monthly salary. `null` when the salary is
 * missing or the divisor collapses. Mirrors
 * `public.overtime_full_time_hourly_rate`.
 */
export function fullTimeHourlyRate(
  monthlySalary: number | null | undefined,
  expectedDailyHours: number,
  workingDays: number,
): number | null {
  if (monthlySalary == null) return null;
  if (!expectedDailyHours || !workingDays) return null;
  return monthlySalary / (expectedDailyHours * workingDays);
}

/** The multiplier for an employment-type slug. */
export function overtimeMultiplierFor(employmentTypeSlug: string | null | undefined): number {
  return employmentTypeSlug === "part-time"
    ? OVERTIME_MULTIPLIER_PART_TIME
    : OVERTIME_MULTIPLIER_FULL_TIME;
}

/**
 * Pay for a span of overtime: hours × base × multiplier, rounded to 2 dp.
 * Mirrors `public.overtime_pay_amount`. Never negative.
 */
export function overtimePayAmount(
  workedSeconds: number,
  baseHourly: number | null | undefined,
  multiplier: number | null | undefined,
): number {
  const secs = Math.max(0, workedSeconds || 0);
  return round2((secs / 3600) * (baseHourly ?? 0) * (multiplier ?? 0));
}

/** Whole seconds between an overtime session's start and end (0 if unfinished). */
export function overtimeWorkedSeconds(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0;
  return Math.max(
    0,
    Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000),
  );
}
