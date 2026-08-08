-- =========================================================================
-- SpartaFlow — Rewards (v1): one-off monetary rewards with email notification
--
-- A reward row is created by an owner/admin from the UI, then the
-- send-reward-email edge function emails the employee and records the
-- outcome on the same row:
--   status 'pending' → row created, email not yet attempted
--   status 'sent'    → email delivered; sent_at stamped
--   status 'failed'  → email failed; error_message holds the captured error
--                      (never fails silently — the constraint below enforces
--                      that a failed row always carries its error).
--
-- v1 sends to ONE employee at a time. Bulk/multi-select is a follow-up.
--
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rewards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT (not CASCADE): reward history is an HR record and must not
  -- silently disappear with the employee row — deleting an employee with
  -- reward history is blocked until that history is handled explicitly.
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency      TEXT NOT NULL DEFAULT 'EGP' CHECK (char_length(currency) = 3),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  -- Captured email/provider error when status = 'failed'. A failed row MUST
  -- say why (mirrors overtime_sessions_rejection_reason).
  error_message TEXT,
  sent_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rewards_failed_requires_error
    CHECK (status <> 'failed' OR error_message IS NOT NULL),
  CONSTRAINT rewards_sent_requires_sent_at
    CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_rewards_employee   ON public.rewards(employee_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status     ON public.rewards(status);
CREATE INDEX IF NOT EXISTS idx_rewards_created_at ON public.rewards(created_at DESC);

-- No DELETE grant: reward history is an HR record; rows are never removed
-- from the client. (service_role bypasses RLS and keeps full access for the
-- send-reward-email edge function.)
GRANT SELECT, INSERT, UPDATE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Read: owner / admin only — same role gate as PROJECT_DELETE_ROLES
-- (src/services/projects/rules.ts), expressed with the standard
-- has_any_role() helper used across role-gated tables.
DROP POLICY IF EXISTS "rewards_admin_read" ON public.rewards;
CREATE POLICY "rewards_admin_read" ON public.rewards
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- Create: owner / admin only.
DROP POLICY IF EXISTS "rewards_admin_insert" ON public.rewards;
CREATE POLICY "rewards_admin_insert" ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- Update: owner / admin only (status transitions are normally written by the
-- edge function via service_role, but an admin may correct a row).
DROP POLICY IF EXISTS "rewards_admin_update" ON public.rewards;
CREATE POLICY "rewards_admin_update" ON public.rewards
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

COMMENT ON TABLE public.rewards IS
  'One-off monetary rewards sent to employees with a congratulatory email. status: pending → sent | failed; a failed row always carries error_message.';
COMMENT ON COLUMN public.rewards.error_message IS
  'Captured send error when status = failed. Enforced non-null for failed rows so failures are never silent.';
