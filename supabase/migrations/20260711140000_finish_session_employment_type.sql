-- =========================================================================
-- SpartaFlow Attendance — part-time aware finish_work_session
-- =========================================================================
-- Employment type now drives the expected working day: part-time employees
-- target 4h (240 min) instead of the company-wide default
-- (`company_settings.expected_work_minutes`, seeded 480). This makes the stored
-- overtime and the finished-day classification (half_day / on_time) correct for
-- part-timers, matching the live UI which branches on the same rule.
--
-- Only `finish_work_session` changes. `start_work_session` is untouched: the
-- late/grace calculation is based on the scheduled start time, which is the same
-- for every employment type.
--
-- Redefines the function in place (CREATE OR REPLACE); the signature, grants and
-- return type are unchanged.
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
  _overtime int := 0;
  -- Effective target for THIS employee (part-time = 240, else company default).
  _expected_minutes int;
  _status public.attendance_status;
  _row public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND work_date = public.current_work_date() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session'; END IF;
  IF _session.session_status = 'finished' THEN RAISE EXCEPTION 'Work already finished'; END IF;
  IF _session.session_status = 'not_started' THEN RAISE EXCEPTION 'Cannot finish a session that never started'; END IF;

  -- Resolve the employee's target: part-time works a 4h day; anything else (or
  -- no employment type / no employee record) keeps the company-wide default.
  SELECT CASE
           WHEN et.slug = 'part-time' THEN 240
           ELSE _settings.expected_work_minutes
         END
    INTO _expected_minutes
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.user_id = _uid;
  IF _expected_minutes IS NULL THEN
    _expected_minutes := _settings.expected_work_minutes;
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
  _overtime := GREATEST(_work_secs - (_expected_minutes * 60), 0);

  _status := CASE
    WHEN _session.late_minutes > _settings.grace_period_minutes THEN 'late'::public.attendance_status
    WHEN _work_secs < (_expected_minutes * 60) / 2 THEN 'half_day'::public.attendance_status
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
