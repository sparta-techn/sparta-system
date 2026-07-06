-- =========================================================================
-- SpartaFlow — Tasks core table
-- Minimal `tasks` table backing features/tasks. Subtasks are ordinary task
-- rows with a non-null parent_task_id (self-FK), so the tree nests indefinitely.
--
-- Only the durable, relational columns live here; the rich domain fields
-- (labels, checklist, watchers, relations, dates, points, ref, …) are assembled
-- in features/tasks/store.ts, which overlays them from localStorage on top of
-- these rows. Keep this shape 1:1 with services/tasks TaskRow.
--
-- Conventions reused from the project-execution migration (20260630150000):
--   * uuid PKs (gen_random_uuid())        * created_by audit field (auth.uid())
--   * created_at / updated_at audit + BEFORE-UPDATE tg_set_updated_at() trigger
--   * RLS enabled; authorization via the project membership helpers
--     is_project_member()/can_manage_project() + the granular has_permission()
--   * grants to authenticated / service_role only — never anon
-- Depends on: projects, profiles (auth migration), priority_level enum
--   (20260630130000), is_project_member()/has_any_role()/has_permission().
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- task_status enum — mirror of TASK_STATUSES in features/tasks/types.ts.
-- priority reuses the existing public.priority_level (low/medium/high/critical).
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM
    ('backlog', 'todo', 'in_progress', 'review', 'qa', 'done', 'blocked', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- TASKS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  status         public.task_status    NOT NULL DEFAULT 'todo',
  priority       public.priority_level NOT NULL DEFAULT 'medium',
  assignee_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,   -- subtasks cascade
  sprint_id      UUID,                                                 -- no FK yet (sprints module pending)
  -- audit fields
  created_by     UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent   ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint   ON public.tasks(sprint_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- RLS POLICIES  (mirror of projects: project-scoped membership + granular RBAC)
-- Read   = project member OR elevated role (owner / admin / project_manager)
-- Write  = project member holding the matching tasks.* permission
--          (has_permission resolves user_roles → role_permissions → permissions)
-- =========================================================================
DROP POLICY IF EXISTS "tasks_read" ON public.tasks;
CREATE POLICY "tasks_read" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.has_any_role(auth.uid(), ARRAY['owner','admin','project_manager']::public.app_role[])
  );

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(auth.uid(), project_id)
    AND public.has_permission(auth.uid(), 'tasks.create')
  );

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    AND public.has_permission(auth.uid(), 'tasks.edit')
  )
  WITH CHECK (
    public.is_project_member(auth.uid(), project_id)
    AND public.has_permission(auth.uid(), 'tasks.edit')
  );

DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    AND public.has_permission(auth.uid(), 'tasks.delete')
  );
