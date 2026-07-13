/**
 * Employment-type policy helpers — the single place that turns an employee's
 * employment type into the behaviour differences the daily workflow depends on.
 *
 * The reference `employment_types` table (Full-time / Part-time / Contractor /
 * Intern — see `20260630120000_hr_reference_and_permissions.sql`) is the source
 * of the values; the branching here keys on the **part-time** slug because that
 * is the only type with a reduced day and a trimmed daily-report set:
 *
 *  - Attendance target: part-time works a 4h day instead of the company default.
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
 * Expected working minutes for a day given the employee's type. Part-time is a
 * fixed 4h; every other type keeps the company-wide default (which itself comes
 * from `company_settings.expected_work_minutes`, not a hardcoded 8h).
 */
export function expectedWorkMinutesFor(
  nameOrSlug: string | null | undefined,
  companyDefaultMinutes: number,
): number {
  return isPartTime(nameOrSlug) ? PART_TIME_WORK_MINUTES : companyDefaultMinutes;
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
