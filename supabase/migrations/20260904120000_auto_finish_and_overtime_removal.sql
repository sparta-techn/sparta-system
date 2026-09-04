-- =========================================================================
-- SpartaFlow Attendance — auto-finish replaces the overtime auto-transition,
-- and the overtime calculation leaves the payroll pipeline.
--
-- ── PART 1: auto-finish at target hours ────────────────────────────────────
-- When an open session reaches the employee's daily target it is now CLOSED
-- automatically instead of being split into a pending overtime session:
--     finished_at     = the exact instant the target was reached
--     session_status  = 'finished'      (the day is complete)
--     check_out_type  = 'auto'          (new column + enum)
-- The employee may check in again the same day; that creates a SECOND
-- work_sessions row for the same work_date, which simply accrues additional
-- regular time and is NOT auto-finished again (the daily target is spent).
-- Supporting that required dropping the UNIQUE (user_id, work_date) constraint;
-- a partial unique index now enforces the real invariant — at most one OPEN
-- session per employee at a time.
--
-- ── What "reaching the target" means (unchanged on purpose) ────────────────
-- The threshold stays DAY PROGRESS, not raw wall-clock:
--     progress = worked_seconds + LEAST(break_seconds, break_credit)
--   * full-time → target = company_settings.expected_work_minutes (8h),
--     break_credit = company_settings.max_break_minutes (60m). An 8h day is 7h
--     worked + 1h break, so with a break at or under the allowance this is
--     EXACTLY wall-clock (started_at + 8h); only break time past the allowance
--     pushes the finish out.
--   * part-time → target = 240m, break_credit = 0. Their 4h is real work, so a
--     break always pushes their finish out. Switching part-time to wall-clock
--     would silently cut their day, so the existing rule is preserved.
-- See 20260810120000_break_inclusive_fulltime_day.sql for the policy this
-- mirrors, and src/features/hr/employment-type.ts for the TS mirror.
--
-- ── PART 2: overtime, soft-removed ─────────────────────────────────────────
-- No new rows are written to overtime_sessions: transition_overtime_if_due()
-- becomes a no-op, finish_current_session() no longer closes overtime, and
-- payroll_report() no longer runs the 1.5x overtime calculation phase.
-- NOTHING is dropped — overtime_sessions, its columns, its rejection reasons,
-- the pay helpers and every historical row stay intact and queryable. The UI is
-- gated off via `overtime` in src/config/mvp-scope.ts.
-- =========================================================================

-- =========================================================================
-- 1. check_out_type — how a session was closed
-- =========================================================================
-- NULL on every historical row (unknown/pre-feature); set on every close from
-- now on. Kept nullable rather than defaulted so "we don't know" stays
-- distinguishable from "the employee clicked Finish".
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_out_type') THEN
    CREATE TYPE public.check_out_type AS ENUM ('manual', 'auto');
  END IF;
END $$;

ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS check_out_type public.check_out_type;

COMMENT ON COLUMN public.work_sessions.check_out_type IS
  'How the session was closed: manual = the employee pressed Finish, auto = the '
  'scheduled sweep closed it at the daily target. NULL on rows predating this column.';

-- =========================================================================
-- 2. Multiple sessions per day
-- =========================================================================
-- An auto-finished employee can start a fresh session the same day, so
-- (user_id, work_date) is no longer unique. The invariant that actually matters
-- — never two OPEN sessions at once — moves to a partial unique index, which
-- also makes start_work_session's guard race-proof instead of advisory.
DO $$
DECLARE
  _con text;
BEGIN
  SELECT conname INTO _con
    FROM pg_constraint
   WHERE conrelid = 'public.work_sessions'::regclass
     AND contype = 'u'
     AND pg_get_constraintdef(oid) ILIKE '%(user_id, work_date)%';
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.work_sessions DROP CONSTRAINT %I', _con);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS work_sessions_one_open_per_user_idx
  ON public.work_sessions (user_id)
  WHERE session_status IN ('working', 'on_break');

