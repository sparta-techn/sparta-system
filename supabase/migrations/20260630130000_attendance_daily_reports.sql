-- =========================================================================
-- SpartaFlow Hub — Attendance & Daily Reports module
-- Tables: attendance, attendance_sessions, break_sessions, daily_reports,
--         dependency_requests, daily_status_updates, attendance_events
-- Conventions reused from the existing auth / attendance / hr migrations:
--   * uuid PKs (gen_random_uuid())   * created_at / updated_at audit fields
--   * created_by / updated_by audit fields (DEFAULT auth.uid())
--   * BEFORE-UPDATE trigger public.tg_set_updated_at()
--   * RLS enabled on every table      * authorization via public.has_any_role()
--   * grants to authenticated / service_role only — never anon
--   * denormalized user_id / work_date on child rows for cheap RLS
-- Depends on: 20260628195254 (profiles, user_roles, departments, teams,
--   has_any_role, tg_set_updated_at) and 20260628201706 (attendance enums).
-- Frontend is NOT modified. Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- ENUMS (idempotent — created only if absent)
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dependency_state AS ENUM (
    'draft', 'pending', 'accepted', 'in_progress', 'blocked',
    'resolved', 'rejected', 'cancelled', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dependency_type AS ENUM (
    'backend_api', 'ui_design', 'frontend', 'qa', 'devops', 'database',
    'content', 'product_decision', 'client_feedback', 'bug_fix',
    'infrastructure', 'security', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.daily_report_status AS ENUM ('draft', 'submitted', 'reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_update_kind AS ENUM ('morning_checkin', 'midday', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_event_type AS ENUM (
    'clock_in', 'clock_out', 'break_start', 'break_end',
    'status_change', 'adjustment', 'auto_absent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- HELPER: can_review_reports(uid) — single source for every manager-read
-- policy below. Mirrors the has_role / has_permission SECURITY DEFINER setup.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.can_review_reports(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(
    _user_id,
    ARRAY['owner', 'super_admin', 'hr', 'project_manager', 'team_lead']::public.app_role[]
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_review_reports(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_review_reports(uuid) TO authenticated;

-- =========================================================================
-- 1. ATTENDANCE  (one daily attendance record per user per work date)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date          DATE NOT NULL,
  department_id      UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id            UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  status             public.attendance_status NOT NULL DEFAULT 'in_progress',
  first_check_in_at  TIMESTAMPTZ,
  last_check_out_at  TIMESTAMPTZ,
  late_minutes       INT NOT NULL DEFAULT 0,
  worked_seconds     INT NOT NULL DEFAULT 0,
  break_seconds      INT NOT NULL DEFAULT 0,
  overtime_seconds   INT NOT NULL DEFAULT 0,
  notes              TEXT,
  -- audit fields
  created_by         UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date   ON public.attendance(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date        ON public.attendance(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status      ON public.attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_department  ON public.attendance(department_id);
CREATE INDEX IF NOT EXISTS idx_attendance_team        ON public.attendance(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_attendance ON public.attendance;
CREATE TRIGGER set_updated_at_attendance BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "attendance_read_self" ON public.attendance;
CREATE POLICY "attendance_read_self" ON public.attendance
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_read_reviewers" ON public.attendance;
CREATE POLICY "attendance_read_reviewers" ON public.attendance
  FOR SELECT TO authenticated USING (public.can_review_reports(auth.uid()));
DROP POLICY IF EXISTS "attendance_insert_self" ON public.attendance;
CREATE POLICY "attendance_insert_self" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_update_self" ON public.attendance;
CREATE POLICY "attendance_update_self" ON public.attendance
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_admin_write" ON public.attendance;
CREATE POLICY "attendance_admin_write" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]));

-- =========================================================================
-- 2. ATTENDANCE_SESSIONS  (work sessions / clock-in–out pairs within a day)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id    UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- denormalized for RLS
  work_date        DATE NOT NULL,                                             -- denormalized
  status           public.work_session_status NOT NULL DEFAULT 'working',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INT,
  timezone         TEXT,
  device           TEXT,
  browser          TEXT,
  ip               TEXT,
  location         TEXT,
  notes            TEXT,
  -- audit fields
  created_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_attendance ON public.attendance_sessions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_date  ON public.attendance_sessions(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_active     ON public.attendance_sessions(status)
  WHERE status IN ('working', 'on_break');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_attendance_sessions ON public.attendance_sessions;
CREATE TRIGGER set_updated_at_attendance_sessions BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "attendance_sessions_read_self" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_read_self" ON public.attendance_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_sessions_read_reviewers" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_read_reviewers" ON public.attendance_sessions
  FOR SELECT TO authenticated USING (public.can_review_reports(auth.uid()));
DROP POLICY IF EXISTS "attendance_sessions_insert_self" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_insert_self" ON public.attendance_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_sessions_update_self" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_update_self" ON public.attendance_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_sessions_admin_write" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_admin_write" ON public.attendance_sessions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]));

-- =========================================================================
-- 3. BREAK_SESSIONS  (breaks within a work session)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.break_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  attendance_id    UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE, -- denormalized rollup
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,        -- denormalized for RLS
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INT,
  reason           TEXT,
  -- audit fields
  created_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_break_sessions_session    ON public.break_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_break_sessions_attendance ON public.break_sessions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_break_sessions_user_open  ON public.break_sessions(user_id)
  WHERE ended_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.break_sessions TO authenticated;
GRANT ALL ON public.break_sessions TO service_role;
ALTER TABLE public.break_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_break_sessions ON public.break_sessions;
CREATE TRIGGER set_updated_at_break_sessions BEFORE UPDATE ON public.break_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "break_sessions_read_self" ON public.break_sessions;
CREATE POLICY "break_sessions_read_self" ON public.break_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "break_sessions_read_reviewers" ON public.break_sessions;
CREATE POLICY "break_sessions_read_reviewers" ON public.break_sessions
  FOR SELECT TO authenticated USING (public.can_review_reports(auth.uid()));
DROP POLICY IF EXISTS "break_sessions_insert_self" ON public.break_sessions;
CREATE POLICY "break_sessions_insert_self" ON public.break_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "break_sessions_update_self" ON public.break_sessions;
CREATE POLICY "break_sessions_update_self" ON public.break_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "break_sessions_admin_write" ON public.break_sessions;
CREATE POLICY "break_sessions_admin_write" ON public.break_sessions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]));

-- =========================================================================
-- 4. DAILY_REPORTS  (end-of-day report — one per user per work date)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date          DATE NOT NULL,
  attendance_id      UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
  session_id         UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  status             public.daily_report_status NOT NULL DEFAULT 'draft',
  summary            TEXT,
  completed          JSONB NOT NULL DEFAULT '[]'::jsonb,
  in_progress        JSONB NOT NULL DEFAULT '[]'::jsonb,
  open_dependencies  JSONB NOT NULL DEFAULT '[]'::jsonb,
  need_from_others   JSONB NOT NULL DEFAULT '[]'::jsonb,
  tomorrow_plan      JSONB NOT NULL DEFAULT '{}'::jsonb,
  reflection         JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at       TIMESTAMPTZ,
  reviewed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  -- audit fields
  created_by         UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON public.daily_reports(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date      ON public.daily_reports(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status    ON public.daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_attendance ON public.daily_reports(attendance_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT ALL ON public.daily_reports TO service_role;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_daily_reports ON public.daily_reports;
CREATE TRIGGER set_updated_at_daily_reports BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "daily_reports_read_self" ON public.daily_reports;
CREATE POLICY "daily_reports_read_self" ON public.daily_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "daily_reports_read_reviewers" ON public.daily_reports;
CREATE POLICY "daily_reports_read_reviewers" ON public.daily_reports
  FOR SELECT TO authenticated USING (public.can_review_reports(auth.uid()));
DROP POLICY IF EXISTS "daily_reports_insert_self" ON public.daily_reports;
CREATE POLICY "daily_reports_insert_self" ON public.daily_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "daily_reports_update_self" ON public.daily_reports;
CREATE POLICY "daily_reports_update_self" ON public.daily_reports
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Reviewers (managers/HR/owner) may update review fields on any report.
DROP POLICY IF EXISTS "daily_reports_reviewer_update" ON public.daily_reports;
CREATE POLICY "daily_reports_reviewer_update" ON public.daily_reports
  FOR UPDATE TO authenticated
  USING (public.can_review_reports(auth.uid()))
  WITH CHECK (public.can_review_reports(auth.uid()));
DROP POLICY IF EXISTS "daily_reports_admin_write" ON public.daily_reports;
CREATE POLICY "daily_reports_admin_write" ON public.daily_reports
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]));

-- =========================================================================
-- 5. DEPENDENCY_REQUESTS  (cross-team request / blocker)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.dependency_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  type            public.dependency_type NOT NULL DEFAULT 'other',
  priority        public.priority_level NOT NULL DEFAULT 'medium',
  state           public.dependency_state NOT NULL DEFAULT 'pending',
  requester_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id   UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  related_task_id UUID,                       -- forward-compatible (tasks table not yet present)
  tags            TEXT[] NOT NULL DEFAULT '{}'::text[],
  due_at          TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  -- audit fields
  created_by      UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dependency_requests_state      ON public.dependency_requests(state);
CREATE INDEX IF NOT EXISTS idx_dependency_requests_requester  ON public.dependency_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_dependency_requests_owner      ON public.dependency_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_dependency_requests_department ON public.dependency_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_dependency_requests_due        ON public.dependency_requests(due_at);
CREATE INDEX IF NOT EXISTS idx_dependency_requests_tags       ON public.dependency_requests USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dependency_requests TO authenticated;
GRANT ALL ON public.dependency_requests TO service_role;
ALTER TABLE public.dependency_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_dependency_requests ON public.dependency_requests;
CREATE TRIGGER set_updated_at_dependency_requests BEFORE UPDATE ON public.dependency_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Read: requester, owner, same-department peers, or reviewers.
DROP POLICY IF EXISTS "dependency_requests_read" ON public.dependency_requests;
CREATE POLICY "dependency_requests_read" ON public.dependency_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.can_review_reports(auth.uid())
    OR (
      department_id IS NOT NULL
      AND department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
    )
  );
-- Create: any authenticated user may raise a request as themselves.
DROP POLICY IF EXISTS "dependency_requests_insert_self" ON public.dependency_requests;
CREATE POLICY "dependency_requests_insert_self" ON public.dependency_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
-- Update: requester or assigned owner.
DROP POLICY IF EXISTS "dependency_requests_update_party" ON public.dependency_requests;
CREATE POLICY "dependency_requests_update_party" ON public.dependency_requests
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR owner_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR owner_id = auth.uid());
DROP POLICY IF EXISTS "dependency_requests_admin_write" ON public.dependency_requests;
CREATE POLICY "dependency_requests_admin_write" ON public.dependency_requests
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]));

