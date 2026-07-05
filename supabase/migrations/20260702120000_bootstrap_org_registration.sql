-- =========================================================================
-- SpartaFlow — Bootstrap, organization identity & registration gating
-- Tables: companies (org identity), workspaces (default workspace),
--         system_settings (singleton: bootstrap + public-registration flags)
-- Also hardens public.handle_new_user() so that, once the platform is
-- bootstrapped, public self-registration can be switched off (only invited
-- users may sign up) and self-signups can never self-assign a role.
--
-- Conventions reused from the existing auth/HR migrations:
--   * uuid PKs (gen_random_uuid())   * created_at/updated_at audit fields
--   * BEFORE-UPDATE trigger public.tg_set_updated_at()
--   * RLS enabled on every table      * authorization via public.has_any_role()
--   * grants to authenticated/service_role only — never anon (except the two
--     read-only status helpers, which the login screen may probe pre-auth)
-- The actual owner / company / workspace / department rows are created at
-- runtime by the bootstrap orchestrator (see src/repositories/bootstrap,
-- scripts/bootstrap.ts and docs/BOOTSTRAP.md) — this migration only provisions
-- the schema, flags and helper functions.
-- =========================================================================

-- =========================================================================
-- COMPANIES  (organization identity — the "remote software company" itself)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  legal_name       TEXT,
  timezone         TEXT NOT NULL DEFAULT 'Africa/Cairo',
  primary_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  -- audit fields
  created_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_companies ON public.companies;
CREATE TRIGGER set_updated_at_companies BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "companies_read_authenticated" ON public.companies;
CREATE POLICY "companies_read_authenticated" ON public.companies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "companies_admin_write" ON public.companies;
CREATE POLICY "companies_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]));

-- =========================================================================
-- WORKSPACES  (a company owns one or more workspaces; bootstrap makes one
-- default workspace — the top-level container the app opens into)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  -- audit fields
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspaces_company ON public.workspaces(company_id);
-- At most one default workspace per company.
CREATE UNIQUE INDEX IF NOT EXISTS uq_workspaces_one_default_per_company
  ON public.workspaces(company_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_workspaces ON public.workspaces;
CREATE TRIGGER set_updated_at_workspaces BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "workspaces_read_authenticated" ON public.workspaces;
CREATE POLICY "workspaces_read_authenticated" ON public.workspaces
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "workspaces_admin_write" ON public.workspaces;
CREATE POLICY "workspaces_admin_write" ON public.workspaces
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]));

-- =========================================================================
-- SYSTEM_SETTINGS  (singleton row — platform-wide flags)
--   is_bootstrapped              — has the one-time bootstrap completed?
--   public_registration_enabled  — may anyone self-register? (off after
--                                   bootstrap unless an operator re-enables it)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  id                          BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  is_bootstrapped             BOOLEAN NOT NULL DEFAULT false,
  public_registration_enabled BOOLEAN NOT NULL DEFAULT true,
  company_id                  UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  bootstrapped_at             TIMESTAMPTZ,
  bootstrapped_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_system_settings ON public.system_settings;
CREATE TRIGGER set_updated_at_system_settings BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "system_settings_read_authenticated" ON public.system_settings;
CREATE POLICY "system_settings_read_authenticated" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

-- Only owner / super_admin may flip platform flags from the app. The bootstrap
-- orchestrator runs with the service role and bypasses RLS entirely.
DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;
CREATE POLICY "system_settings_admin_write" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]));

-- Seed the singleton: not yet bootstrapped, public registration open (so the
-- very first owner account can be created).
INSERT INTO public.system_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- STATUS HELPERS  (SECURITY DEFINER — readable pre-auth so the login/landing
-- screen can decide whether to show a "set up your workspace" flow, and so the
-- signup trigger below can gate cheaply)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_bootstrapped()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_bootstrapped FROM public.system_settings WHERE id), false)
$$;
GRANT EXECUTE ON FUNCTION public.is_bootstrapped() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_registration_enabled()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT public_registration_enabled FROM public.system_settings WHERE id), true)
$$;
GRANT EXECUTE ON FUNCTION public.public_registration_enabled() TO anon, authenticated;

-- =========================================================================
-- HARDEN handle_new_user()  (replaces the auth-migration version)
--   1. Gate: once bootstrapped, block self-signups when public registration is
--      disabled. Admin invites set auth.users.invited_at (server-controlled,
--      not user-forgeable), so invited users are always allowed through.
--   2. Security fix: only honor an invited `role` from user metadata when the
--      row was actually created by an admin invite (invited_at IS NOT NULL).
--      Previously any self-signup could pass { role: 'owner' } and escalate.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invited_role public.app_role;
  is_invite    BOOLEAN := (NEW.invited_at IS NOT NULL);
BEGIN
  -- Registration gate — never blocks the first (pre-bootstrap) owner, and never
  -- blocks admin invites.
  IF public.is_bootstrapped()
     AND NOT public.public_registration_enabled()
     AND NOT is_invite THEN
    RAISE EXCEPTION 'Public registration is disabled. An administrator must invite you.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

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

  -- Only an admin-issued invite may carry a role; self-signups are always
  -- provisioned as the least-privileged 'employee'.
  IF is_invite THEN
    BEGIN
      invited_role := (NEW.raw_user_meta_data ->> 'role')::public.app_role;
    EXCEPTION WHEN others THEN
      invited_role := NULL;
    END;
  ELSE
    invited_role := NULL;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(invited_role, 'employee'::public.app_role))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
