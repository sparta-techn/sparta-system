
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'owner',
  'super_admin',
  'hr',
  'project_manager',
  'team_lead',
  'employee',
  'viewer'
);

CREATE TYPE public.employee_status AS ENUM (
  'active',
  'invited',
  'suspended',
  'offboarded'
);

-- =========================================================
-- DEPARTMENTS
-- =========================================================
CREATE TABLE public.departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL    ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TEAMS
-- =========================================================
CREATE TABLE public.teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL    ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES (1:1 with auth.users)
-- =========================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  job_title     TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  status        public.employee_status NOT NULL DEFAULT 'invited',
  timezone      TEXT,
  locale        TEXT DEFAULT 'en',
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_department ON public.profiles(department_id);
CREATE INDEX idx_profiles_team       ON public.profiles(team_id);
CREATE INDEX idx_profiles_status     ON public.profiles(status);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER_ROLES  (separate table – never store on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  granted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS (used by every policy)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS SETOF public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- =========================================================
-- TIMESTAMP TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at_departments BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_teams BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- AUTO-PROVISION PROFILE + DEFAULT ROLE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invited_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'),
    CASE WHEN NEW.email_confirmed_at IS NULL THEN 'invited'::public.employee_status
         ELSE 'active'::public.employee_status END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Optional invited role passed via admin invite metadata
  BEGIN
    invited_role := (NEW.raw_user_meta_data ->> 'role')::public.app_role;
  EXCEPTION WHEN others THEN
    invited_role := NULL;
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(invited_role, 'employee'::public.app_role))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Flip profile to active once the user confirms their email
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
    UPDATE public.profiles
      SET status = 'active'
      WHERE id = NEW.id AND status = 'invited';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

-- =========================================================
-- RLS POLICIES
-- =========================================================
-- Departments: everyone signed in can read; HR/SuperAdmin/Owner can write
CREATE POLICY "dept_read_authenticated" ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_admin_write" ON public.departments
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

-- Teams
CREATE POLICY "team_read_authenticated" ON public.teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_admin_write" ON public.teams
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

-- Profiles: everyone signed in can see active profiles
CREATE POLICY "profile_read_directory" ON public.profiles
  FOR SELECT TO authenticated
  USING (status <> 'offboarded' OR id = auth.uid());

-- User can update *own* limited fields (display_name, avatar_url, timezone, locale)
-- We rely on column-level updates by application code; row check stays scoped.
CREATE POLICY "profile_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- HR/SuperAdmin/Owner can update any profile
CREATE POLICY "profile_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

-- User Roles: a user can read their own roles; HR/SuperAdmin/Owner can read all & write
CREATE POLICY "roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

CREATE POLICY "roles_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]));
