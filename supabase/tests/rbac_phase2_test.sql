-- =========================================================================
-- SpartaFlow — Phase 2 role-management API test suite
--
-- Exercises every RPC in
-- supabase/migrations/20260905130000_rbac_role_management_api.sql under a
-- REAL authenticated identity (auth.uid() is faked via the request JWT claim,
-- exactly as PostgREST sets it), so the has_permission() gating on each RPC is
-- genuinely executed rather than bypassed by running as superuser.
--
-- Self-contained and NON-DESTRUCTIVE: everything runs in a transaction that is
-- ROLLBACK'd at the end.
--
--     docker exec supabase_db_<ref> psql -U postgres -d postgres \
--       -v ON_ERROR_STOP=1 -f supabase/tests/rbac_phase2_test.sql
-- =========================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert(p_label TEXT, p_actual BOOLEAN, p_expected BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL  %  — expected %, got %', p_label, p_expected, COALESCE(p_actual::text, 'NULL');
  END IF;
  RAISE NOTICE 'pass  %', p_label;
END;
$$;

-- Impersonate a user the way PostgREST does: set the JWT claims GUC, which is
-- what auth.uid() reads.
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
                     true);
END;
$$;

-- -------------------------------------------------------------------------
-- FIXTURES
--   admin_u  — holds the protected Owner role (full catalog, incl. roles.*)
--   plain_u  — holds a role with NO roles.* permissions
--   solo_u   — holds ONLY the "ZZ Editors" role (used for lockout impact)
-- -------------------------------------------------------------------------
CREATE TEMP TABLE t (k TEXT PRIMARY KEY, v UUID NOT NULL);
INSERT INTO t (k, v) VALUES
  ('admin_u', gen_random_uuid()), ('plain_u', gen_random_uuid()), ('solo_u', gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '.p2test@example.invalid' FROM t;

DO $$
DECLARE
  admin_u UUID := (SELECT v FROM t WHERE k='admin_u');
  plain_u UUID := (SELECT v FROM t WHERE k='plain_u');
  solo_u  UUID := (SELECT v FROM t WHERE k='solo_u');
  owner_role UUID := (SELECT id FROM public.rbac_roles WHERE name='Owner');
  editors    UUID;
  viewers    UUID;
  new_role   UUID;
  n_before   INT;
  n_after    INT;
  n_int      INT;
  rec        RECORD;
  perm_hr_view_all  UUID := (SELECT id FROM public.rbac_permissions WHERE module='hr' AND action='view' AND scope='all');
  perm_hr_edit_team UUID := (SELECT id FROM public.rbac_permissions WHERE module='hr' AND action='edit' AND scope='team');
  perm_roles_edit   UUID := (SELECT id FROM public.rbac_permissions WHERE module='roles' AND action='edit' AND scope='all');
BEGIN
  -- admin_u gets Owner (the only path to roles.* in a fresh install)
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (admin_u, owner_role);

  -- A plain role with a couple of non-roles permissions
  INSERT INTO public.rbac_roles (name, description) VALUES ('ZZ Viewers', 'read only')
  RETURNING id INTO viewers;
  INSERT INTO public.rbac_role_permissions (role_id, permission_id)
  VALUES (viewers, perm_hr_view_all);
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (plain_u, viewers);

  -- A role that is the sole source of roles.edit for solo_u
  INSERT INTO public.rbac_roles (name, description) VALUES ('ZZ Editors', 'can edit roles')
  RETURNING id INTO editors;
  INSERT INTO public.rbac_role_permissions (role_id, permission_id)
  VALUES (editors, perm_roles_edit), (editors, perm_hr_edit_team);
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (solo_u, editors);

  RAISE NOTICE '=== A. RPCs are gated by has_permission(roles.*) ===';
  PERFORM pg_temp.act_as(plain_u);
  BEGIN
    PERFORM public.rbac_role_summaries();
    RAISE EXCEPTION 'FAIL  a user without roles.view listed the roles';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  roles list denied without roles.view';
  END;
  BEGIN
    PERFORM public.rbac_create_role('ZZ Sneaky', NULL);
    RAISE EXCEPTION 'FAIL  a user without roles.create created a role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  create denied without roles.create';
  END;
  BEGIN
    PERFORM public.rbac_replace_role_permissions(viewers, ARRAY[perm_roles_edit]);
    RAISE EXCEPTION 'FAIL  a user without roles.edit rewrote a permission set';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  permission rewrite denied without roles.edit';
  END;
  BEGIN
    PERFORM public.rbac_delete_role(viewers);
    RAISE EXCEPTION 'FAIL  a user without roles.delete deleted a role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  delete denied without roles.delete';
  END;
  BEGIN
    PERFORM public.rbac_assign_role(plain_u, owner_role);
    RAISE EXCEPTION 'FAIL  a user without roles.assign self-assigned Owner';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  self-escalation to Owner denied without roles.assign';
  END;

  -- ...but a user may always read their OWN effective access
  PERFORM public.rbac_effective_permissions(plain_u);
  RAISE NOTICE 'pass  a user can read their own effective permissions';
  BEGIN
    PERFORM public.rbac_effective_permissions(admin_u);
    RAISE EXCEPTION 'FAIL  read someone else''s effective permissions without roles.view';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  reading another user''s access denied without roles.view';
  END;

  RAISE NOTICE '=== B. unauthenticated is denied ===';
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    PERFORM public.rbac_role_summaries();
    RAISE EXCEPTION 'FAIL  anonymous listed the roles';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  anonymous denied';
  END;

  RAISE NOTICE '=== C. roles list counts ===';
  PERFORM pg_temp.act_as(admin_u);
  SELECT s.permission_count, s.user_count INTO n_before, n_after
    FROM public.rbac_role_summaries() s WHERE s.name = 'ZZ Editors';
  PERFORM pg_temp.assert('editors permission_count = 2', n_before = 2, true);
  PERFORM pg_temp.assert('editors user_count = 1',       n_after  = 1, true);
  SELECT s.permission_count INTO n_before
    FROM public.rbac_role_summaries() s WHERE s.name = 'Owner';
  PERFORM pg_temp.assert('Owner permission_count = full catalog',
    n_before = (SELECT count(*)::INT FROM public.rbac_permissions), true);

  RAISE NOTICE '=== D. effective permissions union across roles ===';
  PERFORM public.rbac_assign_role(plain_u, editors);   -- plain_u now has 2 roles
  SELECT count(*)::INT INTO n_int FROM public.rbac_effective_permissions(plain_u);
  PERFORM pg_temp.assert('union of Viewers + Editors = 3 permissions', n_int = 3, true);
  SELECT ep.granted_by INTO rec
    FROM public.rbac_effective_permissions(plain_u) ep
   WHERE ep.module='hr' AND ep.action='view' AND ep.scope='all';
  PERFORM pg_temp.assert('granted_by annotated', rec IS NOT NULL, true);
  PERFORM public.rbac_unassign_role(plain_u, editors);
  SELECT count(*)::INT INTO n_int FROM public.rbac_effective_permissions(plain_u);
  PERFORM pg_temp.assert('unassign removes the union contribution', n_int = 1, true);

  RAISE NOTICE '=== E. protected Owner is unreachable through the API ===';
  BEGIN
    PERFORM public.rbac_replace_role_permissions(owner_role, ARRAY[perm_hr_view_all]);
    RAISE EXCEPTION 'FAIL  Owner permission set was rewritten via RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  Owner permission rewrite rejected server-side';
  END;
  -- even a no-op / empty submission is rejected
  BEGIN
    PERFORM public.rbac_replace_role_permissions(owner_role, ARRAY[]::UUID[]);
    RAISE EXCEPTION 'FAIL  Owner permission set was emptied via RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  emptying Owner''s permissions rejected server-side';
  END;
  BEGIN
    PERFORM public.rbac_delete_role(owner_role);
    RAISE EXCEPTION 'FAIL  Owner role was deleted via RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  Owner delete rejected server-side';
  END;
  BEGIN
    PERFORM public.rbac_update_role(owner_role, 'Pwned', 'x');
    RAISE EXCEPTION 'FAIL  Owner role was renamed via RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  Owner rename rejected server-side';
  END;
  PERFORM public.rbac_update_role(owner_role, 'Owner', 'still editable copy');
  PERFORM pg_temp.assert('Owner description remains editable',
    (SELECT description = 'still editable copy' FROM public.rbac_roles WHERE id = owner_role), true);
  PERFORM pg_temp.assert('Owner still holds the whole catalog',
    (SELECT count(*) FROM public.rbac_role_permissions WHERE role_id = owner_role)
      = (SELECT count(*) FROM public.rbac_permissions), true);

  RAISE NOTICE '=== F. create / update / replace-permissions ===';
  SELECT public.rbac_create_role('ZZ Support', 'support desk') INTO new_role;
  PERFORM pg_temp.assert('role created unprotected',
    (SELECT NOT is_protected FROM public.rbac_roles WHERE id = new_role), true);
  BEGIN
    PERFORM public.rbac_create_role('   ', NULL);
    RAISE EXCEPTION 'FAIL  blank role name accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'pass  blank role name rejected';
  END;

  SELECT public.rbac_replace_role_permissions(new_role, ARRAY[perm_hr_view_all, perm_hr_edit_team])
    INTO n_int;
  PERFORM pg_temp.assert('replace inserted 2 grants', n_int = 2, true);
  -- full-set replacement, not a merge
  SELECT public.rbac_replace_role_permissions(new_role, ARRAY[perm_hr_edit_team]) INTO n_int;
  PERFORM pg_temp.assert('replace is a full-set swap, not a merge', n_int = 1, true);
  PERFORM pg_temp.assert('previous grant is gone',
    NOT EXISTS (SELECT 1 FROM public.rbac_role_permissions
                 WHERE role_id = new_role AND permission_id = perm_hr_view_all), true);
  -- duplicates in the payload collapse
  SELECT public.rbac_replace_role_permissions(
           new_role, ARRAY[perm_hr_view_all, perm_hr_view_all, perm_hr_edit_team]) INTO n_int;
  PERFORM pg_temp.assert('duplicate ids collapse', n_int = 2, true);
  -- clearing to empty is allowed
  SELECT public.rbac_replace_role_permissions(new_role, ARRAY[]::UUID[]) INTO n_int;
  PERFORM pg_temp.assert('empty set clears all grants', n_int = 0, true);

  RAISE NOTICE '=== G. replace rejects ids outside the catalog (atomically) ===';
  PERFORM public.rbac_replace_role_permissions(new_role, ARRAY[perm_hr_view_all]);
  BEGIN
    PERFORM public.rbac_replace_role_permissions(
      new_role, ARRAY[perm_hr_edit_team, gen_random_uuid()]);
    RAISE EXCEPTION 'FAIL  an unknown permission id was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'pass  unknown permission id rejected';
  END;
  -- the failed save must not have disturbed the existing set
  PERFORM pg_temp.assert('failed save left the original set intact',
    (SELECT count(*) FROM public.rbac_role_permissions WHERE role_id = new_role) = 1
    AND EXISTS (SELECT 1 FROM public.rbac_role_permissions
                 WHERE role_id = new_role AND permission_id = perm_hr_view_all), true);

  RAISE NOTICE '=== H. lockout impact (rbac_role_grant_impact) ===';
  -- solo_u holds roles.edit ONLY via ZZ Editors -> removing it costs 1 user
  SELECT gi.users_losing INTO n_int
    FROM public.rbac_role_grant_impact(editors) gi
   WHERE gi.permission_id = perm_roles_edit;
  PERFORM pg_temp.assert('sole grantor reports 1 user losing roles.edit', n_int = 1, true);

  -- give solo_u a second role that also grants roles.edit -> impact drops to 0
  PERFORM public.rbac_assign_role(solo_u, owner_role);
  SELECT gi.users_losing INTO n_int
    FROM public.rbac_role_grant_impact(editors) gi
   WHERE gi.permission_id = perm_roles_edit;
  PERFORM pg_temp.assert('Owner-role holders are not counted as losing', n_int = 0, true);
  PERFORM public.rbac_unassign_role(solo_u, owner_role);

  -- a role with no users assigned reports zero impact, not a phantom count
  SELECT gi.users_losing INTO n_int
    FROM public.rbac_role_grant_impact(new_role) gi
   WHERE gi.permission_id = perm_hr_view_all;
  PERFORM pg_temp.assert('unassigned role reports 0 users losing', n_int = 0, true);

  RAISE NOTICE '=== I. delete role clears its junction rows ===';
  SELECT public.rbac_delete_role(editors) INTO n_int;
  PERFORM pg_temp.assert('delete reports 1 user unassigned', n_int = 1, true);
  PERFORM pg_temp.assert('role row gone',
    NOT EXISTS (SELECT 1 FROM public.rbac_roles WHERE id = editors), true);
  PERFORM pg_temp.assert('rbac_user_roles rows gone',
    NOT EXISTS (SELECT 1 FROM public.rbac_user_roles WHERE role_id = editors), true);
  PERFORM pg_temp.assert('rbac_role_permissions rows gone',
    NOT EXISTS (SELECT 1 FROM public.rbac_role_permissions WHERE role_id = editors), true);
  SELECT count(*)::INT INTO n_int FROM public.rbac_effective_permissions(solo_u);
  PERFORM pg_temp.assert('deleted role no longer grants its user anything', n_int = 0, true);

  RAISE NOTICE '=== J. rbac_my_permissions reflects the caller ===';
  PERFORM pg_temp.act_as(plain_u);
  SELECT count(*)::INT INTO n_int FROM public.rbac_my_permissions();
  PERFORM pg_temp.assert('plain_u sees only its own 1 permission', n_int = 1, true);
  PERFORM pg_temp.act_as(admin_u);
  SELECT count(*)::INT INTO n_int FROM public.rbac_my_permissions();
  PERFORM pg_temp.assert('admin_u sees the whole catalog',
    n_int = (SELECT count(*)::INT FROM public.rbac_permissions), true);

  RAISE NOTICE '';
  RAISE NOTICE '*** ALL RBAC PHASE 2 ASSERTIONS PASSED ***';
END $$;

ROLLBACK;
