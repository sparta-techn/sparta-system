# SpartaFlow — Business Rules

> Where each rule lives, how it is enforced, and the tests that cover it.
> Rules are implemented as **pure, single-sourced domain functions** and wired
> into the service/repository layer; authorization rules also map to RLS.
> Run the tests with `npm test` (Vitest). Snapshot date: 2026-06-30.

---

## Rule → implementation → test

| # | Rule | Implemented in | Enforced / wired at | Tested in |
| --- | --- | --- | --- | --- |
| 1 | Working hours start at **09:00** | `services/attendance/rules.ts` (`DEFAULT_ATTENDANCE_POLICY.workStart`, `lateThresholdMinutes`) | `attendanceRepository.checkIn`; `company_settings.work_start_time`; `start_work_session` RPC | `services/attendance/rules.test.ts` |
| 2 | Check-in until **10:00** is **not** Absent | `rules.ts` (`isLate`, `lateMinutes`, grace = 60) | `checkIn` sets `late_minutes` + `status` | `rules.test.ts` |
| 3 | After **10:00** → **Late** (no check-in → **Absent**) | `rules.ts` (`attendanceStatusForCheckIn`) | `checkIn` writes `attendance.status`; absent derived when no check-in | `rules.test.ts` |
| 4 | Working duration **8 hours** (overtime beyond) | `rules.ts` (`computeWorkedSeconds`, `overtimeSeconds`, `classifyCompletedDay`, expected = 480 min) | `checkOut` writes `worked_seconds` / `overtime_seconds` / final `status` | `rules.test.ts` |
| 5 | Break duration **max 1 hour** | `rules.ts` (`remainingBreakSeconds`, `breakLimitExceeded`, max = 60 min) | break accounting in `checkOut`; `company_settings.max_break_minutes` | `rules.test.ts` |
| 6 | **One** Morning Check-in / Midday / EOD per day | `services/reports/rules.ts` (`resolveSubmissionMode`, `canCreateSubmission`) | `StatusUpdatesService.submit`, `DailyReportsService.submit`; DB `UNIQUE (user_id, work_date[, kind])` | `services/reports/rules.test.ts` |
| 7 | Dependency requests stay **Open until resolved** | `services/reports/rules.ts` (`isDependencyOpen`, `TERMINAL_DEPENDENCY_STATES`, `resolvedAtFor`) | `DependencyRequestsService.setState` / `listOpen` | `services/reports/rules.test.ts` |
| 8 | **Managers can review reports** | `features/auth/permissions.ts` (`canReviewReports`) | RLS `can_review_reports()` on report/attendance reads | `features/auth/permissions.test.ts` |
| 9 | **Owners** have **read-only** access to all attendance | `features/auth/permissions.ts` (`canViewAllAttendance`, `canAdministerAttendance`, `isAttendanceReadOnly`) | RLS: owner reads via `can_review_reports`; **migration `20260630140000`** drops `owner` from the attendance write policies | `features/auth/permissions.test.ts` |

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
  an *update* (never a duplicate), and the DB `UNIQUE` keys
  (`daily_status_updates(user_id, work_date, kind)`,
  `daily_reports(user_id, work_date)`) make duplicates impossible at the storage
  layer.
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
`src/features/auth/permissions.test.ts`.
