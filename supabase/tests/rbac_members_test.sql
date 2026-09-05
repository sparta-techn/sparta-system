-- =========================================================================
-- SpartaFlow — role membership RPC tests
-- Covers supabase/migrations/20260905140000_rbac_role_members.sql.
-- Runs under a faked JWT identity so the has_permission() gating is executed.
-- Self-contained; ROLLBACK at the end.
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

CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
END;
$$;

CREATE TEMP TABLE t (k TEXT PRIMARY KEY, v UUID NOT NULL);
INSERT INTO t (k, v) VALUES
  ('admin_u', gen_random_uuid()), ('ada', gen_random_uuid()),
  ('bob', gen_random_uuid()), ('plain_u', gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '.members@example.invalid' FROM t;

UPDATE public.profiles SET full_name = 'Ada Lovelace'
 WHERE id = (SELECT v FROM t WHERE k = 'ada');
UPDATE public.profiles SET full_name = 'Bob Barker'
 WHERE id = (SELECT v FROM t WHERE k = 'bob');

DO $$
DECLARE
  admin_u UUID := (SELECT v FROM t WHERE k='admin_u');
  ada     UUID := (SELECT v FROM t WHERE k='ada');
  bob     UUID := (SELECT v FROM t WHERE k='bob');
  plain_u UUID := (SELECT v FROM t WHERE k='plain_u');
  owner_role UUID := (SELECT id FROM public.rbac_roles WHERE name='Owner');
  squad   UUID;
  n       INT;
  nm      TEXT;
BEGIN
  INSERT INTO public.rbac_user_roles (user_id, role_id) VALUES (admin_u, owner_role);
  INSERT INTO public.rbac_roles (name, description) VALUES ('ZZ Squad', 'test role')
  RETURNING id INTO squad;

  PERFORM pg_temp.act_as(admin_u);

  RAISE NOTICE '=== A. empty role ===';
  SELECT count(*)::INT INTO n FROM public.rbac_role_members(squad);
  PERFORM pg_temp.assert('new role has no members', n = 0, true);

  RAISE NOTICE '=== B. assignable users excludes current holders ===';
  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, NULL)
   WHERE user_id IN (ada, bob);
  PERFORM pg_temp.assert('both candidates offered before assignment', n = 2, true);

  PERFORM public.rbac_assign_role(ada, squad);

  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, NULL) WHERE user_id = ada;
  PERFORM pg_temp.assert('assigned user drops out of the picker', n = 0, true);
  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, NULL) WHERE user_id = bob;
  PERFORM pg_temp.assert('unassigned user still offered', n = 1, true);

  RAISE NOTICE '=== C. members reflects assignment, resolved to a name ===';
  SELECT count(*)::INT INTO n FROM public.rbac_role_members(squad);
  PERFORM pg_temp.assert('role now has 1 member', n = 1, true);
  SELECT m.display_name INTO nm FROM public.rbac_role_members(squad) m WHERE m.user_id = ada;
  PERFORM pg_temp.assert('display_name resolves from profiles', nm = 'Ada Lovelace', true);

  -- a profile with no full_name falls back to the email, never NULL
  SELECT m.display_name INTO nm
    FROM public.rbac_assignable_users(squad, NULL) m WHERE m.user_id = plain_u;
  PERFORM pg_temp.assert('nameless profile falls back to email',
    nm = 'plain_u.members@example.invalid', true);

  RAISE NOTICE '=== D. search filters by name and email ===';
  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, 'Barker');
  PERFORM pg_temp.assert('search by surname matches', n = 1, true);
  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, 'BARKER');
  PERFORM pg_temp.assert('search is case-insensitive', n = 1, true);
  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, 'bob.members@');
  PERFORM pg_temp.assert('search by email matches', n = 1, true);
  SELECT count(*)::INT INTO n FROM public.rbac_assignable_users(squad, 'zzzz-no-such-person');
  PERFORM pg_temp.assert('non-matching search returns nothing', n = 0, true);

  RAISE NOTICE '=== E. unassign removes the member ===';
  PERFORM public.rbac_unassign_role(ada, squad);
  SELECT count(*)::INT INTO n FROM public.rbac_role_members(squad);
  PERFORM pg_temp.assert('member removed', n = 0, true);

  RAISE NOTICE '=== F. both RPCs are permission-gated ===';
  PERFORM pg_temp.act_as(plain_u);
  BEGIN
    PERFORM public.rbac_role_members(squad);
    RAISE EXCEPTION 'FAIL  listed members without roles.view';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  members list denied without roles.view';
  END;
  BEGIN
    PERFORM public.rbac_assignable_users(squad, NULL);
    RAISE EXCEPTION 'FAIL  listed assignable users without roles.assign';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  candidate list denied without roles.assign';
  END;

  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    PERFORM public.rbac_role_members(squad);
    RAISE EXCEPTION 'FAIL  anonymous listed members';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pass  anonymous denied';
  END;

  RAISE NOTICE '';
  RAISE NOTICE '*** ALL RBAC MEMBERSHIP ASSERTIONS PASSED ***';
END $$;

ROLLBACK;