-- =========================================================================
-- 3. Target-progress helpers (employment-type policy in one place)
-- =========================================================================
-- Target minutes + break credit seconds for an employee, by user_id. Falls back
-- to the company default when there is no employee row / employment type.
CREATE OR REPLACE FUNCTION public.session_day_target(
  _uid uuid, OUT target_minutes int, OUT break_credit_secs int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _settings public.company_settings%ROWTYPE;
BEGIN
  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT CASE WHEN et.slug = 'part-time' THEN 240 ELSE _settings.expected_work_minutes END,
         CASE WHEN et.slug = 'part-time' THEN 0 ELSE _settings.max_break_minutes * 60 END
    INTO target_minutes, break_credit_secs
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.user_id = _uid;
  IF target_minutes IS NULL THEN
    target_minutes := _settings.expected_work_minutes;
    break_credit_secs := _settings.max_break_minutes * 60;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.session_day_target(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.session_day_target(uuid) TO authenticated;

-- The instant day progress first reaches _target_secs, or NULL if not yet.
-- Body is the break-aware walk introduced by the break-credit migration, renamed
-- off "overtime_" now that it drives auto-finish. `overtime_threshold_ts` is
-- deliberately left in place (unused) so historical tooling still resolves.
CREATE OR REPLACE FUNCTION public.session_target_threshold_ts(
  _session public.work_sessions, _target_secs int, _break_credit_secs int
) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _remaining numeric := _target_secs;
  _credit numeric := GREATEST(COALESCE(_break_credit_secs, 0), 0);
  _cursor timestamptz := _session.started_at;
  _seg numeric;
  _credited numeric;
  _break_end timestamptz;
  _b record;
BEGIN
  IF _session.started_at IS NULL THEN RETURN NULL; END IF;
  FOR _b IN
    SELECT started_at, ended_at FROM public.work_session_breaks
    WHERE session_id = _session.id ORDER BY started_at
  LOOP
    _seg := EXTRACT(EPOCH FROM (_b.started_at - _cursor));  -- working seconds before this break
    IF _seg >= _remaining THEN
      RETURN _cursor + make_interval(secs => _remaining);
    END IF;
    _remaining := _remaining - _seg;

    -- The break itself advances the day only while allowance remains.
    _break_end := COALESCE(_b.ended_at, now());
    _credited := LEAST(GREATEST(EXTRACT(EPOCH FROM (_break_end - _b.started_at)), 0), _credit);
    IF _credited >= _remaining THEN
      RETURN _b.started_at + make_interval(secs => _remaining);
    END IF;
    _remaining := _remaining - _credited;
    _credit := _credit - _credited;

    IF _b.ended_at IS NULL THEN
      RETURN NULL;  -- still on break (allowance spent), target not yet reached
    END IF;
    _cursor := _b.ended_at;
  END LOOP;

  _seg := EXTRACT(EPOCH FROM (now() - _cursor));
  IF _seg >= _remaining THEN
    RETURN _cursor + make_interval(secs => _remaining);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.session_target_threshold_ts(public.work_sessions, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.session_target_threshold_ts(public.work_sessions, int, int)
  TO authenticated;

-- =========================================================================
-- 4. start_work_session — a second session per day is now allowed
-- =========================================================================
-- Only the FIRST session of a work_date carries the day's lateness: a top-up
-- session started at 19:00 is not "10 hours late", and its short length must not
-- restate the day as a half day. Subsequent sessions open at late_minutes = 0
-- and attendance_status 'in_progress' → 'on_time' (see finish_work_session).
CREATE OR REPLACE FUNCTION public.start_work_session(
  _device text DEFAULT NULL,
  _browser text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _location text DEFAULT NULL
) RETURNS public.work_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _settings public.company_settings%ROWTYPE;
  _today date;
  _now timestamptz := now();
  _late int := 0;
  _is_first boolean;
  _row public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000';
  END IF;

  -- Guard: an overnight session started yesterday may still be open. Block a
  -- new one regardless of date so the employee finishes the open one first.
  IF EXISTS (
    SELECT 1 FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
  ) THEN
    RAISE EXCEPTION 'You already have an open work session';
  END IF;

  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  _today := (_now AT TIME ZONE _settings.timezone)::date;

  _is_first := NOT EXISTS (
    SELECT 1 FROM public.work_sessions WHERE user_id = _uid AND work_date = _today
  );

  IF _is_first THEN
    _late := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
      (_now AT TIME ZONE _settings.timezone)
      - (_today + _settings.work_start_time)
    )) / 60)::int);
  END IF;

  INSERT INTO public.work_sessions (
    user_id, work_date, started_at, session_status, attendance_status,
    late_minutes, timezone, device, browser, ip, location
  ) VALUES (
    _uid, _today, _now, 'working',
    CASE WHEN _is_first AND _late > _settings.grace_period_minutes
         THEN 'late'::public.attendance_status
         ELSE 'on_time'::public.attendance_status END,
    _late, _settings.timezone, _device, _browser, _ip, _location
  )
  RETURNING * INTO _row;

  RETURN _row;
