-- =========================================================================
-- SpartaFlow — Overtime flow (Phase 2): state-machine + authoritative pay calc
--
-- Builds on 20260716120000_payroll_schema.sql (overtime_sessions table).
--
-- Two halves:
--   A. State machine — all overtime_sessions writes move behind SECURITY DEFINER
--      functions (mirrors the work_sessions pattern), and direct INSERT/UPDATE/
--      DELETE are REVOKED. This closes the Phase-1 caveat where direct-RLS UPDATE
--      would have let an employee approve their own row.
--   B. Pay calculation — ONE server-side source of truth read by both the UI and
--      the Phase-4 payroll export, so they can never disagree.
--
-- Confirmed product decisions baked in here:
--   * Full-time hourly base = monthly_salary / (expected_daily_hours ×
--     working_days_in_that_month), working days per the company weekend/holiday
--     config. Overtime multiplier 1.5×.
--   * Part-time base = employee_compensation.hourly_rate. Multiplier 1.0×
--     (eligible for overtime; extra approved hours at their normal rate).
--   * Manager "request" pre-fills a pending session (no times); the employee
--     clocks INTO that row when they start overtime.
-- =========================================================================

-- =========================================================================
-- A. STATE MACHINE — lock down direct writes, drive transitions via functions
-- =========================================================================

-- Direct writes are no longer allowed; every mutation goes through the
-- SECURITY DEFINER functions below. SELECT + its read policy stay as-is.
REVOKE INSERT, UPDATE, DELETE ON public.overtime_sessions FROM authenticated;
DROP POLICY IF EXISTS "overtime_sessions_insert"         ON public.overtime_sessions;
DROP POLICY IF EXISTS "overtime_sessions_update"         ON public.overtime_sessions;
DROP POLICY IF EXISTS "overtime_sessions_manager_delete" ON public.overtime_sessions;

-- Reviewer roles that may assign / approve / reject overtime.
-- (owner, admin, hr, project_manager, team_lead — matches attendance review.)
CREATE OR REPLACE FUNCTION public.is_overtime_reviewer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_uid,
    ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[]);
$$;
REVOKE ALL ON FUNCTION public.is_overtime_reviewer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_overtime_reviewer(uuid) TO authenticated;

-- Resolve the caller's employees.id (NULL if they have no employee record).
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM public;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;

-- ── Employee: start overtime (self-start, or clock into a manager request) ──
-- Requires today's regular work session to be FINISHED. If a pending
-- manager-requested session exists for today with no start_time, the employee
-- clocks into it (preserving requested_by); otherwise a fresh self-started row
-- is created. The partial-unique index guarantees at most one open session.
CREATE OR REPLACE FUNCTION public.start_overtime_session(_notes text DEFAULT NULL)
RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid  uuid := auth.uid();
  _emp  uuid;
  _date date := public.current_work_date();
  _work public.work_sessions%ROWTYPE;
  _row  public.overtime_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  _emp := public.current_employee_id();
  IF _emp IS NULL THEN RAISE EXCEPTION 'No employee record for this user'; END IF;

  -- Gate: the regular work session for today must already be finished.
  SELECT * INTO _work FROM public.work_sessions
    WHERE user_id = _uid AND work_date = _date;
  IF NOT FOUND OR _work.session_status <> 'finished' THEN
    RAISE EXCEPTION 'Finish your regular work session before starting overtime';
  END IF;

  -- Clock into an open manager-requested session for today, if one exists.
  UPDATE public.overtime_sessions
     SET start_time = now(), updated_by = _uid
   WHERE id = (
     SELECT id FROM public.overtime_sessions
      WHERE employee_id = _emp AND work_date = _date
        AND status = 'pending' AND start_time IS NULL AND end_time IS NULL
      ORDER BY created_at LIMIT 1
   )
  RETURNING * INTO _row;
  IF FOUND THEN
    RETURN _row;
  END IF;

  -- Otherwise self-start a fresh session.
  INSERT INTO public.overtime_sessions (
    employee_id, work_date, start_time, status, started_by_employee, notes
  ) VALUES (
    _emp, _date, now(), 'pending', true, _notes
  )
  RETURNING * INTO _row;
  RETURN _row;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'You already have an open overtime session' USING ERRCODE='23505';
