/**
 * Employment-type policy helpers — the single place that turns an employee's
 * employment type into the behaviour differences the daily workflow depends on.
 *
 * The reference `employment_types` table (Full-time / Part-time / Contractor /
 * Intern — see `20260630120000_hr_reference_and_permissions.sql`) is the source
 * of the values; the branching here keys on the **part-time** slug because that
 * is the only type with a reduced day and a trimmed daily-report set:
 *
 *  - Attendance target: the day auto-finishes on NET WORKING TIME — time in the
 *    `working` state, with every second of `on_break` excluded. Full-time works
 *    7h of it, part-time 4h. See {@link netWorkTargetMinutes}.
 *  - Break policy: a full-time day is the company default measured *including*
 *    the break allowance (an 8h scheduled day = 7h worked + 1h break), but the
 *    break hour is PAID rather than WORKED: it is credited by payroll once the
 *    day completes, whether or not the break was taken, and never counts toward
 *    the auto-finish target. See {@link paidBreakCreditMinutes}. Part-time has
 *    no allowance at all: 4h of actual work, breaks neither credited nor capped.
 *  - Daily reports: part-time skips the Midday pulse entirely (check-in and
 *    end-of-day stay required, same as full-time).
 *
 * Slugs come straight from the seeded `employment_types.slug` column so callers
 * that only have the display name can normalise via {@link employmentTypeSlug}.
 */

/** Canonical slug for the reduced-hours, no-midday employment type. */
export const PART_TIME_SLUG = "part-time";

/** A part-time day targets 4 hours of work (vs. the company-wide default). */
export const PART_TIME_WORK_MINUTES = 240;

/** Normalise a display name (`"Part-time"`) or slug to a comparable slug. */
export function employmentTypeSlug(nameOrSlug: string | null | undefined): string | null {
  if (!nameOrSlug) return null;
  return nameOrSlug.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Whether the given employment type (name or slug) is part-time. */
export function isPartTime(nameOrSlug: string | null | undefined): boolean {
  return employmentTypeSlug(nameOrSlug) === PART_TIME_SLUG;
}

/**
 * The SCHEDULED day for this employment type, in minutes — what a completed day
 * is worth to payroll. Part-time is a fixed 4h; every other type keeps the
 * company-wide default (which itself comes from
 * `company_settings.expected_work_minutes`, not a hardcoded 8h).
 *
 * This is NOT the amount that has to be worked: a full-time scheduled day
 * contains the paid break hour — see {@link netWorkTargetMinutes}.
 */
export function expectedWorkMinutesFor(
  nameOrSlug: string | null | undefined,
  companyDefaultMinutes: number,
): number {
  return isPartTime(nameOrSlug) ? PART_TIME_WORK_MINUTES : companyDefaultMinutes;
}

/**
 * Minutes of NET WORKING TIME the employee must log before the day is complete
 * and the session auto-finishes — break time excluded entirely, so this is the
 * same target whether the break is taken in full, split up, or skipped.
 *
 * Full-time: the scheduled day minus the break allowance (8h − 1h = 7h).
 * Part-time: 4h, which is already pure work — nothing to subtract.
 *
 * Mirrors the server `session_day_target(_uid).net_target_minutes`.
 */
export function netWorkTargetMinutes(
  nameOrSlug: string | null | undefined,
  companyDefaultMinutes: number,
  companyMaxBreakMinutes: number,
): number {
  if (isPartTime(nameOrSlug)) return PART_TIME_WORK_MINUTES;
  return Math.max(1, companyDefaultMinutes - Math.max(0, companyMaxBreakMinutes));
}

/**
 * Minutes payroll credits on top of tracked working time once a day completes
 * via auto-finish: the paid break hour, owed whether or not the break was
 * actually taken. Full-time gets the company allowance; part-time gets 0 — their
 * scheduled day is entirely working time, so there is nothing to credit back.
 *
 * Mirrors the per-day `_break_credit_secs` term in the server `payroll_report`.
 */
export function paidBreakCreditMinutes(
  nameOrSlug: string | null | undefined,
  companyDefaultMinutes: number,
  companyMaxBreakMinutes: number,
): number {
  return (
    expectedWorkMinutesFor(nameOrSlug, companyDefaultMinutes) -
    netWorkTargetMinutes(nameOrSlug, companyDefaultMinutes, companyMaxBreakMinutes)
  );
}

/**
 * Whether the company break allowance (`max_break_minutes`) applies to this
 * employment type — i.e. whether breaks are capped and paid. Full-time (and
 * unknown types) yes; part-time no: their 4h is pure working time with breaks
 * neither paid nor limited, so nothing trips a limit warning.
 *
 * Note this governs the *allowance*, not the target: break time never advances
 * the auto-finish target for anyone — see {@link netWorkTargetMinutes}.
 */
export function hasBreakAllowance(nameOrSlug: string | null | undefined): boolean {
  return !isPartTime(nameOrSlug);
}

/** Whether this employment type is expected to file a Midday status pulse. */
export function requiresMidday(nameOrSlug: string | null | undefined): boolean {
  return !isPartTime(nameOrSlug);
}

/**
 * Grace after a part-timer closes their work session before a missing-EOD alert
 * is due — long enough to write the report right after clocking out. Mirrors the
 * server scan (`employees_without_submitted_report`), keep the two in sync.
 */
export const EOD_GRACE_MINUTES = 30;

/**
 * Whether a "hasn't checked in" alert should ever fire for this employment type.
 * Part-timers are excluded entirely: we have no per-day schedule for them, so a
 * missing check-in is not actionable. Full-time (and unknown types) keep firing.
 */
export function expectsCheckInAlert(nameOrSlug: string | null | undefined): boolean {
  return !isPartTime(nameOrSlug);
}

/**
 * Whether an employee with no submitted EOD report counts as *genuinely* missing
 * it right now — the shared rule behind both the alert scan and the roll-up
 * surfaces. Full-time (and unknown types) always count (unchanged behavior).
 * Part-time counts only once their working day is over: they closed a work
 * session at least {@link EOD_GRACE_MINUTES} ago. A part-timer who never started
 * a session (`finishedAt` null/undefined) does not count — didn't work vs forgot.
 */
export function countsAsMissingEod(
  nameOrSlug: string | null | undefined,
  finishedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isPartTime(nameOrSlug)) return true;
  if (!finishedAt) return false;
  return new Date(finishedAt).getTime() <= now.getTime() - EOD_GRACE_MINUTES * 60_000;
}
