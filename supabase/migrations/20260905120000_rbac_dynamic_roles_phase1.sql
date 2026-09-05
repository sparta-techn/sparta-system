-- =========================================================================
-- SpartaFlow — Dynamic roles & permissions, PHASE 1 (foundation only)
--
-- Builds the schema + permission-checking engine for admin-defined roles with
-- granular (module, action, scope) permissions. This is the eventual
-- replacement for the fixed `app_role` enum + `has_any_role()` RLS pattern.
--
-- PHASE 1 IS STRICTLY ADDITIVE:
--   * No existing RLS policy is created, dropped or altered.
--   * No existing table, column, function or enum is modified.
--   * `has_any_role()`, `public.permissions`, `public.role_permissions` and
--     `public.user_roles` are left exactly as they are and remain the live
--     authorization path until Phase 2 migrates policies over.
--
-- NAMING — why `rbac_*` and not the plain names in the spec:
--   `permissions`, `role_permissions` and `user_roles` ALREADY EXIST with
--   incompatible shapes (flat TEXT permission keys; junctions keyed by the
--   `app_role` ENUM rather than a role_id). 122 policy references and
--   `src/features/auth/permissions.ts` depend on them. The new dynamic tables
--   therefore live under an `rbac_` prefix. Phase 2 (or 3) drops the legacy
--   tables and may rename these onto the bare names.
--
-- FUNCTION OVERLOAD:
--   `public.has_permission(uuid, text)` (legacy, flat key) still exists and is
--   still used by RLS. This migration adds the 5-argument overload
--   `has_permission(uuid, text, text, text, uuid)`. Postgres resolves the two
--   unambiguously by arity — 2 args -> legacy, 4/5 args -> dynamic.
--
-- ON DELETE semantics (project convention is RESTRICT for HR-adjacent data;
-- applied wherever losing the row would silently destroy information):
--   rbac_role_permissions.role_id       -> CASCADE  (grants are OWNED by the
--       role; roles are explicitly user-deletable, and a role's grants are
--       meaningless once it is gone. Protected roles are blocked from deletion
--       by trigger, so Owner's grants can never cascade away.)
--   rbac_role_permissions.permission_id -> RESTRICT (a catalog row must never
--       be removable while any role still grants it)
--   rbac_user_roles.role_id             -> RESTRICT (deleting a role that is
--       still assigned would silently strip people's access — force the admin
--       to unassign first)
--   rbac_user_roles.user_id             -> CASCADE  (matches legacy user_roles;
--       deleting the auth user removes their assignments)
--
-- Regenerate src/integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- RBAC_PERMISSIONS — the catalog of checks the CODEBASE knows how to perform.
--
-- Seeded by developers/migrations only. This is enforced, not merely
-- documented: `authenticated` is granted SELECT and nothing else, and no
-- write policy exists, so only `service_role` / migrations can mutate it.
-- End users compose roles out of this catalog; they cannot invent entries.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      TEXT NOT NULL,   -- hr, payroll, attendance, projects, roles, …
  action      TEXT NOT NULL,   -- view, create, edit, delete, approve, export, …
  scope       TEXT NOT NULL,   -- own | team | all
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rbac_permissions_module_action_scope_key UNIQUE (module, action, scope),
  -- `scope` drives the has_permission() lattice; an unknown value would be
  -- silently unsatisfiable, so it is constrained to the three known tiers.
  CONSTRAINT rbac_permissions_scope_valid  CHECK (scope IN ('own', 'team', 'all')),
  CONSTRAINT rbac_permissions_module_slug  CHECK (module ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT rbac_permissions_action_slug  CHECK (action ~ '^[a-z][a-z0-9_]*$')
);
CREATE INDEX IF NOT EXISTS idx_rbac_permissions_module        ON public.rbac_permissions(module);
CREATE INDEX IF NOT EXISTS idx_rbac_permissions_module_action ON public.rbac_permissions(module, action);

-- SELECT only for application users: the catalog is developer-owned.
GRANT SELECT ON public.rbac_permissions TO authenticated;
GRANT ALL    ON public.rbac_permissions TO service_role;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_rbac_permissions ON public.rbac_permissions;
CREATE TRIGGER set_updated_at_rbac_permissions BEFORE UPDATE ON public.rbac_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Everyone authenticated may read the catalog (the role editor UI needs it).
-- Deliberately NO write policy — see the table comment above.
DROP POLICY IF EXISTS "rbac_permissions_read_authenticated" ON public.rbac_permissions;
CREATE POLICY "rbac_permissions_read_authenticated" ON public.rbac_permissions
  FOR SELECT TO authenticated USING (true);

-- =========================================================================
-- RBAC_ROLES — admin-defined roles. Fully CRUD-able by admins EXCEPT rows
-- with is_protected = true (see the trigger guards further down).
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rbac_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  is_protected BOOLEAN NOT NULL DEFAULT false,
  -- audit fields (docs/DB_RULES.md §3)
  created_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rbac_roles_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_rbac_roles_protected ON public.rbac_roles(is_protected);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_roles TO authenticated;
GRANT ALL ON public.rbac_roles TO service_role;
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_rbac_roles ON public.rbac_roles;
CREATE TRIGGER set_updated_at_rbac_roles BEFORE UPDATE ON public.rbac_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PHASE 1 NOTE: these policies gate the NEW tables using the EXISTING
-- has_any_role() helper. That is deliberate — the dynamic system has no users
-- assigned yet, so gating it on itself would lock everyone out. Phase 2 swaps
-- these to has_permission(auth.uid(), 'roles', …, 'all'). No existing policy
-- is touched by adding these.
DROP POLICY IF EXISTS "rbac_roles_read_authenticated" ON public.rbac_roles;
CREATE POLICY "rbac_roles_read_authenticated" ON public.rbac_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rbac_roles_admin_write" ON public.rbac_roles;
CREATE POLICY "rbac_roles_admin_write" ON public.rbac_roles
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::public.app_role[]));

