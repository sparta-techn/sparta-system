# SpartaFlow — Attendance Module Review

> Review of the Attendance module across business rules, repositories, services,
> Supabase queries, TypeScript, performance, security and RLS.
> Scope: the new `attendance` / `attendance_sessions` / `break_sessions` /
> `attendance_events` schema (migration `20260630130000`) + its services
> (`services/attendance/*`), repository (`repositories/attendance/*`), rules
> (`services/attendance/rules.ts`), and the live legacy path
> (`features/attendance/*` over `work_sessions`).
> Snapshot date: 2026-06-30. Verdict: **sound, one critical bug fixed; remaining
> findings are documented, no redesign performed.**

---

## 0. What was fixed (critical, this pass)

| Fix | File | Why critical |
| --- | --- | --- |
| **`checkIn` now rejects a second open session** (`already_checked_in`) | `repositories/attendance/attendance.repository.ts` | Without it, calling `checkIn` while a session was already open created a **duplicate `working` session** → orphaned open sessions, ambiguous `getActive`, and **double-counted worked hours** at checkout. Mirrors the legacy `start_work_session` uniqueness guard. |

Nothing else was changed. tsc / eslint / vitest (26 tests) all pass.

---

## 1. Findings summary

| # | Area | Severity | Status |
| --- | --- | --- | --- |
| F1 | Security / RLS — business rules enforced **client-side**, writes self-grantable | **Critical (architectural)** | Documented — fix = RPC-ification (redesign, out of scope) |
| F2 | Repositories — duplicate open session on repeat `checkIn` | **Critical** | ✅ Fixed |
| F3 | Business rules — late calc uses **runtime timezone**, not company timezone | High | Documented (latent — new path not yet UI-wired) |
| F4 | Performance — non-atomic, sequential round-trips per verb | Medium | Documented |
| F5 | Repositories — `ensureForDate` get-then-create race | Low | Documented |
| F6 | Performance — `company_settings` re-fetched every check-in/out | Low | Documented |
| F7 | RLS — managers read **all** attendance company-wide (not team-scoped) | Low (by design) | Documented |
| F8 | TypeScript — relaxed `db` client casts in services | Info | Acceptable |

---

## 2. Business rules

**Correct & wired:** 09:00 start, 60-min grace → 10:00 Late threshold, Absent
when no check-in, 8-hour day + overtime, 1-hour break cap. All live in the pure
`services/attendance/rules.ts` (single source) and are unit-tested
(`rules.test.ts`, 14 cases). `checkIn` writes `late_minutes`/`status`; `checkOut`
writes `worked_seconds`/`overtime_seconds`/final `status`. Policy is read from the
live `company_settings` row, so admin changes apply without code edits. ✅

**F3 (High, latent).** `lateMinutes` / `attendanceStatusForCheckIn` derive the
wall clock via `Date.getHours()/getMinutes()`, i.e. the **JS runtime timezone**.
The work *date* is resolved server-side in the company timezone
(`current_work_date()`), but the late *classification* uses local time. A user
whose browser timezone differs from the company (`Africa/Cairo`) would be
mis-classified on/around the 10:00 boundary. The **legacy** `start_work_session`
RPC computes this correctly server-side; the new repository path does not.
Not fixed because: (a) it is latent — the UI is still wired to the legacy
`work_sessions` path, not this repository; (b) the correct fix is to compute
time server-side (see F1), which is a redesign. Recommended interim fix if the
new path is wired before RPC-ification: compute minutes-of-day in
`company_settings.timezone` via `Intl.DateTimeFormat` before calling the rules.

---

## 3. Security & RLS

**F1 — Critical (architectural).** The new attendance tables use **direct,
self-grantable writes** (`attendance_insert_self` / `attendance_update_self`,
and the equivalents on `attendance_sessions` / `break_sessions`) rather than the
RPC-only model the legacy `work_sessions` uses. Consequences:

- An employee can `INSERT`/`UPDATE` **their own** attendance row with **arbitrary
  values** — e.g. set `status='on_time'`, `late_minutes=0`, or inflate
  `worked_seconds` — bypassing every business rule in §2 (which are computed in
  the client repository, not the database).
- The rules are therefore **advisory, not enforced**, on this schema.

This is the single most important finding. It is **not fixed** because the only
correct remedy is to make the lifecycle writes go through `SECURITY DEFINER`
RPCs (`start_attendance_session` / `check_out` / `start_break` / `end_break`)
that compute status/late/worked server-side and revoke direct
INSERT/UPDATE — exactly the pattern `work_sessions` already uses. That is a
redesign of the write path and was explicitly out of scope ("do not redesign").
Until then, **treat the new attendance tables as untrusted for compliance
reporting** and keep using the legacy `work_sessions` path for anything
authoritative.

