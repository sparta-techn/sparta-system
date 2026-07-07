-- =========================================================================
-- SpartaFlow Hub — Manager review of daily reports
-- Adds `report_reviews`: an append-only decision + comment trail that a
-- reviewer files against a submitted End-of-Day report (`daily_reports`) or an
-- intraday status pulse (`daily_status_updates`). One report may accrue several
-- reviews over time (re-review = new row); the latest row is the current
-- outcome. The decision + comment live here, NOT on the parent rows, so the
-- parent tables keep their existing owner-write lifecycle untouched.
--
-- Authorization (mirrors the rest of the attendance/daily-reports module):
--   * Read  — the report owner (sees the outcome) OR any reviewer
--             (public.can_review_reports: owner/super_admin/hr/project_manager/team_lead)
--   * Write — reviewers only, acting as themselves, and only against a report
--             whose real owner matches the denormalized subject_owner.
--   * Append-only — SELECT + INSERT grants only; no UPDATE/DELETE, so an
--             employee can read a review but can never alter or remove it.
-- Depends on: 20260630130000 (daily_reports, daily_status_updates,
--   can_review_reports). Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- ENUMS (idempotent)
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.report_review_decision AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_review_subject AS ENUM ('daily_report', 'status_update');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- REPORT_REVIEWS  (append-only review/decision trail; polymorphic subject)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.report_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  public.report_review_subject NOT NULL,
  subject_id    UUID NOT NULL,                       -- daily_reports.id | daily_status_updates.id (polymorphic; no FK)
  subject_owner UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized for RLS + owner read
  reviewer_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  decision      public.report_review_decision NOT NULL,
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_reviews_subject  ON public.report_reviews(subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_reviews_owner    ON public.report_reviews(subject_owner);
CREATE INDEX IF NOT EXISTS idx_report_reviews_reviewer ON public.report_reviews(reviewer_id);

-- Append-only: no UPDATE / DELETE grants (corrections are new rows).
GRANT SELECT, INSERT ON public.report_reviews TO authenticated;
GRANT ALL ON public.report_reviews TO service_role;
ALTER TABLE public.report_reviews ENABLE ROW LEVEL SECURITY;

-- Read: the report owner (their own outcome) or any reviewer.
DROP POLICY IF EXISTS "report_reviews_read" ON public.report_reviews;
CREATE POLICY "report_reviews_read" ON public.report_reviews
  FOR SELECT TO authenticated
  USING (
    subject_owner = auth.uid()
    OR public.can_review_reports(auth.uid())
  );

-- Insert: reviewers only, acting as themselves, and subject_owner must be the
-- true owner of the referenced report (blocks spoofing another user's outcome).
DROP POLICY IF EXISTS "report_reviews_insert_reviewer" ON public.report_reviews;
CREATE POLICY "report_reviews_insert_reviewer" ON public.report_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_review_reports(auth.uid())
    AND reviewer_id = auth.uid()
    AND (
      (subject_type = 'daily_report' AND EXISTS (
        SELECT 1 FROM public.daily_reports r
         WHERE r.id = subject_id AND r.user_id = subject_owner))
      OR
      (subject_type = 'status_update' AND EXISTS (
        SELECT 1 FROM public.daily_status_updates s
         WHERE s.id = subject_id AND s.user_id = subject_owner))
    )
  );