EXCEPTION WHEN unique_violation THEN
  -- Only the partial "one open session" index can fire here now.
  RAISE EXCEPTION 'You already have an open work session' USING ERRCODE='23505';
END;
$$;
REVOKE ALL ON FUNCTION public.start_work_session(text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_work_session(text,text,text,text) TO authenticated;

-- =========================================================================
-- 5. finish_work_session — records a MANUAL checkout, never accrues overtime
-- =========================================================================
-- overtime_seconds is now pinned to 0 on every new close: overtime is removed as
-- a product concept, so time past the target on a top-up session is plain logged
-- regular time at the normal rate. Historical rows keep whatever they stored.
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
  _day_secs int := 0;
  _expected_minutes int;
  _break_credit int;
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

  SELECT t.target_minutes, t.break_credit_secs
    INTO _expected_minutes, _break_credit
    FROM public.session_day_target(_uid) t;

  IF _session.session_status = 'on_break' THEN
    UPDATE public.work_session_breaks
      SET ended_at = _now,
          duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (_now - started_at))::int)
    WHERE session_id = _session.id AND ended_at IS NULL;
  END IF;

  SELECT COALESCE(SUM(duration_seconds), 0) INTO _break_secs
    FROM public.work_session_breaks WHERE session_id = _session.id;

  _total_secs := GREATEST(0, EXTRACT(EPOCH FROM (_now - _session.started_at))::int);
  _work_secs := GREATEST(_total_secs - _break_secs, 0);
  _day_secs := _work_secs + LEAST(_break_secs, _break_credit);

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
    WHEN _is_first AND _day_secs < (_expected_minutes * 60) / 2
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
-- 6. auto_finish_session_if_due — the replacement for the overtime split
-- =========================================================================
-- Closes the caller's open session at the exact instant it reached the daily
-- target. Idempotent (a no-op once nothing is open or the target is unreached)
-- and accepts an explicit uid so the pg_cron sweep, which has no auth.uid(), can
-- drive it per employee.
--
-- Only the day's FIRST session auto-finishes. Once a day has an auto-finished
-- session, the target is spent: a re-check-in that same day accrues regular time
-- until the employee closes it themselves.
--
-- Because the threshold is derived from real timestamps, a sweep running minutes
-- late still writes the true crossing instant — the cadence affects when the row
-- changes, never what finished_at says.
CREATE OR REPLACE FUNCTION public.auto_finish_session_if_due(_uid uuid DEFAULT auth.uid())
RETURNS public.work_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session public.work_sessions%ROWTYPE;
  _settings public.company_settings%ROWTYPE;
  _target_minutes int;
  _break_credit int;
  _target_secs int;
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
  SELECT t.target_minutes, t.break_credit_secs
    INTO _target_minutes, _break_credit
    FROM public.session_day_target(_uid) t;
  _target_secs := _target_minutes * 60;

  _threshold := public.session_target_threshold_ts(_session, _target_secs, _break_credit);
  IF _threshold IS NULL THEN RETURN NULL; END IF;  -- target not reached yet

  -- A break still running at the threshold belongs to the day being closed; end
  -- it at the same instant so the two rows agree.
  UPDATE public.work_session_breaks
     SET ended_at = _threshold,
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (_threshold - started_at))::int)
   WHERE session_id = _session.id AND ended_at IS NULL AND started_at < _threshold;

  -- Break time before the split counts (a straddling break contributes only its
  -- earlier part). Breaks starting after the split cannot exist — the session was
  -- open until now, and anything later is discarded with the close.
  SELECT COALESCE(SUM(
           GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at, _threshold), _threshold)
                                           - started_at)))
         ), 0)::int
    INTO _break_secs
    FROM public.work_session_breaks
   WHERE session_id = _session.id AND started_at < _threshold;

  -- working_seconds must stay the real worked figure (payroll reads it), so
  -- derive it rather than assume it equals the target.
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
-- 7. finish_current_session — one session kind left to close
-- =========================================================================
-- Keeps the { kind, session } jsonb shape so any client build still in flight
-- keeps working; `kind` is now always 'regular'. The auto-finish catch-up runs
-- first so pressing Finish a moment past the target still records the target
-- instant and check_out_type = 'auto', exactly as the sweep would have.
CREATE OR REPLACE FUNCTION public.finish_current_session()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _auto public.work_sessions%ROWTYPE;
  _ws public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;

  SELECT * INTO _auto FROM public.auto_finish_session_if_due(_uid);
  IF _auto.id IS NOT NULL THEN
    RETURN jsonb_build_object('kind', 'regular', 'session', to_jsonb(_auto));
  END IF;

  _ws := public.finish_work_session();
  RETURN jsonb_build_object('kind', 'regular', 'session', to_jsonb(_ws));
