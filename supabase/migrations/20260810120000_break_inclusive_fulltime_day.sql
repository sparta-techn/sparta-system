-- =========================================================================
-- SpartaFlow Attendance — the break allowance sits INSIDE the full-time day
-- =========================================================================
-- Until now every employment type was measured on pure working time: a
-- full-timer had to log 8h of work, so taking the 1h break allowance meant 9h on
-- the clock. The policy is the opposite: a full-time day is 8h *on the clock* —
-- 7h worked plus the 1h break — while part-time is 4h of actual work with no
-- break limit at all.
--
-- Encoded as one number per employment type, the "break credit":
--   * full-time (and any unknown type) → company_settings.max_break_minutes
--     seconds of break count toward the target; break beyond the allowance does
--     not (otherwise a 3h lunch would "finish" the day).
--   * part-time → 0. Breaks are unlimited and simply push their finish time
--     out until 4h of real work is done.
--
-- Day progress = worked_seconds + LEAST(break_seconds, break_credit), and that
-- progress — not raw worked time — drives the target, the half-day check and the
-- automatic overtime split. Stored columns keep their meaning: working_seconds
-- stays actual worked time (payroll reads it), break_seconds stays the real
-- break total.
--
-- Mirrored in TypeScript by `src/features/hr/employment-type.ts`
-- (creditedBreakSeconds / dayProgressSeconds) and `src/services/attendance/rules.ts`.
-- =========================================================================

-- =========================================================================
-- Break-aware split instant — now advances during a *credited* break
-- =========================================================================
-- The exact timestamp at which cumulative DAY PROGRESS since started_at first
-- reaches _target_secs, or NULL if not reached yet. Progress runs at real time
-- while working, and also while on break for as long as _break_credit_secs of
-- allowance is left; once the allowance is spent, break time freezes progress.
-- With _break_credit_secs = 0 (part-time) this is exactly the previous
-- working-time-only walk.
--
-- Still independent of WHEN it is evaluated: a sweep firing a minute late
-- returns the real crossing instant (back-dated), so overnight shifts stay
-- attributed correctly.
--
-- Dropped and recreated rather than replaced: the arity changes, and keeping the
-- old 2-arg version alongside a defaulted 3-arg one would make calls ambiguous.
DROP FUNCTION IF EXISTS public.overtime_threshold_ts(public.work_sessions, int);

