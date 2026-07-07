-- =========================================================================
-- SpartaFlow — Server-side notification triggers (extended)
-- Completes the spec's notification catalogue on top of the sibling migration
-- 20260706130000 (task assigned, daily report submitted). Every recipient
-- fan-out stays in the database so notifications land in the inbox
-- (features/notifications/store.ts reads `notifications` live over Realtime)
-- regardless of whether any client ran the in-memory automation engine.
--
--   3. New Task            (public.tasks INSERT, top-level tasks only)
--        -> project members, excluding the creator and the assignee
--           (the assignee already gets "task assigned" from the sibling trigger)
--   4. Task Updated        (public.tasks UPDATE OF status)
--        -> assignee + creator/reporter, excluding the actor
--   5. Invitation Accepted (auth.users email confirmed AND invited_at set)
--        -> reviewers (owner/admin/hr/project_manager/team_lead)
--   6. Attendance Reminder [pg_cron, daily]  -> the employee + reviewers
--   7. Missing Report      [pg_cron, daily]  -> the employee + reviewers
--
-- Types 3-5 are AFTER triggers whose fan-out INSERT is wrapped in
-- EXCEPTION WHEN OTHERS -> RAISE WARNING, exactly like the sibling migration,
-- so a notification failure can never roll back the task/auth write. All are
-- SECURITY DEFINER because notifications RLS (notifications_insert_self) only
-- lets a user insert rows addressed to themselves — cross-user fan-out must run
-- as the definer.
--
-- Types 6-7 are in-database pg_cron jobs. The payload is a pure SQL scan + INSERT
-- (no data leaves the DB), so no Edge Function / pg_net / service-role secret is
-- needed. Jobs are idempotent per day (they skip a recipient who already has the
-- same event today), so a manual re-run never double-notifies.
--
-- NOTE ON TIMEZONE: pg_cron fires in UTC. The schedules below are UTC clock
-- times; swap for a company-timezone-aware trigger when that's warranted. The
-- attendance job also skips days not in companies.working_days.
--
-- Reviewer role set is hand-rolled (owner/admin/hr/project_manager/team_lead) to
-- match the sibling migration. can_review_reports() is deliberately NOT reused:
-- its body still casts the pre-rename 'super_admin' label and would raise.
--
-- Category/type mapping onto the collaboration-core enums:
--   task rows   -> category 'system' (no 'tasks' member; UI maps unknown->system)
--   invite rows -> category 'system',     type 'success'
--   attendance  -> category 'attendance', type 'reminder' (reviewer alert 'warning')
--   report rows -> category 'reports',    type 'reminder' (reviewer alert 'warning')
--
-- Depends on: 20260706130000 (siblings), tasks (20260705120000), project_members
--   (20260630150000), daily_reports/attendance (20260630130000), profiles/
--   user_roles/handle_user_email_confirmed (20260628195254), companies.working_days
--   (20260707120000). pg_cron must be available on the project.
-- =========================================================================

-- =========================================================================
-- Shared helper: the set of users who receive reviewer-level notifications.
-- Reused by the invitation-accepted trigger and both scheduled jobs.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notification_reviewer_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles pr ON pr.id = ur.user_id   -- ensure the recipient FK holds
  WHERE ur.role = ANY (
    ARRAY['owner','admin','hr','project_manager','team_lead']::public.app_role[]
  );
$$;
REVOKE EXECUTE ON FUNCTION public.notification_reviewer_ids() FROM PUBLIC, anon;

-- =========================================================================
-- 3. NEW TASK -> notify project members (excluding creator + assignee)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_task_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  -- Subtasks are ordinary task rows; only announce top-level tasks so a task
  -- created with a checklist of subtasks doesn't spam the whole team.
  IF NEW.parent_task_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, priority, category,
       title, body, event_name, href, entity_type, entity_id, payload)
    SELECT
      pm.user_id,
      v_actor,
      'info', 'normal', 'system',
      'New task created',
      COALESCE(NEW.title, 'A new task was created.'),
      'task.created',
      '/app/tasks/' || NEW.id::text,
      'task', NEW.id,
      jsonb_build_object('taskId', NEW.id, 'title', NEW.title, 'projectId', NEW.project_id)
    FROM public.project_members pm
    WHERE pm.project_id = NEW.project_id
      AND pm.user_id IS DISTINCT FROM v_actor            -- not the creator
      AND pm.user_id IS DISTINCT FROM NEW.assignee_id    -- assignee gets task.assigned
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pm.user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_notify_task_created failed for task %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_created ON public.tasks;
CREATE TRIGGER notify_task_created
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_task_created();

