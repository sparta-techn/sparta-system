-- =========================================================================
-- SpartaFlow — Append-only security audit log
-- Server-side home for features/audit (audit-store.ts). Every recordAudit()
-- call persists a row here. Immutable by design: authenticated users may
-- INSERT and admins/owners may SELECT — no UPDATE or DELETE is ever granted,
-- so rows are append-only and tamper-evident.
--
-- Column mapping (audit-store AuditEvent -> row):
--   id           <- event.id           (uuid, client-generated so optimistic == persisted)
--   actor_id     <- event.actorId      (auth.users.id; null for pre-auth events)
--   action       <- event.action       (login, role_changed, project_deleted, …)
--   entity_type  <- event.targetType   (employee | project | settings | role | session)
--   entity_id    <- event.target       (the object acted upon)
--   metadata     <- { actor, old_value, new_value, ip, device, meta }
--   created_at   <- event.at
-- `category` is derived from `action` on read (ACTION_CATEGORY), so it is not stored.
--
-- Conventions reused from prior migrations (20260630150000, 20260705120000):
--   * uuid PK (gen_random_uuid())     * RLS enabled; authz via public.has_any_role()
--   * grants to authenticated / service_role only — never anon
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- null for pre-auth events (failed_login)
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor      ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON public.audit_logs (entity_type, entity_id);

-- Append-only: authenticated may INSERT + SELECT (SELECT further gated by RLS);
-- crucially NO UPDATE / DELETE grant is issued, so application users can never
-- mutate or remove an existing row. service_role keeps full access for
-- server-side ingestion and retention jobs.
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL           ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: any authenticated user may append, but a row can only be attributed to
-- themselves (or left anonymous, actor_id null). No client can forge another
-- user's id. Pre-auth events (e.g. failed_login) have no session and therefore
-- do not persist here — that is intentional and matches the write-through in
-- audit-store.ts, which treats a dropped write as best-effort.
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id IS NULL OR actor_id = auth.uid());

-- SELECT: reading the audit trail is restricted to admins and owners.
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- No UPDATE or DELETE policy exists: with RLS enabled and no permissive policy
-- for those commands, every UPDATE/DELETE from `authenticated` is denied.
-- Together with the withheld grants above, the table is strictly append-only.
