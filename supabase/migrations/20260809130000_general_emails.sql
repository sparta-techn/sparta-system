-- =========================================================================
-- SpartaFlow — General team emails (HR broadcast)
--
-- One composed message sent to a chosen set of employees, with per-recipient
-- delivery tracking. Two tables, mirroring the rewards/payslip split between
-- "the thing that happened" and "who was actually told":
--
--   general_emails            — the broadcast itself: subject + body, once
--   general_email_deliveries  — one row per recipient, carrying the outcome
--
-- Delivery status moves 'pending' → 'sent' | 'failed', and the constraints below
-- make a silent failure impossible: a 'failed' row MUST carry its error, a
-- 'sent' row MUST carry its timestamp. One recipient's failure never stops the
-- rest of the send — each row records its own fate.
--
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

-- =========================================================================
-- 1. GENERAL_EMAILS  (the broadcast)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.general_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    TEXT NOT NULL CHECK (length(btrim(subject)) > 0),
  -- Rich-text body. SANITIZED BEFORE STORAGE by the server function — this
  -- column is rendered into an email and into the composer's preview, so it is
  -- never safe to treat as trusted markup on the way out.
  body_html  TEXT NOT NULL CHECK (length(btrim(body_html)) > 0),
  sent_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_general_emails_created_at
  ON public.general_emails(created_at DESC);

-- No DELETE grant: what was sent to the team is a record, not a draft.
GRANT SELECT, INSERT, UPDATE ON public.general_emails TO authenticated;
GRANT ALL                    ON public.general_emails TO service_role;
ALTER TABLE public.general_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "general_emails_admin_read" ON public.general_emails;
CREATE POLICY "general_emails_admin_read" ON public.general_emails
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

DROP POLICY IF EXISTS "general_emails_admin_insert" ON public.general_emails;
CREATE POLICY "general_emails_admin_insert" ON public.general_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

DROP POLICY IF EXISTS "general_emails_admin_update" ON public.general_emails;
CREATE POLICY "general_emails_admin_update" ON public.general_emails
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- =========================================================================
-- 2. GENERAL_EMAIL_DELIVERIES  (per-recipient outcome)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.general_email_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CASCADE: a delivery is meaningless without the message it delivered —
  -- unlike a reward or a payslip, which is significant on its own.
  email_id      UUID NOT NULL REFERENCES public.general_emails(id) ON DELETE CASCADE,

  -- CASCADE, matching payslip_deliveries.employee_id: a broadcast receipt is
  -- not an HR record worth blocking an employee deletion over. (Contrast
  -- `rewards`, which uses RESTRICT precisely because it is one.)
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  -- Captured provider error when status = 'failed'. A failed row MUST say why.
  error_message TEXT,
  sent_at       TIMESTAMPTZ,

  -- Transport receipt (Resend message id), for tracing an "I never got it"
  -- claim down to a single recipient. Same role as
  -- payslip_deliveries.provider_message_id. Null until the send succeeds.
  provider_message_id TEXT,

  CONSTRAINT general_email_deliveries_failed_requires_error
    CHECK (status <> 'failed' OR error_message IS NOT NULL),
  CONSTRAINT general_email_deliveries_sent_requires_sent_at
    CHECK (status <> 'sent' OR sent_at IS NOT NULL),

  -- One row per recipient per broadcast: makes "selected twice" or a
  -- double-submitted send a hard constraint violation rather than two identical
  -- emails landing in someone's inbox.
  CONSTRAINT general_email_deliveries_unique_recipient UNIQUE (email_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_general_email_deliveries_email
  ON public.general_email_deliveries(email_id);
CREATE INDEX IF NOT EXISTS idx_general_email_deliveries_employee
  ON public.general_email_deliveries(employee_id);
CREATE INDEX IF NOT EXISTS idx_general_email_deliveries_status
  ON public.general_email_deliveries(status);

-- No DELETE grant: delivery outcomes are the evidence of what was sent.
GRANT SELECT, INSERT, UPDATE ON public.general_email_deliveries TO authenticated;
GRANT ALL                    ON public.general_email_deliveries TO service_role;
ALTER TABLE public.general_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "general_email_deliveries_admin_read" ON public.general_email_deliveries;
CREATE POLICY "general_email_deliveries_admin_read" ON public.general_email_deliveries
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

DROP POLICY IF EXISTS "general_email_deliveries_admin_insert" ON public.general_email_deliveries;
CREATE POLICY "general_email_deliveries_admin_insert" ON public.general_email_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- Status transitions are normally written by the send server function via
-- service_role, but an admin may correct a stuck row.
DROP POLICY IF EXISTS "general_email_deliveries_admin_update" ON public.general_email_deliveries;
CREATE POLICY "general_email_deliveries_admin_update" ON public.general_email_deliveries
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

COMMENT ON TABLE public.general_emails IS
  'HR broadcast messages sent to a chosen set of employees. body_html is sanitized by the server before storage.';
COMMENT ON TABLE public.general_email_deliveries IS
  'Per-recipient outcome for a general email. status: pending -> sent | failed; a failed row always carries error_message, a sent row always carries sent_at.';
COMMENT ON COLUMN public.general_email_deliveries.error_message IS
  'Captured send error when status = failed. Enforced non-null for failed rows so failures are never silent.';
