-- =========================================================================
-- SpartaFlow — Enterprise RBAC (2/2): granular permission catalog & matrix
-- Replaces the original coarse permission keys (users:read, hr:access, …) with
-- the granular `domain.action` catalog and reseeds the role→permission matrix.
-- This is the SQL mirror of `src/features/auth/permissions.ts`
-- (PERMISSION_CATALOG + ROLE_PERMISSIONS) — keep the two in sync.
--
-- Enforcement remains RLS + `public.has_permission(uid, key)` (unchanged): that
-- function resolves a user's permissions through user_roles → role_permissions →
-- permissions, so it works transparently against this new catalog.
-- =========================================================================

-- Clear the previous (coarse) catalog. role_permissions FK-cascades on delete,
-- but we clear it explicitly first for clarity.
DELETE FROM public.role_permissions;
DELETE FROM public.permissions;

-- =========================================================================
-- SEED: granular permission catalog  (key, category, description)
-- =========================================================================
INSERT INTO public.permissions (key, category, description) VALUES
  -- People / HR directory
  ('employees.read',   'employees',    'View the employee directory and profiles'),
  ('employees.create', 'employees',    'Add employees'),
  ('employees.update', 'employees',    'Edit employee records'),
  ('employees.delete', 'employees',    'Delete / offboard employees'),
  ('employees.invite', 'employees',    'Invite people to the platform'),
  -- Org structure
  ('organization.manage', 'organization', 'Manage departments, teams and positions'),
  -- Projects
  ('projects.read',    'projects',     'View projects'),
  ('projects.create',  'projects',     'Create projects'),
  ('projects.edit',    'projects',     'Edit project details'),
  ('projects.archive', 'projects',     'Archive projects'),
  ('projects.delete',  'projects',     'Permanently delete projects'),
  -- Tasks
  ('tasks.read',       'tasks',        'View tasks'),
  ('tasks.create',     'tasks',        'Create tasks'),
  ('tasks.edit',       'tasks',        'Edit tasks'),
  ('tasks.assign',     'tasks',        'Assign tasks to members'),
  ('tasks.delete',     'tasks',        'Delete tasks'),
  -- Sprints
  ('sprints.manage',   'sprints',      'Plan and manage sprints'),
  -- Attendance
  ('attendance.read',   'attendance',  'View own attendance'),
  ('attendance.review', 'attendance',  'Review team / all attendance'),
  ('attendance.manage', 'attendance',  'Adjust others'' attendance records'),
  -- Daily reports
  ('reports.submit',   'reports',      'Submit daily reports'),
  ('reports.read',     'reports',      'View reports'),
  ('reports.review',   'reports',      'Review team members'' reports'),
  -- Analytics & dashboards
  ('analytics.view',            'analytics', 'View analytics and dashboards'),
  ('dashboard.executive.view',  'analytics', 'Access the executive / owner dashboard'),
  -- Access administration
  ('roles.assign',       'access',     'Grant and revoke user roles'),
  ('permissions.manage', 'access',     'Edit the role -> permission matrix'),
  -- Platform
  ('settings.manage',     'settings',  'Manage company / system settings'),
  ('integrations.manage', 'settings',  'Configure external integrations'),
  ('company.manage',      'settings',  'Manage company identity and ownership')
ON CONFLICT (key) DO NOTHING;

-- =========================================================================
-- SEED: role -> permission matrix  (mirror of ROLE_PERMISSIONS)
-- =========================================================================

-- owner: everything EXCEPT attendance.manage (owners are read-only on attendance)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'owner'::public.app_role, p.id
  FROM public.permissions p
 WHERE p.key <> 'attendance.manage'
ON CONFLICT (role, permission_id) DO NOTHING;

-- admin: full platform admin EXCEPT the owner-exclusive capabilities
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, p.id
  FROM public.permissions p
 WHERE p.key NOT IN ('company.manage', 'dashboard.executive.view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- All remaining roles via an explicit (role, key) list.
INSERT INTO public.role_permissions (role, permission_id)
SELECT v.role::public.app_role, p.id
FROM (
  VALUES
    -- hr
    ('hr','employees.read'), ('hr','employees.create'), ('hr','employees.update'),
    ('hr','employees.invite'), ('hr','organization.manage'),
    ('hr','attendance.read'), ('hr','attendance.review'), ('hr','attendance.manage'),
    ('hr','reports.read'), ('hr','reports.review'), ('hr','analytics.view'),
    -- project_manager
    ('project_manager','employees.read'),
    ('project_manager','projects.read'), ('project_manager','projects.create'),
    ('project_manager','projects.edit'), ('project_manager','projects.archive'),
    ('project_manager','tasks.read'), ('project_manager','tasks.create'),
    ('project_manager','tasks.edit'), ('project_manager','tasks.assign'),
    ('project_manager','tasks.delete'), ('project_manager','sprints.manage'),
    ('project_manager','attendance.read'), ('project_manager','attendance.review'),
    ('project_manager','reports.submit'), ('project_manager','reports.read'),
    ('project_manager','reports.review'), ('project_manager','analytics.view'),
    -- team_lead
    ('team_lead','employees.read'),
    ('team_lead','projects.read'),
    ('team_lead','tasks.read'), ('team_lead','tasks.create'),
    ('team_lead','tasks.edit'), ('team_lead','tasks.assign'),
    ('team_lead','attendance.read'), ('team_lead','attendance.review'),
    ('team_lead','reports.submit'), ('team_lead','reports.read'),
    ('team_lead','reports.review'),
    -- employee
    ('employee','employees.read'), ('employee','projects.read'),
    ('employee','tasks.read'), ('employee','tasks.edit'),
    ('employee','attendance.read'), ('employee','reports.submit'),
    -- intern
    ('intern','employees.read'), ('intern','projects.read'),
    ('intern','tasks.read'), ('intern','attendance.read'), ('intern','reports.submit'),
    -- viewer (deprecated / read-only)
    ('viewer','employees.read'), ('viewer','projects.read'),
    ('viewer','tasks.read'), ('viewer','attendance.read'), ('viewer','reports.read')
) AS v(role, perm_key)
JOIN public.permissions p ON p.key = v.perm_key
ON CONFLICT (role, permission_id) DO NOTHING;
