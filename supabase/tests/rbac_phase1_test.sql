-- =========================================================================
-- SpartaFlow — Phase 1 dynamic RBAC test suite
--
-- Exercises public.has_permission(uuid, text, text, text, uuid), the team
-- resolver, and every database-level protected-role safeguard added by
-- supabase/migrations/20260905120000_rbac_dynamic_roles_phase1.sql.
--
-- Self-contained and NON-DESTRUCTIVE: all fixtures are created inside a
-- transaction that is ROLLED BACK at the end. Nothing survives the run.
--
-- Run against a local stack:
--     supabase start
--     psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
--          -v ON_ERROR_STOP=1 -f supabase/tests/rbac_phase1_test.sql
--
-- Or against any database URL:
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rbac_phase1_test.sql
--
-- Exits non-zero on the first failed assertion (ON_ERROR_STOP + RAISE).
-- =========================================================================

\set ON_ERROR_STOP on

BEGIN;

-- -------------------------------------------------------------------------
-- Assertion helpers (transaction-local)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.assert(p_label TEXT, p_actual BOOLEAN, p_expected BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL  %  — expected %, got %', p_label, p_expected, COALESCE(p_actual::text, 'NULL');
  END IF;
  RAISE NOTICE 'pass  %', p_label;
END;
$$;

-- -------------------------------------------------------------------------
-- FIXTURES
--
--   team_alpha:  alice (manager), bob
--   team_beta:   carol, dave
--   reporting:   bob  -> alice   (same team, direct report)
--                dave -> alice   (DIFFERENT team, direct report)
--                carol           (no relationship to alice at all)
-- -------------------------------------------------------------------------
CREATE TEMP TABLE t_ids (k TEXT PRIMARY KEY, v UUID NOT NULL);

INSERT INTO t_ids (k, v) VALUES
  ('alice', gen_random_uuid()), ('bob',   gen_random_uuid()),
  ('carol', gen_random_uuid()), ('dave',  gen_random_uuid()),
  ('team_alpha', gen_random_uuid()), ('team_beta', gen_random_uuid());

-- auth.users inserts fire handle_new_user(), which creates public.profiles rows.
INSERT INTO auth.users (id, email)
SELECT v, k || '.rbactest@example.invalid' FROM t_ids
 WHERE k IN ('alice', 'bob', 'carol', 'dave');

INSERT INTO public.teams (id, name, slug)
SELECT v, 'RBAC Test ' || k, 'rbac-test-' || replace(k, '_', '-') FROM t_ids
 WHERE k IN ('team_alpha', 'team_beta');

INSERT INTO public.employees (user_id, team_id, status)
SELECT u.v, t.v, 'active'
  FROM t_ids u
  JOIN t_ids t ON t.k = CASE WHEN u.k IN ('alice','bob') THEN 'team_alpha' ELSE 'team_beta' END
 WHERE u.k IN ('alice','bob','carol','dave');

-- bob and dave report directly to alice
UPDATE public.employees SET manager_id = (
  SELECT e.id FROM public.employees e JOIN t_ids i ON i.v = e.user_id WHERE i.k = 'alice'
)
WHERE user_id IN (SELECT v FROM t_ids WHERE k IN ('bob', 'dave'));

-- Roles under test, each granting reports.view at exactly one scope.
INSERT INTO public.rbac_roles (name, description) VALUES
  ('ZZ Test Own',  'reports.view own'),
  ('ZZ Test Team', 'reports.view team'),
  ('ZZ Test All',  'reports.view all'),
  ('ZZ Test Edit Team', 'reports.edit team');

INSERT INTO public.rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.rbac_roles r
  JOIN public.rbac_permissions p
    ON (r.name, p.module, p.action, p.scope) IN (
         ('ZZ Test Own',       'reports', 'view', 'own'),
         ('ZZ Test Team',      'reports', 'view', 'team'),
         ('ZZ Test All',       'reports', 'view', 'all'),
         ('ZZ Test Edit Team', 'reports', 'edit', 'team')
       );

DO $$
DECLARE
  alice UUID := (SELECT v FROM t_ids WHERE k = 'alice');
  bob   UUID := (SELECT v FROM t_ids WHERE k = 'bob');
  carol UUID := (SELECT v FROM t_ids WHERE k = 'carol');
  dave  UUID := (SELECT v FROM t_ids WHERE k = 'dave');
  r_own  UUID := (SELECT id FROM public.rbac_roles WHERE name = 'ZZ Test Own');
  r_team UUID := (SELECT id FROM public.rbac_roles WHERE name = 'ZZ Test Team');
  r_all  UUID := (SELECT id FROM public.rbac_roles WHERE name = 'ZZ Test All');
  r_edit UUID := (SELECT id FROM public.rbac_roles WHERE name = 'ZZ Test Edit Team');
  owner_role UUID := (SELECT id FROM public.rbac_roles WHERE name = 'Owner');
  tmp_perm   UUID;
  tmp_role   UUID;
  n_catalog  INT;
  n_owner    INT;
BEGIN
  RAISE NOTICE '=== A. team resolver (rbac_is_team_member) ===';
  PERFORM pg_temp.assert('self is own team',            public.rbac_is_team_member(alice, alice), true);
  PERFORM pg_temp.assert('same team_id',                public.rbac_is_team_member(alice, bob),   true);
  PERFORM pg_temp.assert('same team_id (reverse)',      public.rbac_is_team_member(bob, alice),   true);
  PERFORM pg_temp.assert('cross-team direct report',    public.rbac_is_team_member(alice, dave),  true);
  PERFORM pg_temp.assert('report does NOT see manager', public.rbac_is_team_member(dave, alice),  false);
  PERFORM pg_temp.assert('unrelated user',              public.rbac_is_team_member(alice, carol), false);
  PERFORM pg_temp.assert('null owner',                  public.rbac_is_team_member(alice, NULL),  false);
  PERFORM pg_temp.assert('null user',                   public.rbac_is_team_member(NULL, alice),  false);

  RAISE NOTICE '=== B. no roles assigned ===';
  PERFORM pg_temp.assert('unassigned user denied',
    public.has_permission(alice, 'reports', 'view', 'own', alice), false);

  RAISE NOTICE '=== C. scope ''own'' ===';
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (alice, r_own);
  PERFORM pg_temp.assert('own grant / own request / self',   public.has_permission(alice,'reports','view','own', alice), true);
  PERFORM pg_temp.assert('own grant / own request / other',  public.has_permission(alice,'reports','view','own', bob),   false);
  PERFORM pg_temp.assert('own grant / own request / NULL',   public.has_permission(alice,'reports','view','own', NULL),  false);
  PERFORM pg_temp.assert('own grant does NOT cover team',    public.has_permission(alice,'reports','view','team',alice), false);
  PERFORM pg_temp.assert('own grant does NOT cover all',     public.has_permission(alice,'reports','view','all', NULL),  false);
  PERFORM pg_temp.assert('own grant / wrong action',         public.has_permission(alice,'reports','edit','own', alice), false);
  PERFORM pg_temp.assert('own grant / wrong module',         public.has_permission(alice,'payroll','view','own', alice), false);
  DELETE FROM public.rbac_user_roles WHERE user_id = alice;

  RAISE NOTICE '=== D. scope ''team'' ===';
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (alice, r_team);
  PERFORM pg_temp.assert('team grant / team request / same team',   public.has_permission(alice,'reports','view','team', bob),   true);
  PERFORM pg_temp.assert('team grant / team request / report',      public.has_permission(alice,'reports','view','team', dave),  true);
  PERFORM pg_temp.assert('team grant / team request / outsider',    public.has_permission(alice,'reports','view','team', carol), false);
  PERFORM pg_temp.assert('team grant / team request / NULL owner',  public.has_permission(alice,'reports','view','team', NULL),  false);
  -- 'team' is a superset of 'own'
  PERFORM pg_temp.assert('team grant covers own request / self',    public.has_permission(alice,'reports','view','own',  alice), true);
  PERFORM pg_temp.assert('team grant covers own request / teammate',public.has_permission(alice,'reports','view','own',  bob),   true);
  PERFORM pg_temp.assert('team grant does NOT cover all',           public.has_permission(alice,'reports','view','all',  NULL),  false);
  -- direction matters: dave reports to alice, not the other way round
  PERFORM pg_temp.assert('report cannot use manager''s team grant', public.has_permission(dave, 'reports','view','team', alice), false);
  DELETE FROM public.rbac_user_roles WHERE user_id = alice;

  RAISE NOTICE '=== E. scope ''all'' ===';
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (alice, r_all);
  PERFORM pg_temp.assert('all grant / all request',        public.has_permission(alice,'reports','view','all',  NULL),  true);
  PERFORM pg_temp.assert('all grant / team request',       public.has_permission(alice,'reports','view','team', carol), true);
  PERFORM pg_temp.assert('all grant / own request / other', public.has_permission(alice,'reports','view','own',  carol), true);
  PERFORM pg_temp.assert('all grant ignores owner arg',    public.has_permission(alice,'reports','view','all',  carol), true);
  DELETE FROM public.rbac_user_roles WHERE user_id = alice;

  RAISE NOTICE '=== F. union across multiple roles ===';
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (alice, r_own), (alice, r_edit);
  PERFORM pg_temp.assert('role 1 grant still applies', public.has_permission(alice,'reports','view','own',  alice), true);
  PERFORM pg_temp.assert('role 2 grant also applies',  public.has_permission(alice,'reports','edit','team', bob),   true);
  PERFORM pg_temp.assert('neither role grants delete', public.has_permission(alice,'reports','delete','own',alice), false);
  DELETE FROM public.rbac_user_roles WHERE user_id = alice;

  RAISE NOTICE '=== G. input validation ===';
  PERFORM pg_temp.assert('NULL user_id denied', public.has_permission(NULL,'reports','view','all', NULL), false);
  BEGIN
    PERFORM public.has_permission(alice, 'reports', 'view', 'everything', NULL);
    RAISE EXCEPTION 'FAIL  invalid scope should raise, but returned normally';
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'pass  invalid scope raises';
  END;

  RAISE NOTICE '=== H. legacy 2-arg has_permission still resolves ===';
  PERFORM pg_temp.assert('legacy overload intact',
    public.has_permission(alice, 'reports.read'), false);

  RAISE NOTICE '=== I. protected Owner role — database-level guards ===';
  SELECT count(*) INTO n_catalog FROM public.rbac_permissions;
  SELECT count(*) INTO n_owner
    FROM public.rbac_role_permissions WHERE role_id = owner_role;
  PERFORM pg_temp.assert('Owner holds the entire catalog', n_owner = n_catalog, true);
  PERFORM pg_temp.assert('Owner is protected',
    (SELECT is_protected FROM public.rbac_roles WHERE id = owner_role), true);

  BEGIN
    DELETE FROM public.rbac_roles WHERE id = owner_role;
    RAISE EXCEPTION 'FAIL  deleting the Owner role should be blocked';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'pass  Owner role cannot be deleted';
  END;

  BEGIN
    UPDATE public.rbac_roles SET is_protected = false WHERE id = owner_role;
    RAISE EXCEPTION 'FAIL  un-protecting the Owner role should be blocked';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'pass  Owner role cannot be un-protected';
  END;

  BEGIN
    UPDATE public.rbac_roles SET name = 'Not Owner' WHERE id = owner_role;
    RAISE EXCEPTION 'FAIL  renaming the Owner role should be blocked';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'pass  Owner role cannot be renamed';
  END;

  BEGIN
    DELETE FROM public.rbac_role_permissions WHERE role_id = owner_role;
    RAISE EXCEPTION 'FAIL  revoking an Owner permission should be blocked';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'pass  Owner permissions cannot be revoked';
  END;

  BEGIN
    UPDATE public.rbac_role_permissions SET role_id = r_own WHERE role_id = owner_role;
    RAISE EXCEPTION 'FAIL  repointing an Owner grant should be blocked';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'pass  Owner grants cannot be reassigned';
  END;

  UPDATE public.rbac_roles SET description = 'edited' WHERE id = owner_role;
  PERFORM pg_temp.assert('Owner description IS editable',
    (SELECT description = 'edited' FROM public.rbac_roles WHERE id = owner_role), true);

  RAISE NOTICE '=== J. new catalog rows auto-grant to protected roles ===';
  INSERT INTO public.rbac_permissions (module, action, scope, description)
  VALUES ('zz_probe', 'view', 'all', 'temporary probe permission')
  RETURNING id INTO tmp_perm;
  PERFORM pg_temp.assert('new permission auto-granted to Owner',
    EXISTS (SELECT 1 FROM public.rbac_role_permissions
             WHERE role_id = owner_role AND permission_id = tmp_perm), true);
  PERFORM pg_temp.assert('not auto-granted to ordinary roles',
    EXISTS (SELECT 1 FROM public.rbac_role_permissions
             WHERE role_id = r_own AND permission_id = tmp_perm), false);

  RAISE NOTICE '=== K. ON DELETE semantics ===';
  BEGIN
    DELETE FROM public.rbac_permissions WHERE id = tmp_perm;
    RAISE EXCEPTION 'FAIL  deleting a granted permission should be RESTRICTed';
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
    RAISE NOTICE 'pass  granted permission cannot be deleted (RESTRICT)';
  END;

  INSERT INTO public.rbac_roles (name, description) VALUES ('ZZ Test Doomed', 'to be deleted')
  RETURNING id INTO tmp_role;
  INSERT INTO public.rbac_role_permissions (role_id, permission_id) VALUES (tmp_role, tmp_perm);
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (carol, tmp_role);

  BEGIN
    DELETE FROM public.rbac_roles WHERE id = tmp_role;
    RAISE EXCEPTION 'FAIL  deleting an assigned role should be RESTRICTed';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'pass  assigned role cannot be deleted (RESTRICT via rbac_user_roles)';
  END;

  DELETE FROM public.rbac_user_roles WHERE role_id = tmp_role;
  DELETE FROM public.rbac_roles WHERE id = tmp_role;
  PERFORM pg_temp.assert('unassigned role deletes, grants cascade',
    NOT EXISTS (SELECT 1 FROM public.rbac_role_permissions WHERE role_id = tmp_role), true);

  RAISE NOTICE '=== L. catalog is developer-owned (constraints) ===';
  BEGIN
    INSERT INTO public.rbac_permissions (module, action, scope) VALUES ('hr', 'view', 'galaxy');
    RAISE EXCEPTION 'FAIL  invalid scope value should violate the check constraint';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  scope check constraint rejects unknown tiers';
  END;
  BEGIN
    INSERT INTO public.rbac_permissions (module, action, scope) VALUES ('HR Module', 'view', 'all');
    RAISE EXCEPTION 'FAIL  non-slug module should violate the check constraint';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'pass  module slug constraint rejects free text';
  END;

  RAISE NOTICE '';
  RAISE NOTICE '*** ALL RBAC PHASE 1 ASSERTIONS PASSED (% catalog permissions) ***', n_catalog;
END $$;

ROLLBACK;
