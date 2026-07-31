-- =========================================================================
-- SpartaFlow — Payslip deliveries (Phase 6): "mark as paid & send payslip"
--
-- The month-end payroll export (Phase 4) tells the COMPANY what to pay. This
-- table records the other half: that a real bank transfer was confirmed by a
-- human and that the employee was told so, by email.
--
-- Deliberately NOT automatic. Nothing here is written by a trigger, a cron
-- sweep, or the .xlsx export — only by the server function behind an explicit
-- per-employee click (`src/features/payroll/payslip.server.ts`). `paid_at` is
-- the record of that click, so a second click is a visible RESEND rather than
-- a silent duplicate.
--
-- Append-only history: a resend inserts a NEW row with a higher `attempt`
-- rather than updating the first one, so "when did we first tell them" and
-- "how many times did we tell them" both survive. The figures are SNAPSHOTTED
-- from `payroll_report` at send time, so the row is evidence of what the
-- employee was actually told even if attendance is edited afterwards.
--
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.payslip_deliveries (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id            UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  -- The pay period, exactly as passed to payroll_report(_from, _to).
  period_from            DATE NOT NULL,
  period_to              DATE NOT NULL,
  -- When the sender confirmed the real transfer and sent the payslip.
  paid_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 1 = first send for this employee+period; 2+ = explicitly confirmed resend.
  attempt                INT NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  sent_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email        TEXT NOT NULL,

  -- Snapshot of the figures the employee was told, straight from payroll_report.
  currency               TEXT NOT NULL DEFAULT 'EGP' CHECK (char_length(currency) = 3),
  base_pay               NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_hours         NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_pay           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_pay              NUMERIC(12,2) NOT NULL DEFAULT 0,
  absence_days           INT NOT NULL DEFAULT 0,
  paid_exception_count   INT NOT NULL DEFAULT 0,
  unpaid_exception_count INT NOT NULL DEFAULT 0,

  -- Transport receipt (Resend message id), for tracing a "I never got it" claim.
  provider               TEXT NOT NULL DEFAULT 'resend',
  provider_message_id    TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payslip_deliveries_period_order CHECK (period_to >= period_from),
  -- One row per attempt: makes a double-submit (same click, twice) a hard
  -- constraint violation rather than two identical "you were paid" emails.
  CONSTRAINT payslip_deliveries_unique_attempt UNIQUE (employee_id, period_from, period_to, attempt)
);

CREATE INDEX IF NOT EXISTS idx_payslip_deliveries_period
  ON public.payslip_deliveries(period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_payslip_deliveries_employee
  ON public.payslip_deliveries(employee_id, period_from, period_to);

GRANT SELECT ON public.payslip_deliveries TO authenticated;
GRANT ALL    ON public.payslip_deliveries TO service_role;
ALTER TABLE public.payslip_deliveries ENABLE ROW LEVEL SECURITY;

-- Read: holders of payroll.view (owner / admin / hr) — the same gate as the
-- payroll page itself, so the "Paid on ..." state is visible exactly where the
-- figures are.
DROP POLICY IF EXISTS "payslip_deliveries_payroll_read" ON public.payslip_deliveries;
CREATE POLICY "payslip_deliveries_payroll_read" ON public.payslip_deliveries
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'payroll.view'));

-- Write: NO policy for `authenticated` on purpose. "Paid" is an assertion that
-- real money moved, so it may only be recorded by the server function that
-- actually sent the email (service_role, which bypasses RLS). A client cannot
-- forge, backdate, or delete a payment record.

COMMENT ON TABLE public.payslip_deliveries IS
  'Append-only record of manually-confirmed salary payments and the payslip email sent for each. Written only by the server (service_role); never by a trigger or the payroll export.';
COMMENT ON COLUMN public.payslip_deliveries.paid_at IS
  'When a human confirmed the real bank transfer and sent the payslip. Guards against silent double-sends.';
COMMENT ON COLUMN public.payslip_deliveries.attempt IS
  '1 = first send. 2+ = a resend that required explicit confirmation in the UI.';
