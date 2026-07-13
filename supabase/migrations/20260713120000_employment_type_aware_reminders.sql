-- =========================================================================
-- SpartaFlow — employment-type aware attendance & missing-report reminders
-- =========================================================================
-- Both scheduled reminder scans were employment-type blind. Now that employees
-- carry an employment type (`employees.employment_type_id` -> `employment_types`,
-- slug `part-time`), the two "who is missing X today" scans branch on it. These
-- functions are the SINGLE source used by the pg_cron jobs AND the manager's
-- on-demand "Send reminder" RPC (`job_missing_report_reminders`), so fixing them
-- here fixes every notification surface at once (employee nudge + reviewer alert
-- + on-demand). Signatures/grants are unchanged (CREATE OR REPLACE in place).
--
--   1. "hasn't checked in" — part-time employees are removed from the scan
--      ENTIRELY. We have no per-day schedule for a part-timer, so "no check-in"
--      is not actionable (they may simply not work today). Full-time (and anyone
--      without an employment type) keep the original behavior unchanged.
--
--   2. "missing EOD report" — part-time employees are flagged only once their
--      working day is genuinely over, defined per part-timer (not a clock time):
--        - Clocked in AND closed their work session (`work_sessions.session_status
--          = 'finished'`) at least 30 min ago (grace, so a report written right
--          after clocking out isn't nagged) -> flagged.
--        - Never started a work session today -> NOT flagged. "Didn't work" is a
--          different situation from "worked but forgot the report", and without a
--          part-time schedule we cannot tell an off-day from a forgotten check-in;
--          the safe, consistent choice (mirroring #1) is to alert only on positive
--          evidence of a completed session.
--      Full-time keeps the fixed end-of-day boundary (17:30 UTC), unchanged.
--
-- Because part-timers must be flagged shortly after their session ends (any
-- hour), the missing-report job is rescheduled from once-daily to every 30 min.
-- Full-time observable behavior is preserved: the 17:30 UTC gate below plus the
-- existing once-per-day dedup mean full-timers still fire exactly once, at the
-- first run past 17:30.
-- =========================================================================

-- ── 1. "hasn't checked in" scan — exclude part-time entirely ───────────────
CREATE OR REPLACE FUNCTION public.employees_without_attendance(_work_date DATE)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = p.id AND ur.role <> 'viewer'::public.app_role)
    -- Part-timers are never nudged for a missing check-in (no per-day schedule).
    AND NOT EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.employment_types et ON et.id = e.employment_type_id
      WHERE e.user_id = p.id AND et.slug = 'part-time'
    )
    AND NOT EXISTS (SELECT 1 FROM public.attendance a
                     WHERE a.user_id = p.id AND a.work_date = _work_date);
$$;
REVOKE EXECUTE ON FUNCTION public.employees_without_attendance(DATE) FROM PUBLIC, anon;

-- ── 2. "missing EOD report" scan — part-time gated on a finished session ────
-- Returns who is GENUINELY missing their report as of now(), branched by type.
CREATE OR REPLACE FUNCTION public.employees_without_submitted_report(_work_date DATE)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = p.id AND ur.role <> 'viewer'::public.app_role)
    AND NOT EXISTS (SELECT 1 FROM public.daily_reports dr
                     WHERE dr.user_id = p.id AND dr.work_date = _work_date
                       AND dr.status = 'submitted'::public.daily_report_status)
    AND CASE
          WHEN EXISTS (
            SELECT 1 FROM public.employees e
            JOIN public.employment_types et ON et.id = e.employment_type_id
            WHERE e.user_id = p.id AND et.slug = 'part-time'
          ) THEN
            -- Part-time: only after they've CLOSED a work session ≥30 min ago.
            -- Never started a session today -> this is FALSE -> no alert.
            EXISTS (
              SELECT 1 FROM public.work_sessions ws
              WHERE ws.user_id = p.id
                AND ws.work_date = _work_date
                AND ws.session_status = 'finished'
                AND ws.finished_at <= now() - interval '30 minutes'
            )
          ELSE
            -- Full-time / contractor / intern / unknown: expected the whole
            -- working day; "day over" is the fixed end-of-day boundary (17:30 UTC).
            (now() AT TIME ZONE 'UTC')::time >= time '17:30'
        END;
$$;
REVOKE EXECUTE ON FUNCTION public.employees_without_submitted_report(DATE) FROM PUBLIC, anon;

-- ── 3. Reschedule the missing-report job: once-daily -> every 30 minutes ────
-- The scan above now decides eligibility (full-time gated to ≥17:30, part-time to
-- finished-session+grace), so a frequent cadence catches part-timers shortly
-- after they finish without changing full-time timing. The attendance job and
-- its function keep their existing 10:00 UTC schedule (it picks up the new
-- function body automatically).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spartaflow-missing-report-reminders') THEN
    PERFORM cron.unschedule('spartaflow-missing-report-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'spartaflow-missing-report-reminders',
  '*/30 * * * *',
  $$SELECT public.job_missing_report_reminders();$$
);
