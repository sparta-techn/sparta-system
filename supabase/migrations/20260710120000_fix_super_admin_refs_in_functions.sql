-- =========================================================================
-- SpartaFlow — Fix stale 'super_admin' enum literals in FUNCTION bodies
--
-- Migration 20260703120000 renamed the app_role label super_admin -> admin.
-- That rename transparently updated stored rows AND every RLS policy (policy
-- expressions are stored as parsed trees, so the enum constant carried over).
-- It did NOT rewrite FUNCTION bodies: a SQL/plpgsql function stores its source
-- as TEXT and re-parses it at execution, so any body still casting the literal
-- 'super_admin'::app_role now raises at runtime:
--     invalid input value for enum app_role: 'super_admin'
--
-- Two SECURITY DEFINER helpers were missed by the rename and still carry the
-- old literal:
--   * can_manage_project() gates the projects_insert / project_members_write
--     RLS checks, so creating a project raised the error and the write silently
--     failed (surfaced now that the projects store awaits the write).
--   * can_review_reports() has the same latent bug on the daily-report review
--     path (see the note in 20260707130000_notification_triggers_extended.sql).
--
-- Both are re-created here casting 'admin'. CREATE OR REPLACE preserves existing
-- privileges; the REVOKE/GRANT lines are repeated to match the originals and
-- keep the migration idempotent.
-- =========================================================================

-- ── projects: manager / elevated-role check (projects + project_members RLS) ──
CREATE OR REPLACE FUNCTION public.can_manage_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(
           _user_id,
           ARRAY['owner', 'admin', 'project_manager']::public.app_role[]
         )
      OR EXISTS (
           SELECT 1 FROM public.projects p
            WHERE p.id = _project_id AND p.manager_id = _user_id
         );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated;

-- ── daily reports: reviewer check ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_review_reports(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(
    _user_id,
    ARRAY['owner', 'admin', 'hr', 'project_manager', 'team_lead']::public.app_role[]
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_review_reports(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_review_reports(uuid) TO authenticated;
