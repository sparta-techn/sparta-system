-- =========================================================================
-- SpartaFlow — Dynamic RBAC, PHASE 2: role-management API
--
-- The server-side surface the role management UI talks to. Every read and
-- write is a SECURITY DEFINER RPC gated on the Phase 1
-- `has_permission(uid, 'roles', <action>, 'all')` engine — so authorization is
-- re-validated in the database on every call and cannot be bypassed by
-- manipulating the client, the form payload or the PostgREST request.
--
-- STILL ADDITIVE:
--   * No existing RLS policy is created, dropped or altered.
--   * No `has_any_role()` call anywhere in the app is replaced.
--   * The Phase 1 `rbac_*` table policies keep their has_any_role() bootstrap
--     gate. These RPCs are SECURITY DEFINER, so they enforce has_permission()
--     themselves rather than relying on those policies. Phase 3 migrates the
--     table policies (and everything else) over.
--
-- Depends on 20260905120000_rbac_dynamic_roles_phase1.sql.
-- Regenerate src/integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- BOOTSTRAP: give every legacy `owner` the dynamic Owner role.
--
-- Without this NOBODY satisfies has_permission(…, 'roles', …), so the role
-- management UI would be unreachable for every user including its own
-- administrators. This seeds identity data only — it changes no policy and
-- removes no legacy grant. Legacy `user_roles` rows are left untouched.
-- =========================================================================
INSERT INTO public.rbac_user_roles (user_id, role_id)
SELECT ur.user_id, r.id
  FROM public.user_roles ur
 CROSS JOIN public.rbac_roles r
 WHERE ur.role = 'owner'::public.app_role
   AND r.name = 'Owner'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =========================================================================
