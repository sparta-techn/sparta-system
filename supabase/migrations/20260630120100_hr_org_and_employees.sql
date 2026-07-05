-- =========================================================================
-- SpartaFlow Hub — HR module (2/2): org structure & employee records
-- Tables: positions (new), employees (new), employee_profiles (new),
--         departments (EXTEND existing), teams (EXTEND existing)
-- departments & teams already exist (auth migration); we extend them
-- idempotently with leadership + audit columns rather than recreate.
-- Depends on 20260630120000_hr_reference_and_permissions.sql (employment_types).
-- Frontend is NOT modified. Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- EXTEND DEPARTMENTS  (add lead + audit columns; FK to employees added later)
-- =========================================================================
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS lead_id     UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure admins can actually exercise the existing dept_admin_write policy.
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;

-- =========================================================================
-- EXTEND TEAMS  (add lead + audit columns; FK to employees added later)
-- =========================================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS lead_id     UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;

-- =========================================================================
-- POSITIONS  (structured job-title catalog, scoped to a department)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  level         TEXT,                                  -- junior / mid / senior / staff / lead
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  archived_at   TIMESTAMPTZ,
  -- audit fields
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, title)
);
CREATE INDEX IF NOT EXISTS idx_positions_department ON public.positions(department_id);
CREATE INDEX IF NOT EXISTS idx_positions_active     ON public.positions(is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_positions ON public.positions;
CREATE TRIGGER set_updated_at_positions BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "positions_read_authenticated" ON public.positions;
CREATE POLICY "positions_read_authenticated" ON public.positions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "positions_admin_write" ON public.positions;
CREATE POLICY "positions_admin_write" ON public.positions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

-- =========================================================================
-- EMPLOYEES  (core HR employment record, 1:1 with a profile / auth user)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code      TEXT UNIQUE,                       -- e.g. EMP-014
  department_id      UUID REFERENCES public.departments(id)      ON DELETE SET NULL,
  team_id            UUID REFERENCES public.teams(id)            ON DELETE SET NULL,
  position_id        UUID REFERENCES public.positions(id)        ON DELETE SET NULL,
  employment_type_id UUID REFERENCES public.employment_types(id) ON DELETE SET NULL,
  manager_id         UUID REFERENCES public.employees(id)        ON DELETE SET NULL,  -- reporting line
  status             public.employee_status NOT NULL DEFAULT 'invited',
  work_location      TEXT,
  work_mode          TEXT,                              -- remote / hybrid / onsite
  hire_date          DATE,
  end_date           DATE,
  -- audit fields
  created_by         UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employees_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id),
  CONSTRAINT employees_dates_valid      CHECK (end_date IS NULL OR hire_date IS NULL OR end_date >= hire_date)
);
CREATE INDEX IF NOT EXISTS idx_employees_user        ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department  ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_team        ON public.employees(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_position    ON public.employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_emp_type    ON public.employees(employment_type_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager     ON public.employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status      ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_hire_date   ON public.employees(hire_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_employees ON public.employees;
CREATE TRIGGER set_updated_at_employees BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Read: any authenticated user can read the directory (excluding offboarded,
-- except your own row); Write: HR / super_admin / owner only.
DROP POLICY IF EXISTS "employees_read_directory" ON public.employees;
CREATE POLICY "employees_read_directory" ON public.employees
  FOR SELECT TO authenticated
  USING (status <> 'offboarded' OR user_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

DROP POLICY IF EXISTS "employees_admin_write" ON public.employees;
CREATE POLICY "employees_admin_write" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

-- =========================================================================
-- EMPLOYEE_PROFILES  (sensitive personal/HR detail, 1:1 with employees)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  birth_date               DATE,
  phone                    TEXT,
  personal_email           TEXT,
  address_line             TEXT,
  city                     TEXT,
  country                  TEXT,
  nationality              TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  bio                      TEXT,
  -- audit fields
  created_by               UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_employee ON public.employee_profiles(employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_profiles TO authenticated;
GRANT ALL ON public.employee_profiles TO service_role;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_employee_profiles ON public.employee_profiles;
CREATE TRIGGER set_updated_at_employee_profiles BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Read/write: the employee themselves, or HR / super_admin / owner.
DROP POLICY IF EXISTS "employee_profiles_self_or_admin_read" ON public.employee_profiles;
CREATE POLICY "employee_profiles_self_or_admin_read" ON public.employee_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[])
  );

DROP POLICY IF EXISTS "employee_profiles_self_or_admin_write" ON public.employee_profiles;
CREATE POLICY "employee_profiles_self_or_admin_write" ON public.employee_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[])
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
              WHERE e.id = employee_id AND e.user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[])
  );

-- =========================================================================
-- DEFERRED FKs: departments.lead_id / teams.lead_id → employees(id)
-- (added now that public.employees exists)
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_lead_id_fkey'
  ) THEN
    ALTER TABLE public.departments
      ADD CONSTRAINT departments_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_lead_id_fkey'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_departments_lead ON public.departments(lead_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead       ON public.teams(lead_id);

-- =========================================================================
-- GUARD: prevent manager_id reporting cycles on employees
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_employees_no_manager_cycle()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _cursor UUID := NEW.manager_id;
  _steps  INT  := 0;
BEGIN
  WHILE _cursor IS NOT NULL LOOP
    IF _cursor = NEW.id THEN
      RAISE EXCEPTION 'Manager assignment would create a reporting cycle for employee %', NEW.id;
    END IF;
    SELECT manager_id INTO _cursor FROM public.employees WHERE id = _cursor;
    _steps := _steps + 1;
    IF _steps > 64 THEN
      RAISE EXCEPTION 'Reporting chain too deep / possible cycle for employee %', NEW.id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_no_manager_cycle ON public.employees;
CREATE TRIGGER employees_no_manager_cycle
  BEFORE INSERT OR UPDATE OF manager_id ON public.employees
  FOR EACH ROW WHEN (NEW.manager_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_employees_no_manager_cycle();
