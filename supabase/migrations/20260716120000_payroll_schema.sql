-- =========================================================================
-- SpartaFlow — Payroll schema (Phase 1: schema only, NO calculation logic)
-- Adds:
--   1. payroll.view / payroll.manage permissions (mirrors permissions.ts)
--   2. company_settings.default_currency  (org-wide default, editable)
--   3. employee_compensation  — sensitive pay rates, 1:1 with employees
--   4. attendance_exceptions  — manager-logged excused/adjusted time
--   5. overtime_sessions      — start/finish + approval workflow, all types
--
-- Pay rates are deliberately NOT columns on public.employees: that table's
-- `employees_read_directory` policy exposes every row to all authenticated
-- users, and RLS is row-level (not column-level), so pay data must live in a
-- separately-gated table — same pattern as `employee_profiles`.
--
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- 1. PERMISSIONS  (SQL mirror of src/features/auth/permissions.ts)
--    Keep in sync with permissions.ts + types.ts (guarded by permissions.test.ts).
-- =========================================================================
INSERT INTO public.permissions (key, category, description) VALUES
  ('payroll.view',   'payroll', 'View employee pay rates and payroll data'),
  ('payroll.manage', 'payroll', 'Edit employee pay rates and payroll data')
ON CONFLICT (key) DO NOTHING;

-- Grant to owner / admin / hr only (not managers, not the employee).
INSERT INTO public.role_permissions (role, permission_id)
SELECT v.role::public.app_role, p.id
FROM (
  VALUES
    ('owner','payroll.view'), ('owner','payroll.manage'),
    ('admin','payroll.view'), ('admin','payroll.manage'),
    ('hr','payroll.view'),    ('hr','payroll.manage')
) AS v(role, perm_key)
JOIN public.permissions p ON p.key = v.perm_key
ON CONFLICT (role, permission_id) DO NOTHING;

-- =========================================================================
-- 2. COMPANY DEFAULT CURRENCY  (org-wide default; UI pre-fills employee currency)
-- =========================================================================
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'EGP'
    CONSTRAINT company_settings_default_currency_iso CHECK (char_length(default_currency) = 3);

-- =========================================================================
-- 3. EMPLOYEE_COMPENSATION  (sensitive pay rates, 1:1 with employees)
--    hourly_rate    → part-time (hourly) employees
--    monthly_salary → full-time (salaried) employees
--    currency       → per-employee, defaults from company_settings.default_currency
--    Which field is "expected" for which employment_type is a Phase-2 UI/logic
--    concern; the schema keeps both nullable so either can be set.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  hourly_rate    NUMERIC(12,2) CHECK (hourly_rate    IS NULL OR hourly_rate    >= 0),
  monthly_salary NUMERIC(12,2) CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
  currency       TEXT NOT NULL DEFAULT 'EGP' CHECK (char_length(currency) = 3),
  -- audit fields
  created_by     UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_compensation_employee ON public.employee_compensation(employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT ALL ON public.employee_compensation TO service_role;
ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_employee_compensation ON public.employee_compensation;
CREATE TRIGGER set_updated_at_employee_compensation BEFORE UPDATE ON public.employee_compensation
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Read: ONLY holders of payroll.view (owner / admin / hr). The employee themselves
-- and managers WITHOUT the permission cannot see pay data.
DROP POLICY IF EXISTS "employee_compensation_payroll_read" ON public.employee_compensation;
CREATE POLICY "employee_compensation_payroll_read" ON public.employee_compensation
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'payroll.view'));

-- Write: ONLY holders of payroll.manage (owner / admin / hr).
DROP POLICY IF EXISTS "employee_compensation_payroll_write" ON public.employee_compensation;
CREATE POLICY "employee_compensation_payroll_write" ON public.employee_compensation
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'payroll.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'payroll.manage'));