-- INTERNAL: authorization guard shared by every RPC below.
-- Raises insufficient_privilege when the caller lacks roles.<action> at 'all'.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_require_roles_permission(p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.has_permission(auth.uid(), 'roles', p_action, 'all') THEN
    RAISE EXCEPTION 'You do not have permission to % roles', p_action
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_require_roles_permission(text) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- READ: rbac_my_permissions()
-- The caller's own effective permissions. Ungated beyond authentication —
-- you may always read your own access. Backs the client-side UI gate.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_my_permissions()
RETURNS TABLE (module TEXT, action TEXT, scope TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action, p.scope
    FROM public.rbac_user_roles ur
    JOIN public.rbac_role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.rbac_permissions p       ON p.id       = rp.permission_id
   WHERE ur.user_id = auth.uid()
   ORDER BY p.module, p.action, p.scope
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_my_permissions() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_my_permissions() TO authenticated;

-- =========================================================================
-- READ: rbac_role_summaries()
-- The roles list. Permission and user counts come from two PRE-AGGREGATED
-- subqueries joined once — a single round trip for the whole table, never one
-- count query per role.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_role_summaries()
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  description      TEXT,
  is_protected     BOOLEAN,
  permission_count INT,
  user_count       INT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.rbac_require_roles_permission('view');
  RETURN QUERY
    SELECT r.id, r.name, r.description, r.is_protected,
           COALESCE(pc.n, 0)::INT,
           COALESCE(uc.n, 0)::INT,
           r.created_at
      FROM public.rbac_roles r
      LEFT JOIN (
        SELECT rp.role_id, count(*) AS n
          FROM public.rbac_role_permissions rp GROUP BY rp.role_id
      ) pc ON pc.role_id = r.id
      LEFT JOIN (
        SELECT ur.role_id, count(*) AS n
          FROM public.rbac_user_roles ur GROUP BY ur.role_id
      ) uc ON uc.role_id = r.id
     ORDER BY r.is_protected DESC, r.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_role_summaries() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_role_summaries() TO authenticated;

-- =========================================================================
-- READ: rbac_role_permission_ids(role)
-- The permission ids a single role grants — feeds the editor's checkbox state.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_role_permission_ids(p_role_id UUID)
RETURNS TABLE (permission_id UUID)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.rbac_require_roles_permission('view');
  RETURN QUERY
    SELECT rp.permission_id FROM public.rbac_role_permissions rp WHERE rp.role_id = p_role_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_role_permission_ids(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_role_permission_ids(uuid) TO authenticated;

-- =========================================================================
-- READ: rbac_effective_permissions(user)
-- A user's permissions UNIONed across every role they hold, annotated with
-- which roles grant each one. One grouped query — no per-role fan-out.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_effective_permissions(p_user_id UUID)
RETURNS TABLE (module TEXT, action TEXT, scope TEXT, granted_by TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Reading someone else's effective access requires role-management view.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.rbac_require_roles_permission('view');
  END IF;

  RETURN QUERY
    SELECT p.module, p.action, p.scope,
           array_agg(DISTINCT r.name ORDER BY r.name)
      FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r             ON r.id       = ur.role_id
      JOIN public.rbac_role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.rbac_permissions p       ON p.id       = rp.permission_id
     WHERE ur.user_id = p_user_id
     GROUP BY p.module, p.action, p.scope
     ORDER BY p.module, p.action, p.scope;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_effective_permissions(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_effective_permissions(uuid) TO authenticated;

-- =========================================================================
-- READ: rbac_user_role_ids(user)  — a user's assigned roles, with metadata.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_user_roles_for(p_user_id UUID)
RETURNS TABLE (role_id UUID, name TEXT, description TEXT, is_protected BOOLEAN, granted_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.rbac_require_roles_permission('view');
  END IF;

  RETURN QUERY
    SELECT r.id, r.name, r.description, r.is_protected, ur.granted_at
      FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.id = ur.role_id
     WHERE ur.user_id = p_user_id
     ORDER BY r.is_protected DESC, r.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_user_roles_for(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_user_roles_for(uuid) TO authenticated;

-- =========================================================================
-- READ: rbac_role_grant_impact(role)
-- Backs the lockout safeguard. For every permission the role grants, how many
-- of its assigned users would lose that permission ENTIRELY if the grant went
-- away — i.e. users who hold it through this role and no other.
--
-- Users who also hold the protected Owner role never appear in the count,
-- because Owner grants the whole catalog and so satisfies the NOT EXISTS.
--
-- Single grouped query with one correlated NOT EXISTS — not a per-permission
-- or per-user round trip.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_role_grant_impact(p_role_id UUID)
RETURNS TABLE (
  permission_id UUID,
  module        TEXT,
  action        TEXT,
  scope         TEXT,
  users_losing  INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.rbac_require_roles_permission('view');
  RETURN QUERY
    SELECT p.id, p.module, p.action, p.scope,
           count(ur.user_id) FILTER (
             WHERE NOT EXISTS (
               SELECT 1
                 FROM public.rbac_user_roles ur2
                 JOIN public.rbac_role_permissions rp2 ON rp2.role_id = ur2.role_id
                WHERE ur2.user_id = ur.user_id
                  AND ur2.role_id <> p_role_id
                  AND rp2.permission_id = p.id
             )
           )::INT AS users_losing
      FROM public.rbac_role_permissions rp
      JOIN public.rbac_permissions p ON p.id = rp.permission_id
      LEFT JOIN public.rbac_user_roles ur ON ur.role_id = p_role_id
     WHERE rp.role_id = p_role_id
     GROUP BY p.id, p.module, p.action, p.scope
     ORDER BY p.module, p.action, p.scope;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_role_grant_impact(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_role_grant_impact(uuid) TO authenticated;

-- =========================================================================
-- WRITE: rbac_create_role(name, description)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_create_role(p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id   UUID;
  _name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  PERFORM public.rbac_require_roles_permission('create');

  IF length(_name) = 0 THEN
    RAISE EXCEPTION 'Role name is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF length(_name) > 64 THEN
    RAISE EXCEPTION 'Role name must be 64 characters or fewer' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- New roles are NEVER protected: is_protected is not a client-settable field.
  INSERT INTO public.rbac_roles (name, description, is_protected)
  VALUES (_name, NULLIF(btrim(COALESCE(p_description, '')), ''), false)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_create_role(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_create_role(text, text) TO authenticated;

-- =========================================================================
-- WRITE: rbac_update_role(id, name, description)
-- A protected role's description stays editable; its name does not (the Phase 1
-- trigger would reject the rename anyway — this is the friendlier error).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_update_role(
  p_role_id     UUID,
  p_name        TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _protected BOOLEAN;
  _current   TEXT;
  _name      TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  PERFORM public.rbac_require_roles_permission('edit');

  SELECT r.is_protected, r.name INTO _protected, _current
    FROM public.rbac_roles r WHERE r.id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF length(_name) = 0 THEN
    RAISE EXCEPTION 'Role name is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _protected AND _name IS DISTINCT FROM _current THEN
    RAISE EXCEPTION 'The "%" role is protected and cannot be renamed', _current
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.rbac_roles
     SET name        = _name,
         description = NULLIF(btrim(COALESCE(p_description, '')), ''),
         updated_by  = auth.uid()
   WHERE id = p_role_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_update_role(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_update_role(uuid, text, text) TO authenticated;

-- =========================================================================
-- WRITE: rbac_replace_role_permissions(role, permission_ids[])
--
-- Full-set replacement, not a diff: delete every existing grant for the role,
-- then insert the supplied set.
--
-- ATOMICITY: a PL/pgSQL function body runs inside a single transaction. The
-- DELETE and the INSERT either both commit or both roll back, so a failed save
-- can never leave a role holding a partial permission set. There is no window
-- in which the role has fewer permissions than it started with.
--
-- PROTECTED ROLES: rejected here, before any write. The Phase 1 triggers would
-- also reject the DELETE — this check exists so the caller gets a clear error
-- rather than a raw trigger exception, and so the rejection happens even if the
-- new set happens to be identical.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_replace_role_permissions(
  p_role_id        UUID,
  p_permission_ids UUID[]
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _protected BOOLEAN;
  _name      TEXT;
  _ids       UUID[] := COALESCE(p_permission_ids, ARRAY[]::UUID[]);
  _unknown   INT;
  _inserted  INT;
BEGIN
  PERFORM public.rbac_require_roles_permission('edit');

  SELECT r.is_protected, r.name INTO _protected, _name
    FROM public.rbac_roles r WHERE r.id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF _protected THEN
    RAISE EXCEPTION 'The "%" role is protected; its permissions cannot be modified', _name
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject unknown permission ids rather than silently dropping them: the
  -- catalog is developer-owned and the client may not invent entries.
  SELECT count(*) INTO _unknown
    FROM unnest(_ids) AS x(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.rbac_permissions p WHERE p.id = x.id);
  IF _unknown > 0 THEN
    RAISE EXCEPTION '% permission id(s) are not in the catalog', _unknown
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  DELETE FROM public.rbac_role_permissions WHERE role_id = p_role_id;

  INSERT INTO public.rbac_role_permissions (role_id, permission_id)
  SELECT p_role_id, DISTINCT_IDS.id
    FROM (SELECT DISTINCT unnest(_ids) AS id) AS DISTINCT_IDS;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_replace_role_permissions(uuid, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_replace_role_permissions(uuid, uuid[]) TO authenticated;

-- =========================================================================
-- WRITE: rbac_delete_role(role)
--
-- Removes the role's junction rows (rbac_user_roles, then rbac_role_permissions
-- via the role_id CASCADE) and the role itself, atomically.
--
-- NOTE ON THE FK: Phase 1 set rbac_user_roles.role_id ON DELETE RESTRICT so a
-- raw `DELETE FROM rbac_roles` can never silently strip people's access. This
-- RPC is the sanctioned path: it clears the assignments explicitly inside the
-- same transaction, giving cascade BEHAVIOR through the API while a stray
-- direct delete still fails loudly.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_delete_role(p_role_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _protected BOOLEAN;
  _name      TEXT;
  _unassigned INT;
BEGIN
  PERFORM public.rbac_require_roles_permission('delete');

  SELECT r.is_protected, r.name INTO _protected, _name
    FROM public.rbac_roles r WHERE r.id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF _protected THEN
    RAISE EXCEPTION 'The "%" role is protected and cannot be deleted', _name
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM public.rbac_user_roles WHERE role_id = p_role_id;
  GET DIAGNOSTICS _unassigned = ROW_COUNT;

  -- rbac_role_permissions cascades on role_id.
  DELETE FROM public.rbac_roles WHERE id = p_role_id;

  RETURN _unassigned;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_delete_role(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_delete_role(uuid) TO authenticated;

-- =========================================================================
-- WRITE: rbac_assign_role / rbac_unassign_role
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_assign_role(p_user_id UUID, p_role_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.rbac_require_roles_permission('assign');

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rbac_roles r WHERE r.id = p_role_id) THEN
    RAISE EXCEPTION 'Role not found' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.rbac_user_roles (user_id, role_id, granted_by)
  VALUES (p_user_id, p_role_id, auth.uid())
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_assign_role(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_assign_role(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rbac_unassign_role(p_user_id UUID, p_role_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.rbac_require_roles_permission('assign');
  DELETE FROM public.rbac_user_roles WHERE user_id = p_user_id AND role_id = p_role_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_unassign_role(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_unassign_role(uuid, uuid) TO authenticated;

-- =========================================================================
-- POST-CONDITION
-- =========================================================================
DO $$
DECLARE
  _owners INT;
BEGIN
  SELECT count(*) INTO _owners
    FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id
   WHERE r.name = 'Owner';
  RAISE NOTICE 'rbac phase 2: % user(s) hold the dynamic Owner role', _owners;
  IF _owners = 0 THEN
    RAISE WARNING 'No user holds the dynamic Owner role — the role management UI will be unreachable until one is assigned.';
  END IF;
END $$;
