# SpartaFlow — Business Rules

> Where each rule lives, how it is enforced, and the tests that cover it.
> Rules are implemented as **pure, single-sourced domain functions** and wired
> into the service/repository layer; authorization rules also map to RLS.
> Run the tests with `npm test` (Vitest). Snapshot date: 2026-06-30
> (rule #10, employment type, added 2026-07-11).

---

## Rule → implementation → test

| #   | Rule                                                   | Implemented in                                                                                             | Enforced / wired at                                                                                                        | Tested in                           |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Working hours start at **09:00**                       | `services/attendance/rules.ts` (`DEFAULT_ATTENDANCE_POLICY.workStart`, `lateThresholdMinutes`)             | `attendanceRepository.checkIn`; `company_settings.work_start_time`; `start_work_session` RPC                               | `services/attendance/rules.test.ts` |
| 2   | Check-in until **10:00** is **not** Absent             | `rules.ts` (`isLate`, `lateMinutes`, grace = 60)                                                           | `checkIn` sets `late_minutes` + `status`                                                                                   | `rules.test.ts`                     |
| 3   | After **10:00** → **Late** (no check-in → **Absent**)  | `rules.ts` (`attendanceStatusForCheckIn`)                                                                  | `checkIn` writes `attendance.status`; absent derived when no check-in                                                      | `rules.test.ts`                     |
| 4   | Working duration **8 hours** (overtime beyond) — _part-time = 4h, see #10_ | `rules.ts` (`computeWorkedSeconds`, `overtimeSeconds`, `classifyCompletedDay`, expected = 480 min)         | `checkOut` writes `worked_seconds` / `overtime_seconds` / final `status`                                                   | `rules.test.ts`                     |
| 5   | Break duration **max 1 hour**                          | `rules.ts` (`remainingBreakSeconds`, `breakLimitExceeded`, max = 60 min)                                   | break accounting in `checkOut`; `company_settings.max_break_minutes`                                                       | `rules.test.ts`                     |
| 6   | **One** Morning Check-in / Midday / EOD per day — _part-time skips Midday, see #10_ | `services/reports/rules.ts` (`resolveSubmissionMode`, `canCreateSubmission`)                               | `StatusUpdatesService.submit`, `DailyReportsService.submit`; DB `UNIQUE (user_id, work_date[, kind])`                      | `services/reports/rules.test.ts`    |
| 7   | Dependency requests stay **Open until resolved**       | `services/reports/rules.ts` (`isDependencyOpen`, `TERMINAL_DEPENDENCY_STATES`, `resolvedAtFor`)            | `DependencyRequestsService.setState` / `listOpen`                                                                          | `services/reports/rules.test.ts`    |
| 8   | **Managers can review reports**                        | `features/auth/permissions.ts` (`canReviewReports`)                                                        | RLS `can_review_reports()` on report/attendance reads                                                                      | `features/auth/permissions.test.ts` |
| 9   | **Owners** have **read-only** access to all attendance | `features/auth/permissions.ts` (`canViewAllAttendance`, `canAdministerAttendance`, `isAttendanceReadOnly`) | RLS: owner reads via `can_review_reports`; **migration `20260630140000`** drops `owner` from the attendance write policies | `features/auth/permissions.test.ts` |
| 10  | **Employment type** sets the day: **part-time** works a **4h** day and **skips Midday** (check-in + EOD unchanged) | `features/hr/employment-type.ts` (`isPartTime`, `expectedWorkMinutesFor`, `requiresMidday`, `PART_TIME_WORK_MINUTES = 240`) | **Attendance:** `today-status-card`, `quick-summary`, `finish_work_session` RPC (migration `20260711140000`). **Reports:** `isNavItemVisible` (nav), `personal-dashboard`, `quick-actions`, `useTeamMiddayOverview` (roll-up), `/app/midday` guard | `components/layout/nav-config.test.ts` |

---

## Notes

- **Single source of truth.** The policy numbers (09:00 / 60-min grace / 480-min
  day / 60-min break) live once in `DEFAULT_ATTENDANCE_POLICY` and mirror the
  seeded `company_settings`. `attendanceRepository` reads the live
  `company_settings` row and passes a derived `AttendancePolicy` into the rule
  functions, so an admin changing settings changes behaviour without code edits.
- **Time rules are pure + injectable.** Every attendance rule takes the
  `Date`/seconds and an optional policy, so they are deterministic and unit-test
  without a clock or database.
- **One-per-day** is belt-and-suspenders: the rule helper makes a repeat submit
  an _update_ (never a duplicate), and the DB `UNIQUE` keys
  (`daily_status_updates(user_id, work_date, kind)`,
  `daily_reports(user_id, work_date)`) make duplicates impossible at the storage
  layer.
- **Employment type overrides (rule #10).** The source of truth is
  `employees.employment_type_id` → the seeded `employment_types` reference table
  (Full-time / Part-time / Contractor / Intern). It is set at **invite** time
  (Invite dialog → `inviteEmployeeFn` → `provisionInvitedEmployee`) and
  correctable later via the **employee edit** dialog
  (`useEmployeeManagement.edit`). Only **part-time** diverges from the defaults:
  its day targets **240 min** (4h) instead of the company-wide
  `company_settings.expected_work_minutes` (rule #4), and it **skips the Midday
  pulse** entirely (rule #6) — check-in and end-of-day stay required. All the
  branching keys off a single helper module,
  `features/hr/employment-type.ts`; no other file hardcodes "4h" or "part-time".
  The signed-in user's type is loaded with their identity and exposed as
  `useAuth().employmentType` (a slug), so nav / dashboard / attendance read one
  value with no flash. The 4h target is applied **both** client-side (live
  progress bar, Remaining, dashboard tile) **and** server-side —
  `finish_work_session` (migration
  `20260711140000_finish_session_employment_type.sql`) recomputes
  `overtime_seconds` and the `half_day` / `on_time` status against 240 min for
  part-timers, so persisted attendance is correct, not just the display. Midday
  is removed from the nav item, the dashboard widget + floating reminder, the
  "Submit midday" quick action, the manager/HR participation roll-up
  (part-timers never count as "missing"), and the `/app/midday` route itself.
  The **EOD missing-report** reminder (`job_missing_report_reminders`) and the
  attendance reminder are unaffected — part-timers still owe those.
- **Authorization** is mirrored, not duplicated: `permissions.ts` gates the UI;
  RLS (`can_review_reports`, the attendance write policies) is the authoritative
  enforcement. Rule #9 required a policy change — owner was previously an
  attendance admin; migration `20260630140000_attendance_owner_readonly.sql`
  removes `owner` from the `*_admin_write` policies on `attendance`,
  `attendance_sessions` and `break_sessions` while leaving owner's full read
  access intact.

## Running the tests

```bash
npm test          # vitest run — 26 tests across the 3 rule suites
npm run test:watch
```

Files: `src/services/attendance/rules.test.ts`,
`src/services/reports/rules.test.ts`,
`src/features/auth/permissions.test.ts`,
`src/components/layout/nav-config.test.ts` (rule #10 — Midday hidden for
part-time, kept for full-time / unknown).