END;
$$;
REVOKE ALL ON FUNCTION public.start_overtime_session(text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_overtime_session(text) TO authenticated;

-- ── Employee: finish overtime (close the open session; stays pending) ──
CREATE OR REPLACE FUNCTION public.finish_overtime_session()
RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _emp uuid;
  _row public.overtime_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  _emp := public.current_employee_id();
  IF _emp IS NULL THEN RAISE EXCEPTION 'No employee record for this user'; END IF;

  SELECT * INTO _row FROM public.overtime_sessions
    WHERE employee_id = _emp AND end_time IS NULL AND status <> 'rejected'
    ORDER BY start_time DESC NULLS LAST LIMIT 1
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No open overtime session to finish'; END IF;
  IF _row.start_time IS NULL THEN
    RAISE EXCEPTION 'Start the overtime session before finishing it';
  END IF;

  UPDATE public.overtime_sessions
     SET end_time = now(), updated_by = _uid
   WHERE id = _row.id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_overtime_session() FROM public;
GRANT EXECUTE ON FUNCTION public.finish_overtime_session() TO authenticated;

-- ── Manager: proactively request an overtime session for an employee/date ──
CREATE OR REPLACE FUNCTION public.request_overtime_session(
  _employee_id uuid, _work_date date, _notes text DEFAULT NULL
) RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.overtime_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.is_overtime_reviewer(_uid) THEN
    RAISE EXCEPTION 'Not permitted to request overtime' USING ERRCODE='42501';
  END IF;
  IF _employee_id IS NULL OR _work_date IS NULL THEN
    RAISE EXCEPTION 'employee and date are required';
  END IF;

  INSERT INTO public.overtime_sessions (
    employee_id, work_date, status, requested_by, started_by_employee, notes
  ) VALUES (
    _employee_id, _work_date, 'pending', _uid, false, _notes
  )
  RETURNING * INTO _row;
  RETURN _row;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'That employee already has an open overtime session' USING ERRCODE='23505';
END;
$$;
REVOKE ALL ON FUNCTION public.request_overtime_session(uuid, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_overtime_session(uuid, date, text) TO authenticated;

-- ── Manager: approve a logged (finished) overtime session ──
CREATE OR REPLACE FUNCTION public.approve_overtime_session(
  _session_id uuid, _note text DEFAULT NULL
) RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.overtime_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.is_overtime_reviewer(_uid) THEN
    RAISE EXCEPTION 'Not permitted to approve overtime' USING ERRCODE='42501';
  END IF;

  SELECT * INTO _row FROM public.overtime_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Overtime session not found'; END IF;
  IF _row.start_time IS NULL OR _row.end_time IS NULL THEN
    RAISE EXCEPTION 'Cannot approve an overtime session that has not been logged (started and finished)';
  END IF;

  UPDATE public.overtime_sessions
     SET status = 'approved', approved_by = _uid, approved_at = now(),
         rejection_reason = NULL, updated_by = _uid,
         notes = CASE WHEN _note IS NULL OR btrim(_note) = '' THEN notes
                      ELSE COALESCE(notes || E'\n', '') || 'Approver: ' || _note END
   WHERE id = _session_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_overtime_session(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_overtime_session(uuid, text) TO authenticated;

-- ── Manager: reject an overtime session (reason required) ──
CREATE OR REPLACE FUNCTION public.reject_overtime_session(
  _session_id uuid, _reason text
) RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.overtime_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.is_overtime_reviewer(_uid) THEN
    RAISE EXCEPTION 'Not permitted to reject overtime' USING ERRCODE='42501';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT * INTO _row FROM public.overtime_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Overtime session not found'; END IF;

  UPDATE public.overtime_sessions
     SET status = 'rejected', approved_by = _uid, approved_at = now(),
         rejection_reason = _reason, updated_by = _uid
   WHERE id = _session_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_overtime_session(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reject_overtime_session(uuid, text) TO authenticated;

-- =========================================================================
-- B. PAY CALCULATION — single source of truth
-- =========================================================================

-- ── Building block 1: working days in the calendar month of `_ref` ──
-- Weekdays minus full-day holidays, per company weekend_days (0=Sun..6=Sat).
CREATE OR REPLACE FUNCTION public.working_days_in_month(_ref date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
    FROM generate_series(
           date_trunc('month', _ref)::date,
           (date_trunc('month', _ref) + interval '1 month - 1 day')::date,
           interval '1 day'
         ) AS d
   WHERE EXTRACT(DOW FROM d)::int NOT IN (
           SELECT unnest(weekend_days) FROM public.company_settings WHERE id = true
         )
     AND d::date NOT IN (
           SELECT holiday_date FROM public.holidays WHERE is_full_day
         );
$$;
REVOKE ALL ON FUNCTION public.working_days_in_month(date) FROM public;
GRANT EXECUTE ON FUNCTION public.working_days_in_month(date) TO authenticated;

-- ── Building block 2: full-time hourly base from a monthly salary ──
-- Pure w.r.t. employee data (salary is an input); reads only company_settings +
-- holidays (both authenticated-readable), so it needs no payroll gate and is
-- directly callable for verification/worked-examples.
CREATE OR REPLACE FUNCTION public.overtime_full_time_hourly_rate(
  _monthly_salary numeric, _ref date
) RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _daily_hours numeric;
  _work_days   int;
BEGIN
  IF _monthly_salary IS NULL THEN RETURN NULL; END IF;
  SELECT expected_work_minutes / 60.0 INTO _daily_hours
    FROM public.company_settings WHERE id = true;
  _work_days := public.working_days_in_month(_ref);
  IF _daily_hours IS NULL OR _daily_hours = 0 OR _work_days = 0 THEN RETURN NULL; END IF;
  RETURN _monthly_salary / (_daily_hours * _work_days);
END;
$$;
REVOKE ALL ON FUNCTION public.overtime_full_time_hourly_rate(numeric, date) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_full_time_hourly_rate(numeric, date) TO authenticated;

-- ── Building block 3: pure pay arithmetic (hours × base × multiplier) ──
-- IMMUTABLE and fully input-driven — the testable core of the formula.
CREATE OR REPLACE FUNCTION public.overtime_pay_amount(
  _worked_seconds int, _base_hourly numeric, _multiplier numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round(
    (GREATEST(COALESCE(_worked_seconds, 0), 0) / 3600.0)
    * COALESCE(_base_hourly, 0)
    * COALESCE(_multiplier, 0),
    2
  );
$$;
REVOKE ALL ON FUNCTION public.overtime_pay_amount(int, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_pay_amount(int, numeric, numeric) TO authenticated;

-- Composite line returned by the pay functions the UI + export read.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'overtime_pay_line') THEN
    CREATE TYPE public.overtime_pay_line AS (
      session_id     uuid,
      employee_id    uuid,
      work_date      date,
      worked_seconds int,
      base_hourly    numeric,
      multiplier     numeric,
      amount         numeric,
      currency       text,
      status         public.overtime_status
    );
  END IF;
END $$;

-- Internal (un-gated) line computer. NOT granted to anyone directly; only called
-- from the gated wrappers below, which run as definer.
CREATE OR REPLACE FUNCTION public._overtime_pay_line(_session_id uuid)
RETURNS public.overtime_pay_line
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s      public.overtime_sessions%ROWTYPE;
  _slug   text;
  _comp   public.employee_compensation%ROWTYPE;
  _secs   int;
  _base   numeric;
  _mult   numeric;
  _line   public.overtime_pay_line;
BEGIN
  SELECT * INTO _s FROM public.overtime_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT et.slug INTO _slug
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.id = _s.employee_id;
  SELECT * INTO _comp FROM public.employee_compensation WHERE employee_id = _s.employee_id;

  -- Worked seconds: end − start (overtime has no break tracking in v1).
  _secs := CASE
    WHEN _s.start_time IS NOT NULL AND _s.end_time IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (_s.end_time - _s.start_time))::int)
    ELSE 0 END;

  -- Base rate + multiplier branch on employment type, with a populated-field
  -- fallback for non full/part-time types.
  IF _slug = 'part-time' OR (_comp.hourly_rate IS NOT NULL AND _comp.monthly_salary IS NULL) THEN
    _base := _comp.hourly_rate;
    _mult := 1.0;
  ELSE
    _base := public.overtime_full_time_hourly_rate(_comp.monthly_salary, _s.work_date);
    _mult := 1.5;
  END IF;

  _line.session_id     := _s.id;
  _line.employee_id    := _s.employee_id;
  _line.work_date      := _s.work_date;
  _line.worked_seconds := _secs;
  _line.base_hourly    := _base;
  _line.multiplier     := _mult;
  -- Only APPROVED sessions ever carry a payable amount.
  _line.amount := CASE WHEN _s.status = 'approved'
                       THEN public.overtime_pay_amount(_secs, _base, _mult)
                       ELSE 0 END;
  _line.currency := COALESCE(_comp.currency, 'EGP');
  _line.status   := _s.status;
  RETURN _line;
END;
$$;
REVOKE ALL ON FUNCTION public._overtime_pay_line(uuid) FROM public;

-- Payroll gate: allow trusted backend (service_role, auth.uid() IS NULL, e.g. the
-- Phase-4 export) OR a user holding payroll.view. Employees do NOT see pay
-- numbers (consistent with Phase-1: comp is hidden from the employee).
CREATE OR REPLACE FUNCTION public._require_payroll_view()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_permission(auth.uid(), 'payroll.view') THEN
    RAISE EXCEPTION 'payroll.view permission required' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._require_payroll_view() FROM public;

-- Public: pay for a single session (gated).
CREATE OR REPLACE FUNCTION public.overtime_session_pay(_session_id uuid)
RETURNS public.overtime_pay_line
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_payroll_view();
  RETURN public._overtime_pay_line(_session_id);
END;
$$;
REVOKE ALL ON FUNCTION public.overtime_session_pay(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_session_pay(uuid) TO authenticated;

-- Public: approved overtime pay lines for an employee across [_from, _to] (gated).
-- The single call both the UI pay summary and the Phase-4 export read.
CREATE OR REPLACE FUNCTION public.overtime_pay_report(
  _employee_id uuid, _from date, _to date
) RETURNS SETOF public.overtime_pay_line
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_payroll_view();
  RETURN QUERY
    SELECT (public._overtime_pay_line(s.id)).*
      FROM public.overtime_sessions s
     WHERE s.employee_id = _employee_id
       AND s.status = 'approved'
       AND s.work_date BETWEEN _from AND _to
     ORDER BY s.work_date;
END;
$$;
REVOKE ALL ON FUNCTION public.overtime_pay_report(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_pay_report(uuid, date, date) TO authenticated;