END;
$$;
REVOKE ALL ON FUNCTION public.finish_current_session() FROM public;
GRANT EXECUTE ON FUNCTION public.finish_current_session() TO authenticated;

-- =========================================================================
-- 8. transition_overtime_if_due — retired, kept callable
-- =========================================================================
-- Superseded by auto_finish_session_if_due. Left with its signature intact and a
-- no-op body so a cached client bundle calling it neither errors nor writes a new
-- overtime_sessions row. Existing overtime rows are untouched.
CREATE OR REPLACE FUNCTION public.transition_overtime_if_due(_uid uuid DEFAULT auth.uid())
RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_overtime_if_due(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.transition_overtime_if_due(uuid) TO authenticated;

-- =========================================================================
-- 9. pg_cron sweep — every 10 minutes, tab-independent
-- =========================================================================
-- Sessions must close even when nobody has the app open, so this — not any
-- client timer — is the mechanism. A 10-minute cadence is enough precision
-- because finished_at is back-dated to the true threshold instant.
CREATE OR REPLACE FUNCTION public.job_auto_finish_sessions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.auto_finish_session_if_due(t.user_id)
  FROM (
    SELECT DISTINCT user_id FROM public.work_sessions
    WHERE session_status IN ('working','on_break')
  ) t;
END;
$$;
REVOKE ALL ON FUNCTION public.job_auto_finish_sessions() FROM public;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spartaflow-overtime-auto-transition') THEN
    PERFORM cron.unschedule('spartaflow-overtime-auto-transition');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spartaflow-auto-finish-sessions') THEN
    PERFORM cron.unschedule('spartaflow-auto-finish-sessions');
  END IF;
END $$;

SELECT cron.schedule(
  'spartaflow-auto-finish-sessions',
  '*/10 * * * *',
  $$SELECT public.job_auto_finish_sessions();$$
);

-- =========================================================================
-- 10. payroll_report — the overtime calculation phase is gone
-- =========================================================================
-- The pipeline is now three phases: pay rates → manager exceptions (short /
-- missed hours) → month-end .xlsx export. The `ot_agg` CTE and its
-- `_overtime_pay_line` (1.5x hourly-equivalent) calls are removed rather than
-- left running to produce zeros, so no approved overtime is priced any more.
--
-- The `payroll_line` composite type keeps its overtime fields — dropping them
-- would break stored payslip_corrections rows and every consumer — but they are
-- now constant zeros and total_pay = base_pay. `_overtime_pay_line`,
-- `overtime_pay_report` and the overtime_sessions data all remain available for
-- historical queries.
CREATE OR REPLACE FUNCTION public.payroll_report(_from date, _to date)
RETURNS SETOF public.payroll_line
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _daily_hours numeric;
  _horizon     date;
BEGIN
  PERFORM public._require_payroll_view();
  SELECT expected_work_minutes / 60.0 INTO _daily_hours
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
  work_agg AS (
    -- SUM across every session of a day, so a post-auto-finish top-up session
    -- accrues as ordinary worked time at the ordinary rate.
    SELECT b.employee_id, COALESCE(SUM(ws.working_seconds), 0)::numeric AS worked_seconds
    FROM emp_base b
    LEFT JOIN public.work_sessions ws
      ON ws.user_id = b.user_id AND ws.work_date BETWEEN _from AND _to
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
