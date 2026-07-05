-- =========================================================================
-- SpartaFlow — Realtime publication
--
-- Adds the collaboration / attendance / daily-report tables to the
-- `supabase_realtime` publication so the client receives `postgres_changes`
-- events (RLS is still enforced per subscriber by the Realtime server).
--
-- REPLICA IDENTITY FULL is set so UPDATE / DELETE payloads carry the old row —
-- required for client-side filters on non-PK columns (e.g. recipient_id,
-- user_id) to match reliably on updates/deletes.
--
-- `work_sessions` / `work_session_breaks` were already added in
-- 20260628201706. `tasks` and `comments` are NOT added here — those tables do
-- not exist yet; add them in the migration that creates them.
--
-- Idempotent: each ADD TABLE is guarded against pg_publication_tables.
-- =========================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'notifications',
    'mentions',
    'activity_feed',
    'approval_requests',
    'dependency_requests',
    'daily_reports',
    'daily_status_updates',
    'attendance',
    'attendance_sessions',
    'break_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Add to the realtime publication if not already a member.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;

    -- Full replica identity so filtered UPDATE/DELETE events resolve.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