-- =========================================================================
-- 4. TASK UPDATED -> notify assignee + creator on a status change
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_task_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  -- AFTER UPDATE OF status can still fire when status is unchanged.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, priority, category,
       title, body, event_name, href, entity_type, entity_id, payload)
    SELECT
      t.uid,
      v_actor,
      'info', 'normal', 'system',
      'Task status changed',
      '"' || COALESCE(NEW.title, 'A task') || '" is now ' || NEW.status::text || '.',
      'task.status_changed',
      '/app/tasks/' || NEW.id::text,
      'task', NEW.id,
      jsonb_build_object('taskId', NEW.id, 'title', NEW.title,
                         'status', NEW.status, 'projectId', NEW.project_id)
    FROM (
      SELECT DISTINCT uid
      FROM (VALUES (NEW.assignee_id), (NEW.created_by)) AS v(uid)
      WHERE uid IS NOT NULL
        AND uid IS DISTINCT FROM v_actor
    ) t
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.uid);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_notify_task_status_changed failed for task %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_status_changed ON public.tasks;
CREATE TRIGGER notify_task_status_changed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_task_status_changed();

-- =========================================================================
-- 5. INVITATION ACCEPTED -> notify reviewers
-- Cleanest hook point: the same event the existing on_auth_user_confirmed
-- trigger uses (auth.users.email_confirmed_at NULL -> non-null). We add a
-- SIBLING trigger rather than editing handle_user_email_confirmed() so the
-- notification concern stays isolated and best-effort. Guarded on invited_at
-- so ordinary self-signup email verification does NOT fire it.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_invitation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Only an admin-invited user's first confirmation counts as an acceptance.
  IF NEW.invited_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, p.display_name, p.email, NEW.email, 'A new teammate')
    INTO v_name
    FROM public.profiles p
   WHERE p.id = NEW.id;

  BEGIN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, priority, category,
       title, body, event_name, href, entity_type, entity_id, payload)
    SELECT
      r.user_id,
      NEW.id,
      'success', 'normal', 'system',
      'Invitation accepted',
      COALESCE(v_name, 'A new teammate') || ' accepted their invitation and joined.',
      'invitation.accepted',
      '/app/hr/employees',
      'user', NEW.id,
      jsonb_build_object('userId', NEW.id, 'email', NEW.email)
    FROM public.notification_reviewer_ids() AS r(user_id)
    WHERE r.user_id <> NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_notify_invitation_accepted failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_invitation_accepted ON auth.users;
CREATE TRIGGER notify_invitation_accepted
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_invitation_accepted();

-- =========================================================================
-- Scheduled-scan helpers: "who is expected to work but is missing X today".
-- Expected-to-work = an active profile holding any non-'viewer' role.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.employees_without_attendance(_work_date DATE)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = p.id AND ur.role <> 'viewer'::public.app_role)
    AND NOT EXISTS (SELECT 1 FROM public.attendance a
                     WHERE a.user_id = p.id AND a.work_date = _work_date);
$$;
REVOKE EXECUTE ON FUNCTION public.employees_without_attendance(DATE) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.employees_without_submitted_report(_work_date DATE)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = p.id AND ur.role <> 'viewer'::public.app_role)
    AND NOT EXISTS (SELECT 1 FROM public.daily_reports dr
                     WHERE dr.user_id = p.id AND dr.work_date = _work_date
                       AND dr.status = 'submitted'::public.daily_report_status);
$$;
REVOKE EXECUTE ON FUNCTION public.employees_without_submitted_report(DATE) FROM PUBLIC, anon;

-- Is today a company working day? True when unconfigured (fail-open).
CREATE OR REPLACE FUNCTION public.is_company_working_day(_d DATE)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT working_days @> ARRAY[to_char(_d, 'Dy')] FROM public.companies LIMIT 1),
    TRUE
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_company_working_day(DATE) FROM PUBLIC, anon;

