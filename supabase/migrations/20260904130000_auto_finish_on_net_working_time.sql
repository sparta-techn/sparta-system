-- =========================================================================
-- SpartaFlow Attendance — auto-finish measures NET WORKING TIME, and payroll
-- pays the scheduled day.
--
-- ── What changes ───────────────────────────────────────────────────────────
-- 20260904120000 auto-finished a session on DAY PROGRESS
-- (worked + LEAST(break, allowance)), so a full-timer who SKIPPED their break
-- had to work a straight 8h before the day closed, while one who took the full
-- hour closed after 7h of work. Same target, two different amounts of work.
--
-- The rule is now the one the business actually wants: the day closes on NET
-- WORKING TIME — time in the `working` state only, with every second spent in
-- the `on_break` state excluded, whenever and however long the break was taken.
--
--     full-time → 7h net worked   (expected_work_minutes − max_break_minutes)
--     part-time → 4h net worked   (unchanged)
--
-- Taking the break, skipping it, splitting it, or taking three hours of it all
-- produce the same thing: the session closes at the 7th worked hour. A break
-- only moves the wall-clock time at which that happens.
--
-- ── Payroll ────────────────────────────────────────────────────────────────
-- A full-time day is still an EIGHT hour day for pay. The break hour is paid
-- whether or not it was taken, so a day closed by auto-finish is credited the
-- scheduled day length (company_settings.expected_work_minutes) rather than the
-- 7h of working time the session actually recorded. The uplift is exactly
-- max_break_minutes and is applied ONCE PER DAY, only to days closed with
-- check_out_type = 'auto', and never to part-time (their 4h is the whole
-- scheduled day — there is no break allowance inside it to credit back).
--
-- A re-check-in after auto-finish still adds its own working_seconds on top:
-- the uplift closes the gap between the target and the scheduled day, it does
-- not replace the day's total.
--
-- ── Unchanged on purpose ───────────────────────────────────────────────────
-- The threshold walk (session_target_threshold_ts), the pg_cron sweep
-- (job_auto_finish_sessions, every 10 min), the one-open-session index, the
-- multiple-sessions-per-day support and the part-time rules (no check-in alert,
-- 4h target, no Midday report) are all reused as-is from 20260904120000.
--
-- Mirrored in TypeScript by `src/features/hr/employment-type.ts`
-- (netWorkTargetMinutes / paidBreakCreditMinutes) and
-- `src/services/attendance/rules.ts` (computeWorkedSeconds /
-- netWorkTargetSeconds / dayTargetThresholdAt).
-- =========================================================================

-- =========================================================================
-- 1. session_day_target — net working target vs. scheduled (paid) day
-- =========================================================================
-- Two numbers per employee, and they are no longer the same one:
--   net_target_minutes → what must be WORKED before the day auto-finishes.
--   paid_day_minutes   → what a completed day is worth to PAYROLL.
-- Full-time separates them by the break allowance (420 vs 480); part-time has
-- no allowance, so both are 240 and nothing is ever credited back.
--
-- Dropped rather than replaced: CREATE OR REPLACE cannot rename OUT parameters,
-- and `break_credit_secs` no longer exists as a concept in the threshold.
DROP FUNCTION IF EXISTS public.session_day_target(uuid);

