-- =========================================================================
-- SpartaFlow Hub — HR module (1/2): reference data & permissions
-- Tables: employment_types, permissions, role_permissions
-- Conventions reused from the existing auth/attendance migrations:
--   * uuid PKs (gen_random_uuid())  * created_at/updated_at audit fields
--   * BEFORE-UPDATE trigger public.tg_set_updated_at()
--   * RLS enabled on every table     * authorization via public.has_any_role()
--   * grants to authenticated/service_role only — never anon
-- Frontend is NOT modified. Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- EMPLOYMENT TYPES  (reference / lookup — Full-time, Part-time, …)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.employment_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  -- audit fields
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employment_types_active ON public.employment_types(is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employment_types TO authenticated;
GRANT ALL ON public.employment_types TO service_role;
ALTER TABLE public.employment_types ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_employment_types ON public.employment_types;
CREATE TRIGGER set_updated_at_employment_types BEFORE UPDATE ON public.employment_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "employment_types_read_authenticated" ON public.employment_types;
CREATE POLICY "employment_types_read_authenticated" ON public.employment_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employment_types_admin_write" ON public.employment_types;
CREATE POLICY "employment_types_admin_write" ON public.employment_types
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['hr','super_admin','owner']::public.app_role[]));

-- =========================================================================
-- PERMISSIONS  (catalog of permission keys — DB source of truth for the
-- frontend permissions.ts matrix)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,            -- e.g. 'users:read'
  description TEXT,
  category    TEXT,                            -- grouping for UI (users, reports, …)
  -- audit fields
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_permissions ON public.permissions;
CREATE TRIGGER set_updated_at_permissions BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "permissions_read_authenticated" ON public.permissions;
CREATE POLICY "permissions_read_authenticated" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- Only owner / super_admin may edit the permission catalog (mirrors roles_admin_write)
DROP POLICY IF EXISTS "permissions_admin_write" ON public.permissions;
CREATE POLICY "permissions_admin_write" ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]));

-- =========================================================================
-- ROLE_PERMISSIONS  (app_role  ↔  permissions join)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          public.app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  -- audit fields
  granted_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role       ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_read_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_read_authenticated" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Only owner / super_admin may change role→permission mappings
DROP POLICY IF EXISTS "role_permissions_admin_write" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','owner']::public.app_role[]));

-- =========================================================================
-- HELPER: has_permission(uid, key)  — SECURITY DEFINER, mirrors has_role setup
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE ur.user_id = _user_id
       AND p.key = _permission
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

-- =========================================================================
-- SEED: permission catalog (the 7 keys used by features/auth/permissions.ts)
-- =========================================================================
INSERT INTO public.permissions (key, category, description) VALUES
  ('users:read',    'users',   'View the employee directory and profiles'),
  ('users:write',   'users',   'Create and edit employees / profiles'),
  ('roles:write',   'access',  'Grant and revoke roles'),
  ('hr:access',     'access',  'Access the HR module'),
  ('owner:access',  'access',  'Access owner-only areas'),
  ('reports:read',  'reports', 'View reports and analytics'),
  ('reports:write', 'reports', 'Create and submit reports')
ON CONFLICT (key) DO NOTHING;

-- =========================================================================
-- SEED: role → permission matrix (exact mirror of permissions.ts)
-- =========================================================================
INSERT INTO public.role_permissions (role, permission_id)
SELECT v.role::public.app_role, p.id
FROM (
  VALUES
    -- owner: all
    ('owner','users:read'), ('owner','users:write'), ('owner','roles:write'),
    ('owner','hr:access'), ('owner','owner:access'),
    ('owner','reports:read'), ('owner','reports:write'),
    -- super_admin: all except owner:access
    ('super_admin','users:read'), ('super_admin','users:write'),
    ('super_admin','roles:write'), ('super_admin','hr:access'),
    ('super_admin','reports:read'), ('super_admin','reports:write'),
    -- hr
    ('hr','users:read'), ('hr','users:write'),
    ('hr','hr:access'), ('hr','reports:read'),
    -- project_manager
    ('project_manager','users:read'),
    ('project_manager','reports:read'), ('project_manager','reports:write'),
    -- team_lead
    ('team_lead','users:read'),
    ('team_lead','reports:read'), ('team_lead','reports:write'),
    -- employee
    ('employee','users:read'), ('employee','reports:write'),
    -- viewer
    ('viewer','users:read'), ('viewer','reports:read')
) AS v(role, perm_key)
JOIN public.permissions p ON p.key = v.perm_key
ON CONFLICT (role, permission_id) DO NOTHING;

-- =========================================================================
-- SEED: default employment types
-- =========================================================================
INSERT INTO public.employment_types (name, slug, description) VALUES
  ('Full-time',  'full-time',  'Permanent full-time employee'),
  ('Part-time',  'part-time',  'Permanent part-time employee'),
  ('Contractor', 'contractor', 'Fixed-term or freelance contractor'),
  ('Intern',     'intern',     'Internship / trainee')
ON CONFLICT (name) DO NOTHING;