-- =========================================================================
-- RBAC_ROLE_PERMISSIONS — role  ↔  permission junction
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES public.rbac_roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.rbac_permissions(id) ON DELETE RESTRICT,
  granted_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rbac_role_permissions_role_permission_key UNIQUE (role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_role       ON public.rbac_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_permission ON public.rbac_role_permissions(permission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_role_permissions TO authenticated;
GRANT ALL ON public.rbac_role_permissions TO service_role;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_role_permissions_read_authenticated" ON public.rbac_role_permissions;
CREATE POLICY "rbac_role_permissions_read_authenticated" ON public.rbac_role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rbac_role_permissions_admin_write" ON public.rbac_role_permissions;
CREATE POLICY "rbac_role_permissions_admin_write" ON public.rbac_role_permissions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::public.app_role[]));

-- =========================================================================
-- RBAC_USER_ROLES — user  ↔  role junction. Multiple roles per user are
-- supported; has_permission() UNIONs the grants across all of them.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rbac_user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.rbac_roles(id) ON DELETE RESTRICT,
  granted_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rbac_user_roles_user_role_key UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_user ON public.rbac_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_role ON public.rbac_user_roles(role_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_user_roles TO authenticated;
GRANT ALL ON public.rbac_user_roles TO service_role;
ALTER TABLE public.rbac_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_user_roles_self_read" ON public.rbac_user_roles;
CREATE POLICY "rbac_user_roles_self_read" ON public.rbac_user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['hr','admin','owner']::public.app_role[]));

DROP POLICY IF EXISTS "rbac_user_roles_admin_write" ON public.rbac_user_roles;
CREATE POLICY "rbac_user_roles_admin_write" ON public.rbac_user_roles
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::public.app_role[]));

-- =========================================================================
-- PROTECTED-ROLE SAFEGUARDS  (database-level, not application-level)
--
-- Three invariants, each enforced by a trigger so they hold against direct
-- SQL, psql, the service_role key and the Supabase table editor alike:
--
--   1. A protected role can never be DELETEd.
--   2. A protected role's `is_protected` flag and `name` can never be changed
--      (otherwise (1) is trivially bypassed by un-protecting first).
--   3. A protected role's permission grants can never be DELETEd or repointed.
--
-- Plus a fourth, which keeps "Owner has every permission" true forever:
--   4. Inserting a new row into rbac_permissions auto-grants it to every
--      protected role. Without this the Owner invariant would silently rot as
--      later migrations extend the catalog.
--
-- Limit of the mechanism: a Postgres SUPERUSER or the table owner can
-- `ALTER TABLE … DISABLE TRIGGER`. That is true of any trigger-based guard and
-- is outside the Supabase `authenticated` / `service_role` threat model.
-- =========================================================================

