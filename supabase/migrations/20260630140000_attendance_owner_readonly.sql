-- =========================================================================
-- SpartaFlow business rule: "Owners have read-only access to all attendance."
--
-- Owners keep full READ of every employee's attendance (via the existing
-- *_read_reviewers policies, which use can_review_reports() — owner included).
-- This migration removes `owner` from the cross-employee WRITE policies so an
-- owner can no longer mutate other people's attendance. Employees still manage
-- their own rows (the *_insert_self / *_update_self policies are unchanged), and
-- super_admin / hr remain the attendance administrators.
-- Idempotent: drops + recreates the admin-write policies.
-- =========================================================================

-- attendance ---------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_admin_write" ON public.attendance;
CREATE POLICY "attendance_admin_write" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::public.app_role[]));

-- attendance_sessions ------------------------------------------------------
DROP POLICY IF EXISTS "attendance_sessions_admin_write" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_admin_write" ON public.attendance_sessions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::public.app_role[]));

-- break_sessions -----------------------------------------------------------
DROP POLICY IF EXISTS "break_sessions_admin_write" ON public.break_sessions;
CREATE POLICY "break_sessions_admin_write" ON public.break_sessions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::public.app_role[]));
