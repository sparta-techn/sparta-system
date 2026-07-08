-- =========================================================================
-- SpartaFlow — work_sessions.user_id → profiles(id) foreign key
-- Fixes the Attendance "Team today" / dashboard "Team snapshot" load error
-- (PostgREST PGRST200: "Could not find a relationship between 'work_sessions'
-- and 'profiles' in the schema cache").
--
-- work_sessions was created (migration 20260628201706) with `user_id uuid NOT
-- NULL` but NO foreign key — only UNIQUE(user_id, work_date) + indexes. RLS ties
-- user_id to auth.uid(), so it is semantically an auth-user id, and profiles.id
-- IS auth.users.id (shared PK, 1:1). Without a declared FK, PostgREST cannot
-- resolve the embed `getTeamToday()` needs:
--   work_sessions.select("*, profile:profiles!work_sessions_user_id_fkey(...)").
--
-- Orphan check (run before authoring): every existing work_sessions.user_id has
-- a matching profiles.id, so the constraint validates cleanly with no data fix.
--
-- No ON DELETE action is declared (default NO ACTION): a session must always
-- point at a live profile, mirroring the request spec. profiles itself cascades
-- from auth.users, so user deletion is handled upstream of this row.
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_sessions_user_id_fkey'
      AND conrelid = 'public.work_sessions'::regclass
  ) THEN
    ALTER TABLE public.work_sessions
      ADD CONSTRAINT work_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id);
  END IF;
END $$;

-- Tell PostgREST to refresh its schema cache so the new relationship is
-- immediately embeddable without waiting for the periodic reload.
NOTIFY pgrst, 'reload schema';