-- =========================================================================
-- 6. DAILY_STATUS_UPDATES  (morning check-in / midday status pulses)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.daily_status_updates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date      DATE NOT NULL,
  attendance_id  UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
  kind           public.status_update_kind NOT NULL DEFAULT 'morning_checkin',
  mood           TEXT,
  mood_note      TEXT,
  main_goal      TEXT,
  progress       INT CHECK (progress IS NULL OR (progress BETWEEN 0 AND 100)),
  current_focus  TEXT,
  outlook        TEXT,
  priorities     JSONB NOT NULL DEFAULT '[]'::jsonb,
  task_progress  JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  help_request   JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at   TIMESTAMPTZ,
  -- audit fields
  created_by     UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date, kind)
);
CREATE INDEX IF NOT EXISTS idx_daily_status_updates_user_date ON public.daily_status_updates(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_status_updates_date      ON public.daily_status_updates(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_status_updates_kind      ON public.daily_status_updates(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_status_updates TO authenticated;
GRANT ALL ON public.daily_status_updates TO service_role;
ALTER TABLE public.daily_status_updates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_daily_status_updates ON public.daily_status_updates;
CREATE TRIGGER set_updated_at_daily_status_updates BEFORE UPDATE ON public.daily_status_updates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "daily_status_updates_read_self" ON public.daily_status_updates;
CREATE POLICY "daily_status_updates_read_self" ON public.daily_status_updates
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "daily_status_updates_read_reviewers" ON public.daily_status_updates;
CREATE POLICY "daily_status_updates_read_reviewers" ON public.daily_status_updates
  FOR SELECT TO authenticated USING (public.can_review_reports(auth.uid()));
DROP POLICY IF EXISTS "daily_status_updates_insert_self" ON public.daily_status_updates;
CREATE POLICY "daily_status_updates_insert_self" ON public.daily_status_updates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "daily_status_updates_update_self" ON public.daily_status_updates;
CREATE POLICY "daily_status_updates_update_self" ON public.daily_status_updates
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "daily_status_updates_admin_write" ON public.daily_status_updates;
CREATE POLICY "daily_status_updates_admin_write" ON public.daily_status_updates
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[]));

-- =========================================================================
-- 7. ATTENDANCE_EVENTS  (append-only attendance audit / event log)
--    No updated_at / updated_by — immutable; only SELECT + INSERT granted.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    public.attendance_event_type NOT NULL,
  from_status   TEXT,
  to_status     TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- audit fields (actor may differ from subject when an admin adjusts)
  actor_id      UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_events_attendance ON public.attendance_events(attendance_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_events_user       ON public.attendance_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_events_type       ON public.attendance_events(event_type);

-- Append-only: no UPDATE / DELETE grants.
GRANT SELECT, INSERT ON public.attendance_events TO authenticated;
GRANT ALL ON public.attendance_events TO service_role;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_events_read_self" ON public.attendance_events;
CREATE POLICY "attendance_events_read_self" ON public.attendance_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "attendance_events_read_reviewers" ON public.attendance_events;
CREATE POLICY "attendance_events_read_reviewers" ON public.attendance_events
  FOR SELECT TO authenticated USING (public.can_review_reports(auth.uid()));
-- Insert: subject records own events; reviewers may log adjustments for others.
DROP POLICY IF EXISTS "attendance_events_insert" ON public.attendance_events;
CREATE POLICY "attendance_events_insert" ON public.attendance_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.can_review_reports(auth.uid()));
