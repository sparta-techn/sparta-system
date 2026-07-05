-- =========================================================================
-- SpartaFlow Hub — Attendance & Work Session module
-- Tables: company_settings (singleton), holidays, work_sessions, work_session_breaks
-- State transitions go through SECURITY DEFINER functions (atomic + validated).
-- =========================================================================

-- Enums --------------------------------------------------------------------
CREATE TYPE public.work_session_status AS ENUM (
  'not_started', 'working', 'on_break', 'finished'
);

CREATE TYPE public.attendance_status AS ENUM (
  'in_progress', 'on_time', 'late', 'absent', 'weekend', 'holiday', 'half_day', 'leave'
);

-- Company settings (singleton row) ----------------------------------------
CREATE TABLE public.company_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  work_start_time time NOT NULL DEFAULT '09:00',
  grace_period_minutes int NOT NULL DEFAULT 60,
  expected_work_minutes int NOT NULL DEFAULT 480,
  max_break_minutes int NOT NULL DEFAULT 60,
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  weekend_days int[] NOT NULL DEFAULT ARRAY[5,6]::int[], -- 0=Sun..6=Sat
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_read_authenticated ON public.company_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_admin_write ON public.company_settings
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'super_admin'::app_role, 'hr'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'super_admin'::app_role, 'hr'::app_role]));

CREATE TRIGGER company_settings_set_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.company_settings (id) VALUES (true);

-- Holidays -----------------------------------------------------------------
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  is_full_day boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX holidays_date_idx ON public.holidays (holiday_date DESC);

GRANT SELECT ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY holidays_read_authenticated ON public.holidays
  FOR SELECT TO authenticated USING (true);
CREATE POLICY holidays_admin_write ON public.holidays
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'super_admin'::app_role, 'hr'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'super_admin'::app_role, 'hr'::app_role]));

CREATE TRIGGER holidays_set_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Work sessions ------------------------------------------------------------
CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  session_status public.work_session_status NOT NULL DEFAULT 'not_started',
  attendance_status public.attendance_status NOT NULL DEFAULT 'in_progress',
  late_minutes int NOT NULL DEFAULT 0,
  working_seconds int NOT NULL DEFAULT 0,
  break_seconds int NOT NULL DEFAULT 0,
  overtime_seconds int NOT NULL DEFAULT 0,
  timezone text,
  device text,
  browser text,
  ip text,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
CREATE INDEX work_sessions_user_date_idx ON public.work_sessions (user_id, work_date DESC);
CREATE INDEX work_sessions_date_idx ON public.work_sessions (work_date DESC);
CREATE INDEX work_sessions_active_idx ON public.work_sessions (session_status)
  WHERE session_status IN ('working','on_break');

GRANT SELECT ON public.work_sessions TO authenticated;
GRANT ALL ON public.work_sessions TO service_role;

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Read: self always; managers/HR/owner see all
CREATE POLICY sessions_read_self ON public.work_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sessions_read_managers ON public.work_sessions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'super_admin'::app_role, 'hr'::app_role, 'project_manager'::app_role, 'team_lead'::app_role]));

-- No direct INSERT / UPDATE / DELETE — all state changes go through SECURITY DEFINER fns below.

CREATE TRIGGER work_sessions_set_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Work session breaks ------------------------------------------------------
CREATE TABLE public.work_session_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- denormalized for cheap RLS
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX breaks_session_idx ON public.work_session_breaks (session_id);
CREATE INDEX breaks_user_open_idx ON public.work_session_breaks (user_id)
  WHERE ended_at IS NULL;

GRANT SELECT ON public.work_session_breaks TO authenticated;
GRANT ALL ON public.work_session_breaks TO service_role;

ALTER TABLE public.work_session_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY breaks_read_self ON public.work_session_breaks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY breaks_read_managers ON public.work_session_breaks
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'super_admin'::app_role, 'hr'::app_role, 'project_manager'::app_role, 'team_lead'::app_role]));

-- =========================================================================
-- State machine helpers
-- =========================================================================

-- Current "work date" anchored to company timezone
CREATE OR REPLACE FUNCTION public.current_work_date()
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (now() AT TIME ZONE (SELECT timezone FROM public.company_settings WHERE id = true))::date;
$$;
REVOKE ALL ON FUNCTION public.current_work_date() FROM public;
GRANT EXECUTE ON FUNCTION public.current_work_date() TO authenticated;

-- Start work
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

-- Start break
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
    WHERE user_id = _uid AND work_date = public.current_work_date() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active work session'; END IF;
  IF _session.session_status = 'finished' THEN RAISE EXCEPTION 'Work already finished'; END IF;
  IF _session.session_status = 'on_break' THEN RAISE EXCEPTION 'Already on break'; END IF;
  IF _session.session_status = 'not_started' THEN RAISE EXCEPTION 'Start work before taking a break'; END IF;

  INSERT INTO public.work_session_breaks (session_id, user_id, started_at)
  VALUES (_session.id, _uid, now())
  RETURNING * INTO _brk;

  UPDATE public.work_sessions SET session_status = 'on_break' WHERE id = _session.id;
  RETURN _brk;
END;
$$;
REVOKE ALL ON FUNCTION public.start_break() FROM public;
GRANT EXECUTE ON FUNCTION public.start_break() TO authenticated;

-- End break (resume work)
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
    WHERE user_id = _uid AND work_date = public.current_work_date() FOR UPDATE;
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

-- Finish work
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
  _overtime := GREATEST(_work_secs - (_settings.expected_work_minutes * 60), 0);

  _status := CASE
    WHEN _session.late_minutes > _settings.grace_period_minutes THEN 'late'::public.attendance_status
    WHEN _work_secs < (_settings.expected_work_minutes * 60) / 2 THEN 'half_day'::public.attendance_status
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

-- Realtime publication -----------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_session_breaks;
