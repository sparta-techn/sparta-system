-- =========================================================================
-- SpartaFlow — Month-end payroll report (Phase 4): single source of truth
--
-- ONE server-side function, `payroll_report(_from, _to)`, that produces every
-- pay figure for the month-end export. Deterministic given the stored
-- attendance / exception / overtime data, so re-running a CLOSED month is
-- byte-for-byte identical (idempotent). For the current, in-progress month the
-- absence horizon is LEAST(_to, today), so it is a live snapshot that only
-- counts elapsed days — never future days as absences.
--
-- Confirmed rules:
--   * Full-time base is HOUR-based and prorated:
--       hourly_base = monthly_salary / (W × daily_hours)
--       base = hourly_base × min(worked_h + paid_excused_h, expected_h)
--       W = working days in the month; expected_h = E × daily_hours;
--       E = employee's expected working days in range (on/after hire_date,
--       on/before end_date, up to the absence horizon).
--   * Part-time base = hourly_rate × (worked_h + paid_excused_h).
--   * Overtime pay is the Phase-2 approved-session calc, kept SEPARATE.
--   * Unpaid days (absence, or unpaid exception) reduce base by exclusion and
--     are reported explicitly — never netted against overtime or anything else.
--
-- Gated to payroll.view (service_role / null-uid allowed, for a headless run).
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_line') THEN
    CREATE TYPE public.payroll_line AS (
      employee_id             uuid,
      employee_name           text,
      employment_type         text,
      currency                text,
      monthly_salary          numeric,
      hourly_rate             numeric,
      working_days            int,      -- W: company working days in the month
      expected_days           int,      -- E: this employee's expected working days in range
      present_days            int,      -- expected days with a work session
      absence_days            int,      -- expected days, no session, no exception (unpaid)
      expected_hours          numeric,  -- E × daily_hours (full-time only)
      worked_hours            numeric,  -- regular hours actually worked in range
      paid_exception_count    int,
      unpaid_exception_count  int,
      paid_exception_hours    numeric,
      unpaid_exception_hours  numeric,
      base_pay                numeric,
      overtime_hours          numeric,  -- approved overtime only
      overtime_pay            numeric,  -- approved overtime only
      overtime_pending_count  int,
      overtime_rejected_count int,
      total_pay               numeric,
      has_pay_data            boolean   -- false when no rate is configured
    );
  END IF;
END $$;

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
  -- Absence horizon: never treat future days as absences.
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
    -- Include anyone not offboarded and not hired after the period. A NULL
    -- hire_date means "employed for the whole range" (COALESCE'd to _from below).
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
  ot_agg AS (
    SELECT
      b.employee_id,
      COALESCE(SUM(
        EXTRACT(EPOCH FROM (s.end_time - s.start_time))
      ) FILTER (WHERE s.status = 'approved' AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL),
      0)::numeric AS approved_seconds,
      COALESCE(SUM((public._overtime_pay_line(s.id)).amount)
        FILTER (WHERE s.status = 'approved'), 0)::numeric AS ot_pay,
      count(s.id) FILTER (WHERE s.status = 'pending')  AS pending_cnt,
      count(s.id) FILTER (WHERE s.status = 'rejected') AS rejected_cnt
    FROM emp_base b
    LEFT JOIN public.overtime_sessions s
      ON s.employee_id = b.employee_id AND s.work_date BETWEEN _from AND _to
    GROUP BY b.employee_id
  ),
  calc AS (
    SELECT
      b.*,
      d.expected_days, d.present_days, d.absence_days,
      -- Hours are rounded to 2 dp here and the SAME rounded values drive base
      -- pay, so every figure on the sheet reproduces the total by hand.
      round(wa.worked_seconds / 3600.0, 2) AS worked_hours,
      ea.paid_cnt, ea.unpaid_cnt,
      round(ea.paid_min / 60.0, 2) AS paid_exc_hours,
      round(ea.unpaid_min / 60.0, 2) AS unpaid_exc_hours,
      round(oa.approved_seconds / 3600.0, 2) AS ot_hours,
      oa.ot_pay, oa.pending_cnt, oa.rejected_cnt,
      (b.slug = 'part-time' OR (b.hourly_rate IS NOT NULL AND b.monthly_salary IS NULL)) AS is_pt,
      (d.expected_days * _daily_hours) AS expected_hours
    FROM emp_base b
    JOIN day_agg  d  ON d.employee_id  = b.employee_id
    JOIN work_agg wa ON wa.employee_id = b.employee_id
    JOIN exc_agg  ea ON ea.employee_id = b.employee_id
    JOIN ot_agg   oa ON oa.employee_id = b.employee_id
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
    round(c.ot_hours, 2),
    round(c.ot_pay, 2),
    c.pending_cnt::int,
    c.rejected_cnt::int,
    round(base.base_pay + c.ot_pay, 2),
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