-- (1) block DELETE of a protected role
CREATE OR REPLACE FUNCTION public.tg_rbac_roles_block_protected_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_protected THEN
    RAISE EXCEPTION 'Role "%" is protected and cannot be deleted', OLD.name
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS rbac_roles_block_protected_delete ON public.rbac_roles;
CREATE TRIGGER rbac_roles_block_protected_delete
  BEFORE DELETE ON public.rbac_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_rbac_roles_block_protected_delete();

-- (2) block un-protecting / renaming a protected role.
-- `description` and the audit columns stay editable.
CREATE OR REPLACE FUNCTION public.tg_rbac_roles_block_protected_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_protected AND NEW.is_protected IS DISTINCT FROM OLD.is_protected THEN
    RAISE EXCEPTION 'Role "%" is protected; is_protected cannot be cleared', OLD.name
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.is_protected AND NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'Role "%" is protected and cannot be renamed', OLD.name
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rbac_roles_block_protected_update ON public.rbac_roles;
CREATE TRIGGER rbac_roles_block_protected_update
  BEFORE UPDATE ON public.rbac_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_rbac_roles_block_protected_update();

-- (3) block removing / repointing a protected role's grants
CREATE OR REPLACE FUNCTION public.tg_rbac_role_permissions_block_protected_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _protected BOOLEAN;
  _name      TEXT;
BEGIN
  SELECT r.is_protected, r.name INTO _protected, _name
    FROM public.rbac_roles r WHERE r.id = OLD.role_id;

  -- NULL means the parent role row is already gone, i.e. we are inside a
  -- CASCADE from a permitted (non-protected) role delete — let it through.
  IF COALESCE(_protected, false) THEN
    RAISE EXCEPTION 'Permissions of protected role "%" cannot be revoked', _name
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS rbac_role_permissions_block_protected_delete ON public.rbac_role_permissions;
CREATE TRIGGER rbac_role_permissions_block_protected_delete
  BEFORE DELETE ON public.rbac_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rbac_role_permissions_block_protected_delete();

CREATE OR REPLACE FUNCTION public.tg_rbac_role_permissions_block_protected_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _protected BOOLEAN;
  _name      TEXT;
BEGIN
  IF NEW.role_id IS NOT DISTINCT FROM OLD.role_id
     AND NEW.permission_id IS NOT DISTINCT FROM OLD.permission_id THEN
    RETURN NEW;  -- only audit columns changed
  END IF;

  SELECT r.is_protected, r.name INTO _protected, _name
    FROM public.rbac_roles r WHERE r.id = OLD.role_id;

  IF COALESCE(_protected, false) THEN
    RAISE EXCEPTION 'Permissions of protected role "%" cannot be reassigned', _name
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rbac_role_permissions_block_protected_update ON public.rbac_role_permissions;
CREATE TRIGGER rbac_role_permissions_block_protected_update
  BEFORE UPDATE ON public.rbac_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rbac_role_permissions_block_protected_update();

-- (4) auto-grant every newly catalogued permission to every protected role
CREATE OR REPLACE FUNCTION public.tg_rbac_permissions_grant_to_protected()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.rbac_role_permissions (role_id, permission_id)
  SELECT r.id, NEW.id FROM public.rbac_roles r WHERE r.is_protected
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rbac_permissions_grant_to_protected ON public.rbac_permissions;
CREATE TRIGGER rbac_permissions_grant_to_protected
  AFTER INSERT ON public.rbac_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rbac_permissions_grant_to_protected();