CREATE FUNCTION public.session_day_target(
  _uid uuid, OUT net_target_minutes int, OUT paid_day_minutes int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _settings public.company_settings%ROWTYPE;
BEGIN
  SELECT * INTO _settings FROM public.company_settings WHERE id = true;

  SELECT
    CASE WHEN et.slug = 'part-time' THEN 240
         -- GREATEST guards a misconfigured allowance larger than the day.
         ELSE GREATEST(_settings.expected_work_minutes - _settings.max_break_minutes, 1) END,
    CASE WHEN et.slug = 'part-time' THEN 240
         ELSE _settings.expected_work_minutes END
    INTO net_target_minutes, paid_day_minutes
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.user_id = _uid;

  IF net_target_minutes IS NULL THEN  -- no employee row → company default
    net_target_minutes :=
      GREATEST(_settings.expected_work_minutes - _settings.max_break_minutes, 1);
    paid_day_minutes := _settings.expected_work_minutes;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.session_day_target(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.session_day_target(uuid) TO authenticated;

-- =========================================================================
-- 2. session_net_work_threshold_ts — the one net-working-time calculation
-- =========================================================================
-- The instant NET WORKING TIME since started_at first reaches _target_secs.
--
-- This REUSES the existing break-aware walk rather than reimplementing it:
-- session_target_threshold_ts already advances only during `working` spans and
-- credits break time only up to the allowance it is handed, so passing a
-- credit of 0 makes it a pure working-time walk — the same quantity
-- work_sessions.working_seconds holds for a closed session
-- (elapsed − break_seconds). Wrapping it here means no caller can pass a
-- non-zero credit by accident.
--
-- Consequences that fall out of the walk, unchanged:
--   * time in the `on_break` state never advances the target (credit 0 means a
--     break of any length simply pushes the finish instant later by its own
--     duration);
--   * while a break is OPEN the result is NULL — progress is frozen, so there
--     is nothing to close;
--   * the answer is independent of WHEN it is evaluated, so the 10-minute sweep
--     back-dates finished_at to the true crossing instant;
--   * it works in absolute timestamps, so an overnight shift is attributed by
--     its real started_at rather than by "today".
CREATE OR REPLACE FUNCTION public.session_net_work_threshold_ts(
  _session public.work_sessions, _target_secs int
) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.session_target_threshold_ts(_session, _target_secs, 0);
$$;
REVOKE ALL ON FUNCTION public.session_net_work_threshold_ts(public.work_sessions, int) FROM public;
GRANT EXECUTE ON FUNCTION public.session_net_work_threshold_ts(public.work_sessions, int)
  TO authenticated;

-- =========================================================================
-- 3. finish_work_session — a MANUAL close, measured on worked time
-- =========================================================================
-- Only the half-day rule changes: the day is now judged against the net working
-- target (3h30 of work for a full-timer, 2h for a part-timer) instead of half
-- the clock day, because working time is the quantity the target is set in.
-- Break time is recorded exactly as before and simply no longer counts toward
-- anything.
CREATE OR REPLACE FUNCTION public.finish_work_session()
RETURNS public.work_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _session public.work_sessions%ROWTYPE;
  _settings public.company_settings%ROWTYPE;
  _now timestamptz := now();
  _break_secs int := 0;
  _total_secs int := 0;
  _work_secs int := 0;
  _net_target_minutes int;
  _paid_day_minutes int;
  _is_first boolean;
  _status public.attendance_status;
  _row public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session'; END IF;

  SELECT t.net_target_minutes, t.paid_day_minutes
    INTO _net_target_minutes, _paid_day_minutes
    FROM public.session_day_target(_uid) t;

  IF _session.session_status = 'on_break' THEN
    UPDATE public.work_session_breaks
      SET ended_at = _now,
          duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (_now - started_at))::int)
    WHERE session_id = _session.id AND ended_at IS NULL;
  END IF;

  SELECT COALESCE(SUM(duration_seconds), 0) INTO _break_secs
    FROM public.work_session_breaks WHERE session_id = _session.id;

  -- Net working time: everything on the clock minus everything spent on break.
  _total_secs := GREATEST(0, EXTRACT(EPOCH FROM (_now - _session.started_at))::int);
  _work_secs := GREATEST(_total_secs - _break_secs, 0);

  -- Is this the session that represents the day? A later top-up session must not
  -- restate the day as a half day just because it was short.
  _is_first := NOT EXISTS (
    SELECT 1 FROM public.work_sessions
     WHERE user_id = _uid AND work_date = _session.work_date AND id <> _session.id
       AND started_at < _session.started_at
  );

  _status := CASE
    WHEN _session.late_minutes > _settings.grace_period_minutes
      THEN 'late'::public.attendance_status
    WHEN _is_first AND _work_secs < (_net_target_minutes * 60) / 2
      THEN 'half_day'::public.attendance_status
    ELSE 'on_time'::public.attendance_status
  END;

  UPDATE public.work_sessions
    SET finished_at = _now,
        session_status = 'finished',
        attendance_status = _status,
        working_seconds = _work_secs,
        break_seconds = _break_secs,
        overtime_seconds = 0,
        check_out_type = 'manual'
  WHERE id = _session.id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_work_session() FROM public;
