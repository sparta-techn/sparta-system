-- =========================================================================
-- SpartaFlow Hub — Project Execution core
-- Tables: projects (root, prerequisite), project_roles, project_members,
--         milestones, epics, project_activity, project_calendar_events,
--         project_risks
--
-- `projects` is created here because every requested table FK-references it and
-- it does not exist yet; it is the minimum root required to satisfy the
-- "Foreign Keys / relate to existing entities" requirement. NO tasks/task_*
-- tables are created or duplicated — epics & milestones are project-scoped and
-- will be referenced by `tasks` when that module lands.
--
-- Conventions reused from the existing auth / attendance / hr migrations:
--   * uuid PKs (gen_random_uuid())   * created_at/updated_at audit fields
--   * created_by / updated_by audit fields (DEFAULT auth.uid())
--   * BEFORE-UPDATE trigger public.tg_set_updated_at()
--   * RLS enabled on every table     * authorization via has_any_role() +
--     SECURITY DEFINER project helpers
--   * grants to authenticated / service_role only — never anon
-- Depends on: profiles, departments, teams (auth migration), dependency_requests
--   + priority_level enum (20260630130000). Regenerate types.ts after apply.
-- =========================================================================

-- =========================================================================
-- ENUMS (idempotent)
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM
    ('planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_health AS ENUM
    ('healthy', 'at_risk', 'blocked', 'delayed', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.milestone_status AS ENUM
    ('upcoming', 'in_progress', 'done', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_status AS ENUM
    ('open', 'mitigating', 'resolved', 'accepted', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_event_type AS ENUM
    ('meeting', 'deadline', 'release', 'review', 'kickoff', 'holiday', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_activity_type AS ENUM
    ('project_created', 'status_changed', 'health_changed', 'member_added',
     'member_removed', 'milestone_created', 'milestone_reached', 'epic_created',
     'risk_raised', 'risk_resolved', 'event_created', 'file_uploaded',
     'report_filed', 'comment_added', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- priority_level (low/medium/high/critical) already exists — reused for risks.

-- =========================================================================
-- PROJECTS  (root entity — prerequisite for every table below)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT NOT NULL UNIQUE,                       -- e.g. "ETB"
  name           TEXT NOT NULL,
  description    TEXT,
  manager_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  department_id  UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id        UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  priority       public.priority_level  NOT NULL DEFAULT 'medium',
  status         public.project_status  NOT NULL DEFAULT 'planning',
  health         public.project_health  NOT NULL DEFAULT 'healthy',
  start_date     DATE,
  end_date       DATE,
  color          TEXT,
  icon           TEXT,
  repository_url TEXT,
  figma_url      TEXT,
  api_docs_url   TEXT,
  archived_at    TIMESTAMPTZ,
  -- audit fields
  created_by     UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_manager     ON public.projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_department  ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_team        ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_active      ON public.projects(archived_at)
  WHERE archived_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- PROJECT_ROLES  (reference catalog — Lead / Contributor / Reviewer / …)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  rank        INT NOT NULL DEFAULT 0,                         -- ordering / hierarchy
  is_active   BOOLEAN NOT NULL DEFAULT true,
  -- audit fields
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_roles_active ON public.project_roles(is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_roles TO authenticated;
GRANT ALL ON public.project_roles TO service_role;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_project_roles ON public.project_roles;
CREATE TRIGGER set_updated_at_project_roles BEFORE UPDATE ON public.project_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- PROJECT_MEMBERS  (project ↔ profile membership)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_role_id UUID REFERENCES public.project_roles(id) ON DELETE SET NULL,
  -- audit fields
  added_by        UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role    ON public.project_members(project_role_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_project_members ON public.project_members;
CREATE TRIGGER set_updated_at_project_members BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- MILESTONES  (project-scoped delivery checkpoints)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  due_date    DATE,
  status      public.milestone_status NOT NULL DEFAULT 'upcoming',
  progress    INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  owner_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- audit fields
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_due     ON public.milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status  ON public.milestones(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_milestones ON public.milestones;
CREATE TRIGGER set_updated_at_milestones BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- EPICS  (project-scoped grouping; tasks will reference epic_id later)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.epics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  owner_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  -- audit fields
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_epics_project ON public.epics(project_id);
CREATE INDEX IF NOT EXISTS idx_epics_owner   ON public.epics(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epics TO authenticated;
GRANT ALL ON public.epics TO service_role;
ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_epics ON public.epics;
CREATE TRIGGER set_updated_at_epics BEFORE UPDATE ON public.epics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- PROJECT_ACTIVITY  (append-only project feed)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  type        public.project_activity_type NOT NULL,
  summary     TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_activity_project ON public.project_activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_actor   ON public.project_activity(actor_id);

-- Append-only: no UPDATE / DELETE grants.
GRANT SELECT, INSERT ON public.project_activity TO authenticated;
GRANT ALL ON public.project_activity TO service_role;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- PROJECT_CALENDAR_EVENTS  (project-scoped calendar; relates to milestones)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_calendar_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  event_type   public.calendar_event_type NOT NULL DEFAULT 'meeting',
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ,
  all_day      BOOLEAN NOT NULL DEFAULT false,
  location     TEXT,
  -- audit fields
  created_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project   ON public.project_calendar_events(project_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_milestone ON public.project_calendar_events(milestone_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_starts    ON public.project_calendar_events(starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_calendar_events TO authenticated;
GRANT ALL ON public.project_calendar_events TO service_role;
ALTER TABLE public.project_calendar_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_calendar_events ON public.project_calendar_events;
CREATE TRIGGER set_updated_at_calendar_events BEFORE UPDATE ON public.project_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- PROJECT_RISKS  (risk register; relates to milestones + dependency_requests)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_risks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  severity              public.priority_level NOT NULL DEFAULT 'medium',
  likelihood            public.priority_level NOT NULL DEFAULT 'medium',
  status                public.risk_status    NOT NULL DEFAULT 'open',
  owner_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mitigation            TEXT,
  milestone_id          UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  related_dependency_id UUID REFERENCES public.dependency_requests(id) ON DELETE SET NULL,
  due_date              DATE,
  resolved_at           TIMESTAMPTZ,
  -- audit fields
  created_by            UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_risks_project    ON public.project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_status     ON public.project_risks(status);
CREATE INDEX IF NOT EXISTS idx_project_risks_owner      ON public.project_risks(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_severity   ON public.project_risks(severity);
CREATE INDEX IF NOT EXISTS idx_project_risks_milestone  ON public.project_risks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_dependency ON public.project_risks(related_dependency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_risks TO authenticated;
GRANT ALL ON public.project_risks TO service_role;
ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_project_risks ON public.project_risks;
CREATE TRIGGER set_updated_at_project_risks BEFORE UPDATE ON public.project_risks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- PROJECT AUTHORIZATION HELPERS (SECURITY DEFINER — bypass RLS, no recursion)
-- =========================================================================
-- Member of a project (explicit membership OR the project's manager).
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = _project_id AND pm.user_id = _user_id
         )
      OR EXISTS (
           SELECT 1 FROM public.projects p
            WHERE p.id = _project_id AND p.manager_id = _user_id
         );
$$;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;

-- May administer a project (its manager, or an elevated role).
CREATE OR REPLACE FUNCTION public.can_manage_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(
           _user_id,
           ARRAY['owner', 'super_admin', 'project_manager']::public.app_role[]
         )
      OR EXISTS (
           SELECT 1 FROM public.projects p
            WHERE p.id = _project_id AND p.manager_id = _user_id
         );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated;

-- =========================================================================
-- RLS POLICIES
-- Read  = project member OR elevated role (owner / super_admin / project_manager)
-- Write = can_manage_project()  (members may add calendar events + activity)
-- =========================================================================

-- ── projects ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_read" ON public.projects;
CREATE POLICY "projects_read" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project(auth.uid(), id));
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.can_manage_project(auth.uid(), id))
  WITH CHECK (public.can_manage_project(auth.uid(), id));
DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[]));

-- ── project_roles (reference data) ────────────────────────────────────────
DROP POLICY IF EXISTS "project_roles_read" ON public.project_roles;
CREATE POLICY "project_roles_read" ON public.project_roles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "project_roles_admin_write" ON public.project_roles;
CREATE POLICY "project_roles_admin_write" ON public.project_roles
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[]));

-- ── project_members ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "project_members_read" ON public.project_members;
CREATE POLICY "project_members_read" ON public.project_members
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "project_members_write" ON public.project_members;
CREATE POLICY "project_members_write" ON public.project_members
  FOR ALL TO authenticated
  USING (public.can_manage_project(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project(auth.uid(), project_id));

-- ── milestones ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "milestones_read" ON public.milestones;
CREATE POLICY "milestones_read" ON public.milestones
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "milestones_write" ON public.milestones;
CREATE POLICY "milestones_write" ON public.milestones
  FOR ALL TO authenticated
  USING (public.can_manage_project(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project(auth.uid(), project_id));

-- ── epics ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "epics_read" ON public.epics;
CREATE POLICY "epics_read" ON public.epics
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "epics_write" ON public.epics;
CREATE POLICY "epics_write" ON public.epics
  FOR ALL TO authenticated
  USING (public.can_manage_project(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project(auth.uid(), project_id));

-- ── project_activity (append-only: members read + insert, no update/delete) ─
DROP POLICY IF EXISTS "project_activity_read" ON public.project_activity;
CREATE POLICY "project_activity_read" ON public.project_activity
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "project_activity_insert" ON public.project_activity;
CREATE POLICY "project_activity_insert" ON public.project_activity
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- ── project_calendar_events (members read + write) ────────────────────────
DROP POLICY IF EXISTS "calendar_events_read" ON public.project_calendar_events;
CREATE POLICY "calendar_events_read" ON public.project_calendar_events
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "calendar_events_write" ON public.project_calendar_events;
CREATE POLICY "calendar_events_write" ON public.project_calendar_events
  FOR ALL TO authenticated
  USING (public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- ── project_risks (member read; managers write) ───────────────────────────
DROP POLICY IF EXISTS "project_risks_read" ON public.project_risks;
CREATE POLICY "project_risks_read" ON public.project_risks
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "project_risks_write" ON public.project_risks;
CREATE POLICY "project_risks_write" ON public.project_risks
  FOR ALL TO authenticated
  USING (public.can_manage_project(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project(auth.uid(), project_id));

-- =========================================================================
-- SEED: default project roles (matches features/projects ProjectRole)
-- =========================================================================
INSERT INTO public.project_roles (name, slug, description, rank) VALUES
  ('Lead',        'lead',        'Owns delivery and decisions for the project', 1),
  ('Contributor', 'contributor', 'Actively works on project tasks',             2),
  ('Reviewer',    'reviewer',    'Reviews work and provides feedback',          3),
  ('Stakeholder', 'stakeholder', 'Interested party with read/visibility access', 4)
ON CONFLICT (name) DO NOTHING;