CREATE OR REPLACE FUNCTION public.overtime_threshold_ts(
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
REVOKE ALL ON FUNCTION public.overtime_threshold_ts(public.work_sessions, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_threshold_ts(public.work_sessions, int, int) TO authenticated;

-- =========================================================================
-- Finish: measure the day as worked + credited break
-- =========================================================================
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
  _overtime int := 0;
  _expected_minutes int;
  -- Break seconds that count toward the target for THIS employee.
  _break_credit int;
  _status public.attendance_status;
  _row public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session'; END IF;

  -- Part-time: 4h of real work, no break credit. Everyone else: the company day
  -- with the break allowance counted inside it.
  SELECT CASE WHEN et.slug = 'part-time' THEN 240 ELSE _settings.expected_work_minutes END,
         CASE WHEN et.slug = 'part-time' THEN 0 ELSE _settings.max_break_minutes * 60 END
    INTO _expected_minutes, _break_credit
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.user_id = _uid;
  IF _expected_minutes IS NULL THEN
    _expected_minutes := _settings.expected_work_minutes;
    _break_credit := _settings.max_break_minutes * 60;
  END IF;

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
  _overtime := GREATEST(_day_secs - (_expected_minutes * 60), 0);

  _status := CASE
    WHEN _session.late_minutes > _settings.grace_period_minutes THEN 'late'::public.attendance_status
    WHEN _day_secs < (_expected_minutes * 60) / 2 THEN 'half_day'::public.attendance_status
    ELSE 'on_time'::public.attendance_status
  END;

  UPDATE public.work_sessions
    SET finished_at = _now,
        session_status = 'finished',
        attendance_status = _status,
        working_seconds = _work_secs,
        break_seconds = _break_secs,
        overtime_seconds = _overtime
  WHERE id = _session.id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_work_session() FROM public;
GRANT EXECUTE ON FUNCTION public.finish_work_session() TO authenticated;

-- =========================================================================
-- Auto-transition: same rule, and it can now fire mid-break
-- =========================================================================
-- A full-timer whose remaining day is covered by their leftover break allowance
-- crosses the target while still on break, so the split can land inside a break
-- interval. That open break is closed at the split instant (it belongs to the
-- regular day) before the overtime session opens.
CREATE OR REPLACE FUNCTION public.transition_overtime_if_due(_uid uuid DEFAULT auth.uid())
RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session public.work_sessions%ROWTYPE;
  _settings public.company_settings%ROWTYPE;
  _emp uuid;
  _target_minutes int;
  _break_credit int;
  _target_secs int;
  _threshold timestamptz;
  _break_secs int := 0;
  _work_secs int := 0;
  _ot public.overtime_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;  -- nothing open (already transitioned / not started)

  _emp := (SELECT id FROM public.employees WHERE user_id = _uid);
  IF _emp IS NULL THEN RETURN NULL; END IF;  -- no employee record → cannot own overtime

  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT CASE WHEN et.slug = 'part-time' THEN 240 ELSE _settings.expected_work_minutes END,
         CASE WHEN et.slug = 'part-time' THEN 0 ELSE _settings.max_break_minutes * 60 END
    INTO _target_minutes, _break_credit
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.id = _emp;
  IF _target_minutes IS NULL THEN
    _target_minutes := _settings.expected_work_minutes;
    _break_credit := _settings.max_break_minutes * 60;
  END IF;
  _target_secs := _target_minutes * 60;

  _threshold := public.overtime_threshold_ts(_session, _target_secs, _break_credit);
  IF _threshold IS NULL THEN RETURN NULL; END IF;  -- target not reached yet

  -- Close a break still running at the split: the part before the threshold
  -- belongs to the regular day, and the regular session is about to finish.
  UPDATE public.work_session_breaks
     SET ended_at = _threshold,
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (_threshold - started_at))::int)
   WHERE session_id = _session.id AND ended_at IS NULL AND started_at < _threshold;

  -- Break time falling before the split counts toward the regular day (a break
  -- that straddles the instant contributes only its earlier part).
  SELECT COALESCE(SUM(
           GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at, _threshold), _threshold)
                                           - started_at)))
         ), 0)::int
    INTO _break_secs
    FROM public.work_session_breaks
   WHERE session_id = _session.id AND started_at < _threshold;

  -- Worked time at the split = elapsed minus the break inside it. Day progress
  -- is exactly _target_secs by construction, but working_seconds must stay the
  -- real worked figure (payroll reads it), so derive it rather than assume.
  _work_secs := GREATEST(0, EXTRACT(EPOCH FROM (_threshold - _session.started_at))::int - _break_secs);

  UPDATE public.work_sessions
     SET finished_at = _threshold,
         session_status = 'finished',
         attendance_status = CASE
           WHEN _session.late_minutes > _settings.grace_period_minutes
             THEN 'late'::public.attendance_status
           ELSE 'on_time'::public.attendance_status END,
         working_seconds = _work_secs,
         break_seconds = _break_secs,
         overtime_seconds = 0
   WHERE id = _session.id;

  -- Open overtime AT the same instant, attributed to the day the shift STARTED
  -- (_session.work_date) — never current_work_date(), so an overnight crossing
  -- stays on the start day. Clock into a waiting manager request if present.
  UPDATE public.overtime_sessions
     SET start_time = _threshold, started_by_employee = true, updated_by = _uid
   WHERE id = (
     SELECT id FROM public.overtime_sessions
      WHERE employee_id = _emp AND work_date = _session.work_date
        AND status = 'pending' AND start_time IS NULL AND end_time IS NULL
      ORDER BY created_at LIMIT 1
   )
  RETURNING * INTO _ot;
  IF FOUND THEN RETURN _ot; END IF;

  INSERT INTO public.overtime_sessions (
    employee_id, work_date, start_time, status, started_by_employee, notes
  ) VALUES (
    _emp, _session.work_date, _threshold, 'pending', true, 'Auto-started at target hours'
  )
  RETURNING * INTO _ot;
  RETURN _ot;
EXCEPTION WHEN unique_violation THEN
  -- A concurrent caller already opened the overtime row; return the open one.
  SELECT * INTO _ot FROM public.overtime_sessions
    WHERE employee_id = _emp AND end_time IS NULL AND status <> 'rejected'
    ORDER BY start_time DESC NULLS LAST LIMIT 1;
  RETURN _ot;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_overtime_if_due(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.transition_overtime_if_due(uuid) TO authenticated;