-- =========================================================================
-- 6. ATTENDANCE REMINDER  (pg_cron) -> nudge employee + alert reviewers
-- =========================================================================
CREATE OR REPLACE FUNCTION public.job_attendance_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_company_working_day(CURRENT_DATE) THEN
    RETURN;
  END IF;

  -- 1. Nudge each employee who hasn't checked in (once per day).
  INSERT INTO public.notifications
    (recipient_id, actor_id, type, priority, category,
     title, body, event_name, href, entity_type, payload)
  SELECT
    m.user_id, NULL, 'reminder', 'normal', 'attendance',
    'Check-in pending',
    'You haven''t checked in yet today. Log your attendance to start your day.',
    'attendance.reminder', '/app/attendance', 'attendance',
    jsonb_build_object('workDate', CURRENT_DATE)
  FROM public.employees_without_attendance(CURRENT_DATE) AS m(user_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_id = m.user_id
      AND n.event_name = 'attendance.reminder'
      AND n.created_at::date = CURRENT_DATE
  );

  -- 2. Alert reviewers, one notification per missing employee (once per day).
  INSERT INTO public.notifications
    (recipient_id, actor_id, type, priority, category,
     title, body, event_name, href, entity_type, entity_id, payload)
  SELECT
    r.user_id, m.user_id, 'warning', 'normal', 'attendance',
    COALESCE(p.full_name, p.display_name, p.email, 'A teammate') || ' hasn''t checked in',
    'No attendance signal today. Reach out to confirm status.',
    'attendance.reminder.reviewer', '/app/attendance/team', 'attendance', m.user_id,
    jsonb_build_object('userId', m.user_id, 'workDate', CURRENT_DATE)
  FROM public.employees_without_attendance(CURRENT_DATE) AS m(user_id)
  JOIN public.profiles p ON p.id = m.user_id
  CROSS JOIN public.notification_reviewer_ids() AS r(user_id)
  WHERE r.user_id <> m.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = r.user_id
        AND n.event_name = 'attendance.reminder.reviewer'
        AND n.entity_id = m.user_id
        AND n.created_at::date = CURRENT_DATE
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.job_attendance_reminders() FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 7. MISSING REPORT  (pg_cron) -> nudge employee + alert reviewers
-- =========================================================================
CREATE OR REPLACE FUNCTION public.job_missing_report_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_company_working_day(CURRENT_DATE) THEN
    RETURN;
  END IF;

  -- 1. Nudge each employee with no submitted EOD report today (once per day).
  INSERT INTO public.notifications
    (recipient_id, actor_id, type, priority, category,
     title, body, event_name, href, entity_type, payload)
  SELECT
    m.user_id, NULL, 'reminder', 'normal', 'reports',
    'Wrap up your day',
    'Your end-of-day report is still pending. Submit it before you log off.',
    'report.missing', '/app/eod', 'daily_report',
    jsonb_build_object('workDate', CURRENT_DATE)
  FROM public.employees_without_submitted_report(CURRENT_DATE) AS m(user_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_id = m.user_id
      AND n.event_name = 'report.missing'
      AND n.created_at::date = CURRENT_DATE
  );

  -- 2. Alert reviewers, one notification per missing employee (once per day).
  INSERT INTO public.notifications
    (recipient_id, actor_id, type, priority, category,
     title, body, event_name, href, entity_type, entity_id, payload)
  SELECT
    r.user_id, m.user_id, 'warning', 'normal', 'reports',
    COALESCE(p.full_name, p.display_name, p.email, 'A teammate') || ' is missing their EOD report',
    'No end-of-day report submitted today.',
    'report.missing.reviewer', '/app/eod', 'daily_report', NULL,
    jsonb_build_object('userId', m.user_id, 'workDate', CURRENT_DATE)
  FROM public.employees_without_submitted_report(CURRENT_DATE) AS m(user_id)
  JOIN public.profiles p ON p.id = m.user_id
  CROSS JOIN public.notification_reviewer_ids() AS r(user_id)
  WHERE r.user_id <> m.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = r.user_id
        AND n.event_name = 'report.missing.reviewer'
        AND (n.payload ->> 'userId') = m.user_id::text
        AND n.created_at::date = CURRENT_DATE
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.job_missing_report_reminders() FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- SCHEDULE the two jobs with pg_cron (UTC). Idempotent: unschedule-if-exists
-- then reschedule, so re-applying the migration keeps a single job each.
-- pg_cron runs the command as the migration owner, which can call the
-- SECURITY DEFINER job functions above.
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spartaflow-attendance-reminders') THEN
    PERFORM cron.unschedule('spartaflow-attendance-reminders');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spartaflow-missing-report-reminders') THEN
    PERFORM cron.unschedule('spartaflow-missing-report-reminders');
  END IF;
END $$;

-- 10:00 UTC — after the morning check-in window has opened.
SELECT cron.schedule(
  'spartaflow-attendance-reminders',
  '0 10 * * *',
  $$SELECT public.job_attendance_reminders();$$
);

-- 17:30 UTC — end of the working day, mirrors the eod.missing in-memory rule.
SELECT cron.schedule(
  'spartaflow-missing-report-reminders',
  '30 17 * * *',
  $$SELECT public.job_missing_report_reminders();$$
);