**Verified correct:**
- **Owners read-only (rule #9):** ✅ owner reads all via `can_review_reports`
  (the `*_read_reviewers` policies); migration `20260630140000` removed `owner`
  from the `*_admin_write` policies, so owner cannot mutate others' attendance.
  Matches `isAttendanceReadOnly` (tested).
- **`attendance_events` is append-only:** ✅ table grants only `SELECT, INSERT`;
  `AttendanceEventsService` additionally rejects `update`/`upsert`/`remove`.
- **No service-key exposure; `anon` never granted; RLS enabled on every table.** ✅
- **`SET search_path = public` on `can_review_reports`** (SECURITY DEFINER). ✅

**F7 — Low (by design).** `can_review_reports` includes `project_manager` /
`team_lead`, so any manager reads **all** employees' attendance, not just their
team. This matches the legacy `work_sessions` read policy and the product intent
of a small remote-company OS, so it is noted, not flagged. If team-scoping is
later required it needs an org-membership helper in the policy.

---

## 4. Repositories & services

- **Structure is clean:** one `BaseService` subclass per table (records / sessions
  / breaks / events), thin finders, and a single orchestrating
  `AttendanceRepository` composing them into lifecycle verbs. Singleton exports,
  consistent with HR/auth conventions. ✅
- **F2 (Critical) — fixed:** duplicate-session guard added to `checkIn`.
- **F4 (Medium) — non-atomicity.** Each verb is a multi-statement sequence
  (`checkIn` ≈ 6 round-trips, `checkOut` ≈ 9) with no transaction. A failure
  mid-sequence (e.g. session updated but record not, or event not logged) leaves
  inconsistent state; concurrent calls can interleave. The class header already
  documents the intended remedy (fold into RPCs). Same root cause as F1 — the
  correct fix is server-side functions. Not fixed (redesign).
- **F5 (Low) — `ensureForDate` race.** Get-then-create on `(user_id, work_date)`;
  two concurrent first check-ins both miss the row and the second `INSERT` hits
  the `UNIQUE` constraint and throws. The new `checkIn` guard (F2) makes this
  unreachable in the normal single-user flow; documented for completeness. A
  proper fix is `INSERT … ON CONFLICT DO NOTHING RETURNING` (an RPC/upsert).
- **Break accounting is correct:** open break is closed first, then summed, then
  `worked = span − breaks`; totals accumulate across multiple sessions. ✅

---

## 5. Supabase queries & performance

- **Indexes are adequate** for the access paths:
  `attendance(user_id, work_date)` (unique) covers `getByDate`;
  `idx_attendance_sessions_user_date` + partial active-status index cover
  `getActive`; `idx_break_sessions_session` covers `getOpenBreak`/`listBySession`.
  No full scans on the hot paths. ✅
- `getDay` parallelizes sessions + breaks with `Promise.all`. ✅
- `getActive` / `getOpenBreak` use `.limit(1).maybeSingle()` — bounded. ✅
- **F4** (sequential round-trips, above) is the main performance cost; an RPC
  collapses each verb to one round-trip.
- **F6 (Low):** `getPolicy()` fetches `company_settings` on **every** check-in /
  check-out. It's a single indexed singleton read, but it could be cached
  (TanStack Query `companySettingsQuery` already exists with `staleTime`) when the
  repository is wired to the UI.

---

## 6. TypeScript

- Strict, **no `any`**; the relaxed `db` client (`services/core/client.ts`) is the
  single, documented place loose casts live (these tables aren't in generated
  `types.ts` yet). Acceptable and contained (F8). ✅
- Row/Insert/Update types are explicit; status enums reused from
  `features/attendance/types` (single-sourced). ✅
- `tsc --noEmit` clean. The append-only override signatures on
  `AttendanceEventsService` compile and behave (reject) as intended. ✅

---

## 7. Recommendations (prioritized)

1. **Move the write path to `SECURITY DEFINER` RPCs** (resolves F1, F3, F4, F5,
   F6 at once): `start_attendance_session`, `check_out_attendance`,
   `start_break`, `end_break` — compute work date, late, worked/overtime and
   status server-side in the company timezone; then `REVOKE INSERT/UPDATE` on the
   three tables from `authenticated` (keep self/manager `SELECT`). This is the
   `work_sessions` pattern and the only way the business rules become enforceable.
2. Until then, **do not treat the new attendance tables as authoritative** for
   compliance; the live `work_sessions` path remains the source of truth.
3. When wiring the repository to the UI, cache `getPolicy()` via the existing
   `companySettingsQuery` (F6).

---

## 8. Sign-off

- Critical bug **F2 fixed**; F1/F3/F4 require RPC-ification (redesign — not done
  per instructions) and are documented with concrete remedies.
- `npm test` → **26 passing**; `tsc --noEmit` clean; `eslint` clean.
- No redesign performed; no UI changed.
