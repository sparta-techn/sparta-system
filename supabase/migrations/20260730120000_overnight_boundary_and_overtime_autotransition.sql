-- =========================================================================
-- SpartaFlow Attendance — Overnight boundary fix + automatic overtime
-- transition. Two related fixes that touch the same session state machine.
--
-- ── FIX 1: Overnight session date-boundary bug ────────────────────────────
-- `work_date` is (correctly) fixed at creation in `start_work_session`. The bug
-- was that finish/break re-derived "today" via current_work_date() and matched
-- the row on `work_date = current_work_date()`. A session started at 23:00
-- carries work_date = yesterday; after local midnight the lookup finds nothing
-- and the employee gets "No active session" and cannot finish/break.
--
-- Every mutating lookup now finds the OPEN session by status
-- (session_status IN ('working','on_break')) regardless of its work_date. The
-- session stays permanently attributed to the calendar day it started on, and
-- all durations use its real started_at / finished_at timestamps — which
-- already spanned midnight fine; only the row *lookup* was broken.
-- start_work_session additionally refuses to open a second session while one is
-- already open on any date (prevents an overnight duplicate).
--
-- ── FIX 2: Auto-transition regular → overtime at target hours ──────────────
-- When cumulative WORKED time (excluding breaks) reaches the employee's target
-- (part-time 240 min, else company_settings.expected_work_minutes) the regular
-- session is closed at the exact threshold instant and a PENDING overtime
-- session is opened at that same instant — no employee click. Overtime still
-- requires manager approval (unchanged). Detection is defense-in-depth:
--   * transition_overtime_if_due(uid) — one idempotent SECURITY DEFINER RPC.
--   * job_auto_overtime_transition() — pg_cron sweep every minute (authoritative
--     even when the employee's tab is backgrounded/closed).
--   * finish_current_session() calls it lazily so a manual finish also catches up.
-- The exact split instant is computed from real timestamps (overtime_threshold_ts,
-- a break-aware walk) so a late sweep still back-dates the split correctly — this
-- is what makes the overnight + auto-transition case (e.g. part-time 23:00 →
-- 03:00) attribute to the right day and the right instant.
--
-- Redefinitions use CREATE OR REPLACE; signatures / grants are unchanged.
-- =========================================================================

-- =========================================================================
-- FIX 1 — look sessions up by OPEN status, not by today's date
-- =========================================================================

-- Start work: keep work_date fixed at creation; refuse a second open session.
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

  _late := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
    (_now AT TIME ZONE _settings.timezone)
    - (_today + _settings.work_start_time)
  )) / 60)::int);

  INSERT INTO public.work_sessions (
    user_id, work_date, started_at, session_status, attendance_status,
    late_minutes, timezone, device, browser, ip, location
  ) VALUES (
    _uid, _today, _now, 'working',
    CASE WHEN _late > _settings.grace_period_minutes THEN 'late'::public.attendance_status
         ELSE 'on_time'::public.attendance_status END,
    _late, _settings.timezone, _device, _browser, _ip, _location
  )
  RETURNING * INTO _row;

  RETURN _row;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Work session already started today' USING ERRCODE='23505';
END;
$$;
REVOKE ALL ON FUNCTION public.start_work_session(text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_work_session(text,text,text,text) TO authenticated;

-- Start break: operate on the open session (any date).
CREATE OR REPLACE FUNCTION public.start_break()
RETURNS public.work_session_breaks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _session public.work_sessions%ROWTYPE;
  _brk public.work_session_breaks%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active work session'; END IF;
  IF _session.session_status = 'on_break' THEN RAISE EXCEPTION 'Already on break'; END IF;

  INSERT INTO public.work_session_breaks (session_id, user_id, started_at)
  VALUES (_session.id, _uid, now())
  RETURNING * INTO _brk;

  UPDATE public.work_sessions SET session_status = 'on_break' WHERE id = _session.id;
  RETURN _brk;
END;
$$;
REVOKE ALL ON FUNCTION public.start_break() FROM public;
GRANT EXECUTE ON FUNCTION public.start_break() TO authenticated;

-- End break: operate on the open (on_break) session (any date).
CREATE OR REPLACE FUNCTION public.end_break()
RETURNS public.work_session_breaks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _session public.work_sessions%ROWTYPE;
  _brk public.work_session_breaks%ROWTYPE;
  _now timestamptz := now();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session'; END IF;
  IF _session.session_status <> 'on_break' THEN RAISE EXCEPTION 'Not currently on break'; END IF;

  UPDATE public.work_session_breaks
    SET ended_at = _now,
        duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (_now - started_at))::int)
  WHERE session_id = _session.id AND ended_at IS NULL
  RETURNING * INTO _brk;

  UPDATE public.work_sessions SET session_status = 'working' WHERE id = _session.id;
  RETURN _brk;
END;
$$;
REVOKE ALL ON FUNCTION public.end_break() FROM public;
GRANT EXECUTE ON FUNCTION public.end_break() TO authenticated;

-- Finish work: close the open regular session (any date). Part-time target
-- logic unchanged; only the lookup moves from work_date to open-status.
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
  _expected_minutes int;
  _status public.attendance_status;
  _row public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO _settings FROM public.company_settings WHERE id = true;
  SELECT * INTO _session FROM public.work_sessions
    WHERE user_id = _uid AND session_status IN ('working','on_break')
    ORDER BY started_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session'; END IF;

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

-- =========================================================================
-- FIX 2 — automatic transition into overtime at the target threshold
-- =========================================================================

