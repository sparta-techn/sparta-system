-- =========================================================================
-- SpartaFlow — Server-side notification triggers
-- Persists real inbox notifications for two domain events straight from the
-- database, so they reach recipients regardless of whether the emitting client
-- ran the in-memory automation engine (features/notifications). The inbox
-- (features/notifications/store.ts) already reads `notifications` live over
-- Realtime, so a well-formed INSERT here streams to the recipient with no
-- client changes.
--
--   1. task assigned         (public.tasks.assignee_id set/changed)
--        -> notify the assignee (unless they assigned it to themselves)
--   2. daily report submitted (public.daily_reports.status -> 'submitted')
--        -> notify report reviewers (owner/admin/hr/PM/team_lead), not the author
--
-- Both handlers are SECURITY DEFINER: `notifications` RLS only lets a user
-- insert rows addressed to themselves (notifications_insert_self), so cross-user
-- fan-out must run as the definer — the exact pattern the collaboration-core
-- migration (20260701120000) reserves for it. They are AFTER triggers and
-- swallow their own errors (RAISE WARNING) so a notification failure can never
-- roll back the task/report write that triggered it.
--
-- Notification columns mirror the in-memory rules in features/notifications/
-- rules.ts (task.assigned.assignee) so server- and client-generated rows render
-- identically. `category` uses the notification_category enum values: task rows
-- fall back to 'system' (no 'tasks' member exists; the UI mapper maps unknown
-- -> system anyway), report rows use 'reports'.
--
-- Depends on: notifications, profiles, user_roles (+ app_role enum), tasks
--   (20260705120000), daily_reports (20260630130000).
-- =========================================================================

-- =========================================================================
-- 1. TASK ASSIGNED -> notify the assignee
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();  -- who performed the write (null for service_role)
BEGIN
  -- Nothing to do without an assignee.
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire when the assignee actually changed to a new person.
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  -- Don't notify someone who assigned a task to themselves (mirrors the
  -- task.assigned.assignee in-memory rule).
  IF v_actor IS NOT NULL AND NEW.assignee_id = v_actor THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, priority, category,
       title, body, event_name, href, actions, entity_type, entity_id, payload)
    VALUES (
      NEW.assignee_id,
      v_actor,
      'info',
      'high',
      'system',
      'New task assigned to you',
      COALESCE(NEW.title, 'A task was assigned to you.'),
      'task.assigned',
      '/app/tasks/' || NEW.id::text,
      jsonb_build_array(
        jsonb_build_object(
          'label', 'Open task',
          'href', '/app/tasks/' || NEW.id::text,
          'kind', 'primary'
        )
      ),
      'task',
      NEW.id,
      jsonb_build_object(
        'taskId', NEW.id,
        'title', NEW.title,
        'projectId', NEW.project_id,
        'assigneeId', NEW.assignee_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Notifications are best-effort: never break the task write.
    RAISE WARNING 'tg_notify_task_assigned failed for task %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_assigned ON public.tasks;
CREATE TRIGGER notify_task_assigned
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_task_assigned();

-- =========================================================================
-- 2. DAILY REPORT SUBMITTED -> notify reviewers
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_daily_report_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_name TEXT;
BEGIN
  -- Only the draft/…-> 'submitted' transition (or an insert already submitted).
  IF NEW.status <> 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;  -- already submitted; not a fresh submission
  END IF;

  SELECT COALESCE(p.full_name, p.display_name, p.email, 'A teammate')
    INTO v_author_name
    FROM public.profiles p
   WHERE p.id = NEW.user_id;

  BEGIN
    -- Fan out to every reviewer role (deduped), excluding the author.
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, priority, category,
       title, body, event_name, href, entity_type, entity_id, payload)
    SELECT
      r.user_id,
      NEW.user_id,
      'info',
      'normal',
      'reports',
      'Daily report submitted',
      COALESCE(v_author_name, 'A teammate') || ' submitted their end-of-day report.',
      'report.submitted',
      '/app/eod',
      'daily_report',
      NEW.id,
      jsonb_build_object(
        'reportId', NEW.id,
        'userId', NEW.user_id,
        'workDate', NEW.work_date
      )
    FROM (
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles pr ON pr.id = ur.user_id  -- ensure the recipient FK holds
      WHERE ur.role = ANY (
              ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[]
            )
        AND ur.user_id <> NEW.user_id
    ) r;
  EXCEPTION WHEN OTHERS THEN
    -- Notifications are best-effort: never break the report submission.
    RAISE WARNING 'tg_notify_daily_report_submitted failed for report %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_daily_report_submitted ON public.daily_reports;
CREATE TRIGGER notify_daily_report_submitted
  AFTER INSERT OR UPDATE OF status ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_daily_report_submitted();