GRANT EXECUTE ON FUNCTION public.finish_work_session() TO authenticated;

-- =========================================================================
-- 4. auto_finish_session_if_due — closes at the Nth WORKED hour
-- =========================================================================
-- Same contract as before (idempotent, takes an explicit uid so the cron sweep
-- can drive it, back-dates finished_at to the true crossing instant, only the
-- day's first session is eligible). The single change is WHICH instant it
-- closes at: net working time reaching the target, never wall-clock elapsed.
--
-- A break open at the threshold can no longer exist — with no break credit the
-- walk returns NULL for the whole time a break is open — so there is nothing to
-- close out mid-break, and break_seconds is simply the session's recorded total.
CREATE OR REPLACE FUNCTION public.auto_finish_session_if_due(_uid uuid DEFAULT auth.uid())
RETURNS public.work_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session public.work_sessions%ROWTYPE;
  _settings public.company_settings%ROWTYPE;
  _net_target_minutes int;
  _paid_day_minutes int;
  _threshold timestamptz;
  _break_secs int := 0;
  _work_secs int := 0;
  _row public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;  -- nothing open

  -- The daily target is spent once a session for this work_date has closed.
  -- A re-check-in is additional logged regular time, not a second full day.
  IF EXISTS (
    SELECT 1 FROM public.work_sessions
     WHERE user_id = _uid AND work_date = _session.work_date AND id <> _session.id
       AND session_status = 'finished'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT t.net_target_minutes, t.paid_day_minutes
    INTO _net_target_minutes, _paid_day_minutes
    FROM public.session_day_target(_uid) t;

  _threshold := public.session_net_work_threshold_ts(_session, _net_target_minutes * 60);
  IF _threshold IS NULL THEN RETURN NULL; END IF;  -- target not worked yet

  -- Every break of this session ended before the threshold (see above), so the
  -- recorded total is the break time inside the day being closed.
  SELECT COALESCE(SUM(
           GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at, _threshold), _threshold)
                                           - started_at)))
         ), 0)::int
    INTO _break_secs
    FROM public.work_session_breaks
   WHERE session_id = _session.id AND started_at < _threshold;

  -- Equals _net_target_minutes * 60 by construction, but derived from the real
  -- timestamps rather than assumed: payroll reads working_seconds, and it must
  -- stay the true worked figure. The scheduled-day uplift is applied in
  -- payroll_report, NOT baked into this column.
  _work_secs := GREATEST(
    0, EXTRACT(EPOCH FROM (_threshold - _session.started_at))::int - _break_secs
  );

  UPDATE public.work_sessions
     SET finished_at = _threshold,
         session_status = 'finished',
         attendance_status = CASE
           WHEN _session.late_minutes > _settings.grace_period_minutes
             THEN 'late'::public.attendance_status
           ELSE 'on_time'::public.attendance_status END,
         working_seconds = _work_secs,
         break_seconds = _break_secs,
         overtime_seconds = 0,
         check_out_type = 'auto'
   WHERE id = _session.id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_finish_session_if_due(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.auto_finish_session_if_due(uuid) TO authenticated;

-- =========================================================================
-- 5. payroll_report — an auto-finished full-time day is worth the FULL day
-- =========================================================================
-- The only change is `work_agg`, which used to be a flat
-- SUM(work_sessions.working_seconds) over the period. Summing raw working time
-- now under-pays every full-timer by the break hour, because the session closes
-- at 7h worked by design. Hours are therefore aggregated PER DAY first, so the
-- scheduled-day credit can be applied once per completed day:
--
--     day hours = SUM(working_seconds of every session that day)
--               + (max_break_minutes, if any session that day closed with
--                  check_out_type = 'auto' AND the employee is not part-time)
--
-- which makes a plain auto-finished full-time day 7h + 1h = 8h — the scheduled
-- day length — while a day with a post-auto-finish top-up session comes out at
-- 8h + the top-up, since that time is genuinely additional logged work.
--
-- Part-time is untouched: `slug <> 'part-time'` gates the credit, so their day
-- stays exactly the 4h their session recorded, priced at hourly_rate.
-- Manually-finished days are untouched too: they pay the time actually worked.
--
-- Everything downstream is unchanged. expected_hours stays expected_days × 8h,
-- and the monthly-salary line still pays
-- LEAST(worked_hours + paid_exception_hours, expected_hours) — which a month of
-- auto-finished days now actually reaches instead of landing at 7/8 of it.
CREATE OR REPLACE FUNCTION public.payroll_report(_from date, _to date)
RETURNS SETOF public.payroll_line
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _daily_hours numeric;
  -- Seconds credited to a completed full-time day on top of tracked working
  -- time: the paid break hour, whether or not it was taken.
  _break_credit_secs int;
  _horizon     date;
BEGIN
  PERFORM public._require_payroll_view();
  SELECT expected_work_minutes / 60.0, max_break_minutes * 60
    INTO _daily_hours, _break_credit_secs
    FROM public.company_settings WHERE id = true;
  _horizon := LEAST(_to, public.current_work_date());

  RETURN QUERY
  WITH emp_base AS (
    SELECT
      e.id      AS employee_id,
      e.user_id AS user_id,
      COALESCE(p.display_name, p.full_name, 'Unknown') AS employee_name,
      COALESCE(et.slug, 'full-time') AS slug,
      COALESCE(c.currency,
               (SELECT default_currency FROM public.company_settings WHERE id = true),
               'EGP') AS currency,
      c.monthly_salary,
      c.hourly_rate,
      e.hire_date,
      e.end_date,
      public.working_days_in_month(_from) AS w
    FROM public.employees e
    JOIN public.profiles p ON p.id = e.user_id
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
    LEFT JOIN public.employee_compensation c ON c.employee_id = e.id
    WHERE e.status <> 'offboarded'
      AND (e.hire_date IS NULL OR e.hire_date <= _to)
  ),
  day_agg AS (
    SELECT
      b.employee_id,
      count(*) FILTER (WHERE f.expected) AS expected_days,
      count(*) FILTER (WHERE f.expected AND f.has_session) AS present_days,
      count(*) FILTER (WHERE f.expected AND NOT f.has_session AND NOT f.has_exc) AS absence_days
    FROM emp_base b
    CROSS JOIN LATERAL generate_series(_from, _horizon, interval '1 day') AS gs(day)
    CROSS JOIN LATERAL (
      SELECT
        (
          EXTRACT(DOW FROM gs.day)::int NOT IN
            (SELECT unnest(weekend_days) FROM public.company_settings WHERE id = true)
          AND gs.day::date NOT IN (SELECT holiday_date FROM public.holidays WHERE is_full_day)
          AND gs.day::date >= COALESCE(b.hire_date, _from)
          AND (b.end_date IS NULL OR gs.day::date <= b.end_date)
        ) AS expected,
        -- Unchanged by multi-session days: presence is existence, not a count.
        EXISTS (
          SELECT 1 FROM public.work_sessions ws
           WHERE ws.user_id = b.user_id AND ws.work_date = gs.day::date
        ) AS has_session,
        EXISTS (
          SELECT 1 FROM public.attendance_exceptions ax
           WHERE ax.employee_id = b.employee_id AND ax.exception_date = gs.day::date
        ) AS has_exc
    ) f
    GROUP BY b.employee_id
  ),
  day_work AS (
    -- One row per employee-day. `auto_finished` marks a day the employee
    -- completed against their net working target, which is what earns the
    -- scheduled-day credit below. SUM covers post-auto-finish top-up sessions.
    SELECT
      b.employee_id,
      ws.work_date,
      SUM(ws.working_seconds)::numeric AS worked_seconds,
      -- COALESCE matters: check_out_type is NULL on every row predating the
      -- column, and bool_or over all-NULL input is NULL, not false.
      COALESCE(bool_or(ws.check_out_type = 'auto'), false) AS auto_finished
    FROM emp_base b
    JOIN public.work_sessions ws
      ON ws.user_id = b.user_id AND ws.work_date BETWEEN _from AND _to
    GROUP BY b.employee_id, ws.work_date
  ),
  work_agg AS (
    SELECT
      b.employee_id,
      COALESCE(SUM(
        dw.worked_seconds
        + CASE
            -- The paid break hour, credited once per completed full-time day.
            WHEN dw.auto_finished AND b.slug <> 'part-time' THEN _break_credit_secs
            ELSE 0
          END
      ), 0)::numeric AS worked_seconds
    FROM emp_base b
    LEFT JOIN day_work dw ON dw.employee_id = b.employee_id
    GROUP BY b.employee_id
  ),
  exc_agg AS (
    SELECT
      b.employee_id,
      count(ax.id) FILTER (WHERE ax.paid) AS paid_cnt,
      count(ax.id) FILTER (WHERE NOT ax.paid) AS unpaid_cnt,
      COALESCE(SUM(ax.adjustment_minutes) FILTER (WHERE ax.paid), 0)::numeric AS paid_min,
      COALESCE(SUM(ax.adjustment_minutes) FILTER (WHERE NOT ax.paid), 0)::numeric AS unpaid_min
    FROM emp_base b
    LEFT JOIN public.attendance_exceptions ax
      ON ax.employee_id = b.employee_id AND ax.exception_date BETWEEN _from AND _to
    GROUP BY b.employee_id
  ),
  calc AS (
    SELECT
      b.*,
      d.expected_days, d.present_days, d.absence_days,
      round(wa.worked_seconds / 3600.0, 2) AS worked_hours,
      ea.paid_cnt, ea.unpaid_cnt,
      round(ea.paid_min / 60.0, 2) AS paid_exc_hours,
      round(ea.unpaid_min / 60.0, 2) AS unpaid_exc_hours,
      (b.slug = 'part-time' OR (b.hourly_rate IS NOT NULL AND b.monthly_salary IS NULL)) AS is_pt,
      (d.expected_days * _daily_hours) AS expected_hours
    FROM emp_base b
    JOIN day_agg  d  ON d.employee_id  = b.employee_id
    JOIN work_agg wa ON wa.employee_id = b.employee_id
    JOIN exc_agg  ea ON ea.employee_id = b.employee_id
  )
  SELECT
    c.employee_id,
    c.employee_name,
    c.slug,
    c.currency,
    c.monthly_salary,
    c.hourly_rate,
    c.w,
    c.expected_days::int,
    c.present_days::int,
    (CASE WHEN c.is_pt THEN 0 ELSE c.absence_days END)::int,
    CASE WHEN c.is_pt THEN NULL ELSE round(c.expected_hours, 2) END,
    round(c.worked_hours, 2),
    c.paid_cnt::int,
    c.unpaid_cnt::int,
    round(c.paid_exc_hours, 2),
    round(c.unpaid_exc_hours, 2),
    round(base.base_pay, 2),
    0::numeric,   -- overtime_hours          — feature removed, not calculated
    0::numeric,   -- overtime_pay            — feature removed, not calculated
    0,            -- overtime_pending_count  — feature removed, not surfaced
    0,            -- overtime_rejected_count — feature removed, not surfaced
    round(base.base_pay, 2),
    CASE WHEN c.is_pt THEN c.hourly_rate IS NOT NULL ELSE c.monthly_salary IS NOT NULL END
  FROM calc c
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN c.is_pt THEN COALESCE(c.hourly_rate, 0) * (c.worked_hours + c.paid_exc_hours)
      WHEN c.monthly_salary IS NOT NULL AND c.w > 0 THEN
        (c.monthly_salary / (c.w * _daily_hours))
        * LEAST(c.worked_hours + c.paid_exc_hours, c.expected_hours)
      ELSE 0
    END AS base_pay
  ) base
  ORDER BY c.employee_name;
