-- =========================================================================
-- SpartaFlow — Dynamic RBAC: role membership reads
--
-- Phase 2 shipped assignment only from the person's side (employee profile →
-- Permissions). Managing a role's membership from the ROLE side needs the
-- inverse lookup, which no existing RPC provided.
--
-- Same contract as the rest of the Phase 2 API: SECURITY DEFINER functions
-- that re-check has_permission(auth.uid(), 'roles', <action>, 'all') inside
-- Postgres. Reading membership needs `view`; listing candidates to add needs
-- `assign`, since it is only useful to someone who can act on it.
--
-- STILL ADDITIVE: no existing RLS policy, table or function is modified.
-- Depends on 20260905130000_rbac_role_management_api.sql.
-- =========================================================================

-- =========================================================================
-- READ: rbac_role_members(role)
-- Who currently holds this role. One join against profiles — the caller does
-- not fan out a lookup per user.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_role_members(p_role_id UUID)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  email        TEXT,
  granted_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.rbac_require_roles_permission('view');
  RETURN QUERY
    SELECT ur.user_id,
           COALESCE(NULLIF(btrim(pr.full_name), ''), NULLIF(btrim(pr.display_name), ''), pr.email),
           pr.email,
           ur.granted_at
      FROM public.rbac_user_roles ur
      LEFT JOIN public.profiles pr ON pr.id = ur.user_id
     WHERE ur.role_id = p_role_id
     ORDER BY 2 NULLS LAST;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_role_members(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_role_members(uuid) TO authenticated;

COMMENT ON FUNCTION public.rbac_role_members(uuid) IS
  'Users holding a given dynamic role. Requires roles.view.';

-- =========================================================================
-- READ: rbac_assignable_users(role, search)
-- Candidates for the "add member" picker: everyone who does NOT already hold
-- the role, optionally name/email filtered. Capped at 50 rows so a large
-- directory cannot flood the picker.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rbac_assignable_users(
  p_role_id UUID,
  p_search  TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  email        TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _q TEXT := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  PERFORM public.rbac_require_roles_permission('assign');
  RETURN QUERY
    SELECT pr.id,
           COALESCE(NULLIF(btrim(pr.full_name), ''), NULLIF(btrim(pr.display_name), ''), pr.email),
           pr.email
      FROM public.profiles pr
     WHERE NOT EXISTS (
             SELECT 1 FROM public.rbac_user_roles ur
              WHERE ur.user_id = pr.id AND ur.role_id = p_role_id
           )
       AND (
             _q IS NULL
          OR pr.full_name    ILIKE '%' || _q || '%'
          OR pr.display_name ILIKE '%' || _q || '%'
          OR pr.email        ILIKE '%' || _q || '%'
           )
     ORDER BY 2 NULLS LAST
     LIMIT 50;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rbac_assignable_users(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rbac_assignable_users(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.rbac_assignable_users(uuid, text) IS
  'Users who do NOT yet hold a given dynamic role, for the assignment picker. Requires roles.assign.';