-- =========================================================================
-- TEAM MEMBERSHIP RESOLVER
--
-- There is no team_members junction table in this schema. Team/reporting
-- structure is modelled on public.employees (20260630120100):
--   employees.user_id    -> profiles.id (== auth.users.id)   [identity link]
--   employees.team_id    -> teams.id                          [team membership]
--   employees.manager_id -> employees.id (self-FK)            [reporting line]
--
-- Per product decision, scope 'team' covers BOTH of:
--   (a) same team  — both employees share a non-NULL team_id
--   (b) direct report — the resource owner's manager_id is the requester's
--       employee row
--
-- Deliberately NOT included (available if we widen later):
--   * the transitive manager_id subtree (only DIRECT reports count)
--   * teams.lead_id / departments.lead_id leadership without a manager link
--
-- A user is always "on their own team", which makes scope 'team' a strict
-- superset of scope 'own' — the lattice has_permission() relies on.
-- Employee `status` is NOT filtered: an offboarded report still resolves as
-- team, so managers keep scoped access to their records.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_is_team_member(
  p_user_id           UUID,
  p_resource_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_resource_owner_id IS NULL THEN false
    WHEN p_user_id = p_resource_owner_id                  THEN true
    ELSE EXISTS (
      SELECT 1
        FROM public.employees requester
        JOIN public.employees owner ON owner.user_id = p_resource_owner_id
       WHERE requester.user_id = p_user_id
         AND (
              -- (a) same team
              (requester.team_id IS NOT NULL AND requester.team_id = owner.team_id)
              -- (b) direct report
           OR owner.manager_id = requester.id
         )
    )
  END
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_is_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_is_team_member(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.rbac_is_team_member(uuid, uuid) IS
  'True when p_resource_owner_id is on p_user_id''s team: same employees.team_id, a direct report via employees.manager_id, or the same person.';

-- =========================================================================
-- has_permission(user, module, action, scope, resource_owner)
--
-- True when ANY of the user's roles grants a permission for module+action
-- whose stored scope COVERS the requested scope:
--
--   stored 'all'  -> satisfies any requested scope, resource owner irrelevant
--   stored 'team' -> satisfies 'team' or 'own', IF rbac_is_team_member(user, owner)
--   stored 'own'  -> satisfies 'own' only, and only when owner = user
--
-- Permissions UNION across every role the user holds (a single EXISTS over the
-- join does this naturally).
--
-- NOTE: this is the 5-arg OVERLOAD. The legacy 2-arg
-- has_permission(uuid, text) is untouched and still backs current RLS.
--
-- PHASE 1: defined, granted and tested — but wired into NO policy yet.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id           UUID,
  p_module            TEXT,
  p_action            TEXT,
  p_scope             TEXT,
  p_resource_owner_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Fail loudly on a mis-typed scope literal rather than silently denying (or,
  -- worse, silently allowing via an 'all' grant) — these come from our own
  -- policy/code, never from user input.
  IF p_scope IS NULL OR p_scope NOT IN ('own', 'team', 'all') THEN
    RAISE EXCEPTION 'has_permission: invalid scope %, expected one of own|team|all', p_scope
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_user_id IS NULL OR p_module IS NULL OR p_action IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.rbac_user_roles ur
      JOIN public.rbac_role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.rbac_permissions p       ON p.id       = rp.permission_id
     WHERE ur.user_id = p_user_id
       AND p.module   = p_module
       AND p.action   = p_action
       AND (
            -- 'all' covers everything
            p.scope = 'all'
            -- 'team' covers 'team' and 'own' requests, gated on membership
         OR (p.scope = 'team'
             AND p_scope IN ('team', 'own')
             AND public.rbac_is_team_member(p_user_id, p_resource_owner_id))
            -- 'own' covers only 'own' requests for the user's own resource
         OR (p.scope = 'own'
             AND p_scope = 'own'
             AND p_resource_owner_id IS NOT NULL
             AND p_resource_owner_id = p_user_id)
       )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.has_permission(uuid, text, text, text, uuid) IS
  'Dynamic RBAC check: true when any of the user''s rbac roles grants module+action at a scope covering p_scope. Phase 1 — not yet wired into RLS.';

-- Convenience wrapper for the common "current user, no specific resource"
-- check, so policies and PostgREST RPC calls stay terse.
CREATE OR REPLACE FUNCTION public.current_user_has_permission(
  p_module            TEXT,
  p_action            TEXT,
  p_scope             TEXT,
  p_resource_owner_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_permission(auth.uid(), p_module, p_action, p_scope, p_resource_owner_id)
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(text, text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_has_permission(text, text, text, uuid) TO authenticated;

-- =========================================================================
-- SEED: permission catalog
--
-- Scoped to modules that actually have backing tables today. Each row below
-- expands to one rbac_permissions row per scope in the array.
-- Convention: only list a scope the codebase could meaningfully check —
-- e.g. `hr.create` is 'all' only (you do not "create an employee you own").
-- =========================================================================
INSERT INTO public.rbac_permissions (module, action, scope, description)
SELECT v.module, v.action, s.scope, v.description
FROM (VALUES
  -- HR / employee directory & records (employees, employee_profiles, positions)
  ('hr', 'view',    ARRAY['own','team','all'], 'View employee records'),
  ('hr', 'create',  ARRAY['all'],              'Create employee records'),
  ('hr', 'edit',    ARRAY['own','team','all'], 'Edit employee records'),
  ('hr', 'delete',  ARRAY['all'],              'Delete / offboard employees'),
  ('hr', 'invite',  ARRAY['all'],              'Invite people to the platform'),
  ('hr', 'export',  ARRAY['team','all'],       'Export employee data'),

  -- Org structure (departments, teams, positions, employment_types)
  ('organization', 'view',   ARRAY['all'], 'View departments, teams and positions'),
  ('organization', 'create', ARRAY['all'], 'Create departments, teams and positions'),
  ('organization', 'edit',   ARRAY['all'], 'Edit departments, teams and positions'),
  ('organization', 'delete', ARRAY['all'], 'Delete departments, teams and positions'),

  -- Attendance (attendance, work_sessions, break_sessions, exceptions, holidays)
  ('attendance', 'view',    ARRAY['own','team','all'], 'View attendance records'),
  ('attendance', 'create',  ARRAY['own','all'],        'Create attendance records'),
  ('attendance', 'edit',    ARRAY['own','team','all'], 'Adjust attendance records'),
  ('attendance', 'approve', ARRAY['team','all'],       'Approve attendance exceptions'),
  ('attendance', 'export',  ARRAY['own','team','all'], 'Export attendance data'),

  -- Daily reports (daily_reports, report_reviews, daily_status_updates)
  ('reports', 'view',    ARRAY['own','team','all'], 'View daily reports'),
  ('reports', 'create',  ARRAY['own'],              'Submit daily reports'),
  ('reports', 'edit',    ARRAY['own','team','all'], 'Edit daily reports'),
  ('reports', 'delete',  ARRAY['own','all'],        'Delete daily reports'),
  ('reports', 'approve', ARRAY['team','all'],       'Review / approve daily reports'),
  ('reports', 'export',  ARRAY['own','team','all'], 'Export daily reports'),

  -- Payroll (employee_compensation, payslip_deliveries, payslip_edit_log)
  ('payroll', 'view',    ARRAY['own','team','all'], 'View compensation and payslips'),
  ('payroll', 'create',  ARRAY['all'],              'Create compensation records / run payroll'),
  ('payroll', 'edit',    ARRAY['all'],              'Edit compensation and payslips'),
  ('payroll', 'delete',  ARRAY['all'],              'Delete compensation records'),
  ('payroll', 'approve', ARRAY['all'],              'Approve a payroll run'),
  ('payroll', 'export',  ARRAY['own','team','all'], 'Export payroll data'),

  -- Projects (projects, project_members, epics, milestones, project_risks)
  ('projects', 'view',    ARRAY['own','team','all'], 'View projects'),
  ('projects', 'create',  ARRAY['all'],              'Create projects'),
  ('projects', 'edit',    ARRAY['own','team','all'], 'Edit project details'),
  ('projects', 'archive', ARRAY['own','team','all'], 'Archive projects'),
  ('projects', 'delete',  ARRAY['all'],              'Permanently delete projects'),
  ('projects', 'export',  ARRAY['team','all'],       'Export project data'),

  -- Tasks (tasks, dependency_requests)
  ('tasks', 'view',   ARRAY['own','team','all'], 'View tasks'),
  ('tasks', 'create', ARRAY['own','team','all'], 'Create tasks'),
  ('tasks', 'edit',   ARRAY['own','team','all'], 'Edit tasks'),
  ('tasks', 'delete', ARRAY['own','team','all'], 'Delete tasks'),
  ('tasks', 'assign', ARRAY['team','all'],       'Assign tasks to members'),

  -- Sprint management. NOTE: no dedicated sprints table yet — carried over
  -- from the legacy `sprints.manage` key so route guards keep a home.
  ('sprints', 'view',   ARRAY['team','all'], 'View sprints'),
  ('sprints', 'create', ARRAY['team','all'], 'Create sprints'),
  ('sprints', 'edit',   ARRAY['team','all'], 'Plan and edit sprints'),
  ('sprints', 'delete', ARRAY['team','all'], 'Delete sprints'),

  -- Approvals (approval_requests, approval_actions)
  ('approvals', 'view',    ARRAY['own','team','all'], 'View approval requests'),
  ('approvals', 'create',  ARRAY['own'],              'Raise an approval request'),
  ('approvals', 'approve', ARRAY['team','all'],       'Approve or reject requests'),

  -- Clients
  ('clients', 'view',   ARRAY['all'], 'View clients'),
  ('clients', 'create', ARRAY['all'], 'Create clients'),
  ('clients', 'edit',   ARRAY['all'], 'Edit clients'),
  ('clients', 'delete', ARRAY['all'], 'Delete clients'),

  -- Rewards
  ('rewards', 'view',    ARRAY['own','team','all'], 'View rewards'),
  ('rewards', 'create',  ARRAY['team','all'],       'Grant rewards'),
  ('rewards', 'approve', ARRAY['all'],              'Approve rewards'),

  -- Analytics & dashboards
  ('analytics', 'view',   ARRAY['own','team','all'], 'View analytics and dashboards'),
  ('analytics', 'export', ARRAY['team','all'],       'Export analytics data'),

  -- Roles & permissions administration (this module)
  ('roles', 'view',   ARRAY['all'], 'View roles and their permissions'),
  ('roles', 'create', ARRAY['all'], 'Create roles'),
  ('roles', 'edit',   ARRAY['all'], 'Edit roles and the role -> permission matrix'),
  ('roles', 'delete', ARRAY['all'], 'Delete roles'),
  ('roles', 'assign', ARRAY['all'], 'Grant and revoke user roles'),

  -- Platform settings (companies, company_settings, system_settings)
  ('settings', 'view', ARRAY['all'], 'View company / system settings'),
  ('settings', 'edit', ARRAY['all'], 'Manage company / system settings'),

  -- Integrations
  ('integrations', 'view', ARRAY['all'], 'View configured integrations'),
  ('integrations', 'edit', ARRAY['all'], 'Configure external integrations'),

  -- Notifications & outbound email (notifications, general_emails)
  ('notifications', 'view',   ARRAY['own','all'], 'View notifications'),
  ('notifications', 'create', ARRAY['team','all'], 'Send announcements / general emails'),

  -- Audit log
  ('audit', 'view',   ARRAY['all'], 'Read the security audit log'),
  ('audit', 'export', ARRAY['all'], 'Export the security audit log')
) AS v(module, action, scopes, description)
CROSS JOIN LATERAL unnest(v.scopes) AS s(scope)
ON CONFLICT (module, action, scope) DO NOTHING;

-- =========================================================================
-- SEED: the protected "Owner" role.
--
-- Insert order matters: the role is created FIRST, then granted the whole
-- catalog. From this point on, trigger (4) keeps it granted every permission
-- any future migration adds — so this backfill only ever covers the rows
-- seeded above.
-- =========================================================================
INSERT INTO public.rbac_roles (name, description, is_protected)
VALUES ('Owner', 'Full, unrestricted access to every module. Built-in and cannot be deleted or modified.', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.rbac_roles r
 CROSS JOIN public.rbac_permissions p
 WHERE r.name = 'Owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =========================================================================
-- POST-CONDITION: fail the migration if the Owner invariant did not hold.
-- =========================================================================
DO $$
DECLARE
  _catalog INT;
  _granted INT;
BEGIN
  SELECT count(*) INTO _catalog FROM public.rbac_permissions;
  SELECT count(*) INTO _granted
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_roles r ON r.id = rp.role_id
   WHERE r.name = 'Owner';

  IF _catalog = 0 THEN
    RAISE EXCEPTION 'rbac seed failed: permission catalog is empty';
  END IF;
  IF _granted <> _catalog THEN
    RAISE EXCEPTION 'rbac seed failed: Owner holds % of % permissions', _granted, _catalog;
  END IF;

  RAISE NOTICE 'rbac phase 1: % permissions catalogued, Owner granted all of them', _catalog;
END $$;