END;
$$;
REVOKE ALL ON FUNCTION public.payroll_report(date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.payroll_report(date, date) TO authenticated;

-- =========================================================================
-- 6. Reprocessing aid — days paid on working time with no break credit
-- =========================================================================
-- Every full-time day closed BEFORE this migration was paid on raw
-- working_seconds. That is correct for days where the employee had to work the
-- whole scheduled day, and short by the break allowance for days closed at the
-- target under the break-inclusive rule (20260810120000 onward), where the
-- session recorded ~7h of work for a full 8h day.
--
-- This view lists those days so they can be reviewed and, if needed, corrected
-- through the existing payslip_corrections flow. It reports rather than
-- rewrites: no historical row is modified by this migration.
CREATE OR REPLACE VIEW public.payroll_days_missing_break_credit AS
WITH settings AS (
  SELECT expected_work_minutes * 60 AS scheduled_secs,
         max_break_minutes * 60     AS allowance_secs
    FROM public.company_settings WHERE id = true
),
days AS (
  SELECT
    e.id                                  AS employee_id,
    COALESCE(p.display_name, p.full_name) AS employee_name,
    ws.work_date,
    SUM(ws.working_seconds)               AS worked_seconds,
    SUM(ws.break_seconds)                 AS break_seconds,
    -- NULL check_out_type (every row predating the column) must read as
    -- "not auto-finished", and bool_or over all-NULL input is NULL, not false.
    COALESCE(bool_or(ws.check_out_type = 'auto'), false)  AS auto_finished,
    COALESCE(bool_or(ws.check_out_type IS NULL), false)   AS predates_check_out_type
  FROM public.work_sessions ws
  JOIN public.employees e ON e.user_id = ws.user_id
  JOIN public.profiles  p ON p.id = ws.user_id
  LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
  WHERE ws.session_status = 'finished'
    AND COALESCE(et.slug, 'full-time') <> 'part-time'
  GROUP BY e.id, p.display_name, p.full_name, ws.work_date
)
SELECT
  d.employee_id,
  d.employee_name,
  d.work_date,
  d.worked_seconds,
  d.break_seconds,
  round(d.worked_seconds / 3600.0, 2)                    AS paid_hours,
  round(s.scheduled_secs / 3600.0, 2)                    AS scheduled_hours,
  round((s.scheduled_secs - d.worked_seconds) / 3600.0, 2) AS shortfall_hours,
  d.predates_check_out_type
FROM days d
CROSS JOIN settings s
WHERE NOT d.auto_finished
  -- Short of the scheduled day by at most the break allowance, so genuinely
  -- short days (sick leave, half days) that were correctly paid short are not
  -- swept in …
  AND d.worked_seconds < s.scheduled_secs
  AND d.worked_seconds >= s.scheduled_secs - s.allowance_secs
  -- … and break time was actually recorded, which is what makes the day look
  -- short in the first place.
  AND d.break_seconds > 0;

COMMENT ON VIEW public.payroll_days_missing_break_credit IS
  'Historical full-time days paid on raw working time with no break credit: '
  'finished, short of the scheduled day by at most the break allowance, and '
  'with break time actually recorded. Review candidates for payslip_corrections '
  '— nothing here is corrected automatically.';

REVOKE ALL ON public.payroll_days_missing_break_credit FROM public;
GRANT SELECT ON public.payroll_days_missing_break_credit TO authenticated;

-- The view exposes other employees' hours, so it is readable only by the roles
-- that may already see payroll. Views are not RLS-protected by default; the
-- security_invoker setting makes the underlying tables' RLS apply to the caller.
ALTER VIEW public.payroll_days_missing_break_credit SET (security_invoker = true);