-- =========================================================================
-- 4. ATTENDANCE_EXCEPTIONS  (manager-logged excused / adjusted time)
--    adjustment_minutes: signed. Positive = credited/excused time toward the
--    day; negative = deducted. (Minutes chosen to match the attendance module,
--    which works in minutes/seconds throughout.)
--    paid: whether the adjustment counts as paid time.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exception_date     DATE NOT NULL,
  adjustment_minutes INT  NOT NULL DEFAULT 0,
  paid               BOOLEAN NOT NULL DEFAULT true,
  reason             TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  -- audit fields
  created_by         UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_employee ON public.attendance_exceptions(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_date     ON public.attendance_exceptions(exception_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_emp_date ON public.attendance_exceptions(employee_id, exception_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_exceptions TO authenticated;
GRANT ALL ON public.attendance_exceptions TO service_role;
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_attendance_exceptions ON public.attendance_exceptions;
CREATE TRIGGER set_updated_at_attendance_exceptions BEFORE UPDATE ON public.attendance_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Read: the employee can view their own; managers / HR / admin / owner see all.
DROP POLICY IF EXISTS "attendance_exceptions_read" ON public.attendance_exceptions;
CREATE POLICY "attendance_exceptions_read" ON public.attendance_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(),
         ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[])
  );

-- Write (create / edit / delete): ONLY managers / HR / admin / owner.
-- The employee can view but never edit their own exceptions.
DROP POLICY IF EXISTS "attendance_exceptions_manager_write" ON public.attendance_exceptions;
CREATE POLICY "attendance_exceptions_manager_write" ON public.attendance_exceptions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(),
           ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(),
           ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[]));

-- =========================================================================
-- 5. OVERTIME_SESSIONS  (separate from work_sessions; start/finish + approval)
--    Usable by ALL employment types (confirmed). Pay semantics per type are a
--    Phase-2 calculation concern, not a schema restriction.
--    start_time / end_time nullable to mirror the attendance start/finish
--    pattern (a manager may pre-assign a session before it is started).
-- =========================================================================
CREATE TYPE public.overtime_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.overtime_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date           DATE NOT NULL,
  start_time          TIMESTAMPTZ,                    -- set when started; null on a pre-assigned session
  end_time            TIMESTAMPTZ,                    -- null until finished
  status              public.overtime_status NOT NULL DEFAULT 'pending',
  requested_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- set if a manager assigned it
  started_by_employee BOOLEAN NOT NULL DEFAULT false, -- true if the employee self-started
  approved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  notes               TEXT,
  -- audit fields
  created_by          UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT overtime_sessions_times_valid
    CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time),
  CONSTRAINT overtime_sessions_rejection_reason
    CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_overtime_sessions_employee ON public.overtime_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_sessions_date     ON public.overtime_sessions(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_sessions_status   ON public.overtime_sessions(status);
-- At most one unfinished (open) overtime session per employee at a time.
CREATE UNIQUE INDEX IF NOT EXISTS overtime_sessions_one_open_per_employee
  ON public.overtime_sessions(employee_id)
  WHERE end_time IS NULL AND status <> 'rejected';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_sessions TO authenticated;
GRANT ALL ON public.overtime_sessions TO service_role;
ALTER TABLE public.overtime_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_overtime_sessions ON public.overtime_sessions;
CREATE TRIGGER set_updated_at_overtime_sessions BEFORE UPDATE ON public.overtime_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Read: the employee sees their own; managers / HR / admin / owner see all.
DROP POLICY IF EXISTS "overtime_sessions_read" ON public.overtime_sessions;
CREATE POLICY "overtime_sessions_read" ON public.overtime_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(),
         ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[])
  );

-- Create: the employee may self-start their OWN session; managers / HR / admin /
-- owner may assign a session for anyone.
DROP POLICY IF EXISTS "overtime_sessions_insert" ON public.overtime_sessions;
CREATE POLICY "overtime_sessions_insert" ON public.overtime_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(),
         ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[])
  );

-- Update: the employee may update their OWN session (e.g. to finish it); managers
-- / HR / admin / owner may approve / reject / edit any.
-- NOTE (Phase 2): RLS cannot enforce column-level rules, so this policy alone
-- would let an employee set status='approved' on their own row. The intended
-- hardening — mirroring the work_sessions state machine — is to route
-- start/finish/approve/reject through SECURITY DEFINER functions and then
-- REVOKE direct UPDATE from the employee path. Left as direct RLS for Phase 1.
DROP POLICY IF EXISTS "overtime_sessions_update" ON public.overtime_sessions;
CREATE POLICY "overtime_sessions_update" ON public.overtime_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(),
         ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[])
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(),
         ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[])
  );

-- Delete: managers / HR / admin / owner only (employees cannot delete records).
DROP POLICY IF EXISTS "overtime_sessions_manager_delete" ON public.overtime_sessions;
CREATE POLICY "overtime_sessions_manager_delete" ON public.overtime_sessions
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(),
           ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[]));

-- =========================================================================
-- Realtime (matches work_sessions: live status for the attendance UI)
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.overtime_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_exceptions;