-- ── Break-aware split instant ──────────────────────────────────────────────
-- The exact timestamp at which cumulative WORKING time (breaks excluded) since
-- started_at first reaches _target_secs, or NULL if not reached yet. Walks the
-- breaks in order so the answer is independent of WHEN it is evaluated: a sweep
-- firing a minute late still returns the real crossing instant (back-dated),
-- and a break taken after the crossing does not push the instant forward. If
-- the employee is currently mid-break and the target has not yet been reached,
-- returns NULL (working time is frozen during a break).
CREATE OR REPLACE FUNCTION public.overtime_threshold_ts(
  _session public.work_sessions, _target_secs int
) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _remaining numeric := _target_secs;
  _cursor timestamptz := _session.started_at;
  _seg numeric;
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
    IF _b.ended_at IS NULL THEN
      RETURN NULL;  -- currently on break, target not yet reached
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
REVOKE ALL ON FUNCTION public.overtime_threshold_ts(public.work_sessions, int) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_threshold_ts(public.work_sessions, int) TO authenticated;

-- ── The idempotent transition ──────────────────────────────────────────────
-- If the given user's open regular session has crossed its target, close it at
-- the exact threshold instant and open a PENDING overtime session at that same
-- instant (clocking into a manager-requested row for the same day if one is
-- waiting, else self-starting one). Idempotent: a no-op once the regular
-- session is finished or before the target is reached. Accepts an explicit uid
-- so the pg_cron sweep (which has no auth.uid()) can drive it per employee.
CREATE OR REPLACE FUNCTION public.transition_overtime_if_due(_uid uuid DEFAULT auth.uid())
RETURNS public.overtime_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session public.work_sessions%ROWTYPE;
  _settings public.company_settings%ROWTYPE;
  _emp uuid;
  _target_minutes int;
  _target_secs int;
  _threshold timestamptz;
  _break_secs int := 0;
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
  SELECT CASE WHEN et.slug = 'part-time' THEN 240 ELSE _settings.expected_work_minutes END
    INTO _target_minutes
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.id = _emp;
  IF _target_minutes IS NULL THEN _target_minutes := _settings.expected_work_minutes; END IF;
  _target_secs := _target_minutes * 60;

  _threshold := public.overtime_threshold_ts(_session, _target_secs);
  IF _threshold IS NULL THEN RETURN NULL; END IF;  -- target not reached yet

  -- Breaks fully completed before the split count toward the regular day.
  SELECT COALESCE(SUM(duration_seconds), 0) INTO _break_secs
    FROM public.work_session_breaks
   WHERE session_id = _session.id AND ended_at IS NOT NULL AND ended_at <= _threshold;

  -- Close the regular session AT the threshold instant (worked = exactly target).
  UPDATE public.work_sessions
     SET finished_at = _threshold,
         session_status = 'finished',
         attendance_status = CASE
           WHEN _session.late_minutes > _settings.grace_period_minutes
             THEN 'late'::public.attendance_status
           ELSE 'on_time'::public.attendance_status END,
         working_seconds = _target_secs,
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

-- ── Unified finish: close whichever session is currently open ──────────────
-- Runs the (idempotent) transition first so a manual finish right at the
-- boundary still splits correctly, then closes the open OVERTIME session if one
-- is running, otherwise the open REGULAR session. Returns a discriminated
-- result so the client knows which was closed.
CREATE OR REPLACE FUNCTION public.finish_current_session()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _emp uuid;
  _ot public.overtime_sessions%ROWTYPE;
  _ws public.work_sessions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;

  PERFORM public.transition_overtime_if_due(_uid);  -- catch up at the boundary

  _emp := (SELECT id FROM public.employees WHERE user_id = _uid);
  IF _emp IS NOT NULL THEN
    SELECT * INTO _ot FROM public.overtime_sessions
      WHERE employee_id = _emp AND start_time IS NOT NULL AND end_time IS NULL
        AND status <> 'rejected'
      ORDER BY start_time DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.overtime_sessions
         SET end_time = now(), updated_by = _uid
       WHERE id = _ot.id
      RETURNING * INTO _ot;
      RETURN jsonb_build_object('kind', 'overtime', 'session', to_jsonb(_ot));
    END IF;
  END IF;

  _ws := public.finish_work_session();  -- open-status based (Fix 1)
  RETURN jsonb_build_object('kind', 'regular', 'session', to_jsonb(_ws));
END;
$$;
REVOKE ALL ON FUNCTION public.finish_current_session() FROM public;
GRANT EXECUTE ON FUNCTION public.finish_current_session() TO authenticated;

-- =========================================================================
-- pg_cron sweep — the tab-independent backstop (runs every minute, UTC)
-- =========================================================================
-- Drives transition_overtime_if_due for every user with an open regular
-- session. Because the split instant is back-dated from real timestamps, a
-- once-a-minute cadence still attributes the split to the exact threshold, not
-- to when the sweep happened to run.
CREATE OR REPLACE FUNCTION public.job_auto_overtime_transition()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.transition_overtime_if_due(t.user_id)
  FROM (
    SELECT DISTINCT user_id FROM public.work_sessions
    WHERE session_status IN ('working','on_break')
  ) t;
END;
$$;
REVOKE ALL ON FUNCTION public.job_auto_overtime_transition() FROM public;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spartaflow-overtime-auto-transition') THEN
    PERFORM cron.unschedule('spartaflow-overtime-auto-transition');
  END IF;
END $$;

-- Every minute: sweep open sessions and split any that have crossed target.
SELECT cron.schedule(
  'spartaflow-overtime-auto-transition',
  '* * * * *',
  $$SELECT public.job_auto_overtime_transition();$$
);
