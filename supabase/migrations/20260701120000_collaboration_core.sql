-- =========================================================================
-- SpartaFlow — Collaboration core
-- Tables: notifications, notification_preferences, mentions, activity_feed,
--         approval_requests, approval_actions
--
-- Conventions reused from the existing auth / attendance / project migrations:
--   * uuid PKs (gen_random_uuid())           * created_at / updated_at timestamptz
--   * updated_at maintained by public.tg_set_updated_at()
--   * semantic-actor FKs → public.profiles(id); soft actor → auth.users(id)
--   * RLS enabled on every table; authorization via has_any_role() /
--     is_project_member() SECURITY DEFINER helpers
--   * grants to authenticated / service_role only — never anon
--   * idempotent: IF NOT EXISTS, DROP POLICY IF EXISTS, DO-block enums
-- Depends on: profiles, projects (20260630150000), auth helpers. Cross-entity
-- references (comment/task/dependency subjects) are polymorphic
-- (source_type + source_id) with no hard FK, since those tables land later.
-- Regenerate src/integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- ENUMS (idempotent)
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM
    ('info', 'success', 'warning', 'critical', 'reminder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_priority AS ENUM
    ('low', 'normal', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_state AS ENUM
    ('unseen', 'seen', 'read', 'archived', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM
    ('attendance', 'dependencies', 'announcements', 'reports', 'mentions',
     'system', 'approvals');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mention_source AS ENUM
    ('comment', 'task', 'dependency', 'project', 'report');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_source AS ENUM
    ('task', 'dependency', 'project', 'sprint', 'report', 'membership', 'comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_type AS ENUM
    ('eod_report', 'dependency_request', 'project_membership', 'role_grant',
     'leave_request', 'timesheet', 'generic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM
    ('pending', 'approved', 'rejected', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_action_kind AS ENUM
    ('requested', 'approved', 'rejected', 'cancelled', 'commented', 'reassigned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  type         public.notification_type     NOT NULL DEFAULT 'info',
  priority     public.notification_priority NOT NULL DEFAULT 'normal',
  state        public.notification_state    NOT NULL DEFAULT 'unseen',
  category     public.notification_category NOT NULL DEFAULT 'system',
  title        TEXT NOT NULL,
  body         TEXT,
  event_name   TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  href         TEXT,
  entity_type  TEXT,
  entity_id    UUID,
  seen_at      TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  archived_at  TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unseen    ON public.notifications(recipient_id) WHERE state = 'unseen';
CREATE INDEX IF NOT EXISTS idx_notifications_entity    ON public.notifications(entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_notifications ON public.notifications;
CREATE TRIGGER set_updated_at_notifications BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Recipient reads / mutates own; may only create notifications addressed to self
-- (cross-user fan-out is done by SECURITY DEFINER functions / service_role).
DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
CREATE POLICY "notifications_read_own" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert_self" ON public.notifications;
CREATE POLICY "notifications_insert_self" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (recipient_id = auth.uid());

-- =========================================================================
-- NOTIFICATION_PREFERENCES (one row per user)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  categories  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { category: boolean }
  channels    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { channel: boolean }
  quiet_hours JSONB NOT NULL DEFAULT '{"enabled":false}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_notification_preferences ON public.notification_preferences;
CREATE TRIGGER set_updated_at_notification_preferences BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "notification_preferences_self" ON public.notification_preferences;
CREATE POLICY "notification_preferences_self" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- MENTIONS  (@user in a comment/task/dependency/…)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mentions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id          UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  source_type       public.mention_source NOT NULL,
  source_id         UUID NOT NULL,              -- logical FK to the source row
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  excerpt           TEXT,
  href              TEXT,
  seen_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentions_user    ON public.mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_unseen  ON public.mentions(mentioned_user_id) WHERE seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_source  ON public.mentions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_mentions_actor   ON public.mentions(actor_id);
CREATE INDEX IF NOT EXISTS idx_mentions_project ON public.mentions(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentions TO authenticated;
GRANT ALL ON public.mentions TO service_role;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_mentions ON public.mentions;
CREATE TRIGGER set_updated_at_mentions BEFORE UPDATE ON public.mentions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- The mentioned user and the author can read; the author creates; the mentioned
-- user marks it seen.
DROP POLICY IF EXISTS "mentions_read" ON public.mentions;
CREATE POLICY "mentions_read" ON public.mentions
  FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid() OR actor_id = auth.uid());
DROP POLICY IF EXISTS "mentions_insert_author" ON public.mentions;
CREATE POLICY "mentions_insert_author" ON public.mentions
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
DROP POLICY IF EXISTS "mentions_update_recipient" ON public.mentions;
CREATE POLICY "mentions_update_recipient" ON public.mentions
  FOR UPDATE TO authenticated
  USING (mentioned_user_id = auth.uid()) WITH CHECK (mentioned_user_id = auth.uid());
DROP POLICY IF EXISTS "mentions_delete_author" ON public.mentions;
CREATE POLICY "mentions_delete_author" ON public.mentions
  FOR DELETE TO authenticated USING (actor_id = auth.uid());

-- =========================================================================
-- ACTIVITY_FEED  (append-only unified activity stream)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  source_type public.activity_source NOT NULL,
  source_id   UUID NOT NULL,                    -- logical FK to the source row
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  summary     TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_feed_project ON public.activity_feed(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor   ON public.activity_feed(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_source  ON public.activity_feed(source_type, source_id);

-- Append-only: no UPDATE / DELETE grants.
GRANT SELECT, INSERT ON public.activity_feed TO authenticated;
GRANT ALL ON public.activity_feed TO service_role;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_activity_feed ON public.activity_feed;
CREATE TRIGGER set_updated_at_activity_feed BEFORE UPDATE ON public.activity_feed
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Readable by project members (when project-scoped), the actor, or elevated roles.
DROP POLICY IF EXISTS "activity_feed_read" ON public.activity_feed;
CREATE POLICY "activity_feed_read" ON public.activity_feed
  FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid()
    OR (project_id IS NOT NULL AND public.is_project_member(auth.uid(), project_id))
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','project_manager']::public.app_role[])
  );
DROP POLICY IF EXISTS "activity_feed_insert_actor" ON public.activity_feed;
CREATE POLICY "activity_feed_insert_actor" ON public.activity_feed
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- =========================================================================
-- APPROVAL_REQUESTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           public.approval_type   NOT NULL DEFAULT 'generic',
  status         public.approval_status NOT NULL DEFAULT 'pending',
  requester_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type    TEXT,
  entity_id      UUID,
  title          TEXT NOT NULL,
  summary        TEXT,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at         TIMESTAMPTZ,
  decided_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decision_note  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_assignee  ON public.approval_requests(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity    ON public.approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending   ON public.approval_requests(status) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_approval_requests ON public.approval_requests;
CREATE TRIGGER set_updated_at_approval_requests BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Requester, assignee (approver), or elevated roles may read.
DROP POLICY IF EXISTS "approval_requests_read" ON public.approval_requests;
CREATE POLICY "approval_requests_read" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR assignee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[])
  );
-- Requester raises their own request.
DROP POLICY IF EXISTS "approval_requests_insert_self" ON public.approval_requests;
CREATE POLICY "approval_requests_insert_self" ON public.approval_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
-- Assignee decides; requester may cancel; admins may act.
DROP POLICY IF EXISTS "approval_requests_update_party" ON public.approval_requests;
CREATE POLICY "approval_requests_update_party" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (
    assignee_id = auth.uid()
    OR requester_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[])
  )
  WITH CHECK (
    assignee_id = auth.uid()
    OR requester_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[])
  );
DROP POLICY IF EXISTS "approval_requests_delete_admin" ON public.approval_requests;
CREATE POLICY "approval_requests_delete_admin" ON public.approval_requests
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[]));

-- =========================================================================
-- APPROVAL_ACTIONS  (append-only decision/audit trail per request)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.approval_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id            UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  action              public.approval_action_kind NOT NULL,
  note                TEXT,
  meta                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_actions_request ON public.approval_actions(approval_request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approval_actions_actor   ON public.approval_actions(actor_id);

-- Append-only: no UPDATE / DELETE grants.
GRANT SELECT, INSERT ON public.approval_actions TO authenticated;
GRANT ALL ON public.approval_actions TO service_role;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_approval_actions ON public.approval_actions;
CREATE TRIGGER set_updated_at_approval_actions BEFORE UPDATE ON public.approval_actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Readable by anyone who can read the parent approval request.
DROP POLICY IF EXISTS "approval_actions_read" ON public.approval_actions;
CREATE POLICY "approval_actions_read" ON public.approval_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests ar
       WHERE ar.id = approval_request_id
         AND (
           ar.requester_id = auth.uid()
           OR ar.assignee_id = auth.uid()
           OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin','hr']::public.app_role[])
         )
    )
  );
-- The actor records their own action, and only on a request they can act on.
DROP POLICY IF EXISTS "approval_actions_insert_actor" ON public.approval_actions;
CREATE POLICY "approval_actions_insert_actor" ON public.approval_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.approval_requests ar
       WHERE ar.id = approval_request_id
         AND (
           ar.assignee_id = auth.uid()
           OR ar.requester_id = auth.uid()
           OR public.has_any_role(auth.uid(), ARRAY['owner','super_admin']::public.app_role[])
         )
    )
  );
