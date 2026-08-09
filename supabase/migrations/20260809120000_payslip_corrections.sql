-- =========================================================================
-- SpartaFlow — Payslip corrections: fixing a figure AFTER the payslip was sent
--
-- There is no editable "payslip" row in this system, by design. Pay figures are
-- computed by `payroll_report(_from,_to)` and `payslip_deliveries` is an
-- append-only snapshot of what an employee was ACTUALLY told, written only by
-- the server. Neither is touched here: this migration adds no column, grant, or
-- policy to `payslip_deliveries`, which stays fully immutable.
--
-- A correction is therefore recorded as its own fact, not as an edit:
--
--   1. HR logs the change here  (old → new, with a mandatory reason)
--   2. The corrected payslip is re-sent through the SAME
--      payroll_report() → sendPayslip() path as the original
--   3. That produces a NEW `payslip_deliveries` row at attempt N+1 carrying the
--      corrected figures, and this row is stamped with `applied_delivery_id`
--
-- So the delivery history remains a truthful record of every payslip actually
-- sent — the wrong one and the corrected one both survive, in order — rather
-- than one row that gets silently reinterpreted. `delivery_id` says which send
-- was wrong; `applied_delivery_id` says which send fixed it.
--
-- Also extracts the overtime rate rule out of `_overtime_pay_line` so a
-- corrected HOURS figure can be priced by the same rule (see the second half of
-- this file). That part is a pure refactor — no pay figure changes.
--
-- Regenerate integrations/supabase/types.ts after apply.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.payslip_edit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The delivery being corrected: the specific payslip whose figures were wrong.
  -- CASCADE (not RESTRICT) deliberately: `payslip_deliveries.employee_id` is
  -- itself ON DELETE CASCADE, so a RESTRICT here would block employee deletion
  -- with an opaque FK error from a child table. The correction is meaningless
  -- once the delivery it corrects is gone.
  delivery_id         UUID NOT NULL REFERENCES public.payslip_deliveries(id) ON DELETE CASCADE,

  -- Denormalised from the delivery so "every correction for this employee" needs
  -- no join. Must match the delivery's employee; enforced by the writer.
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  -- The two correctable inputs, named for the REAL `payslip_deliveries` columns
  -- so the log is self-describing against the schema it corrects.
  --
  -- `overtime_pay` is deliberately NOT correctable. The payslip email prints
  -- overtime as "<hours> approved — <pay>", so overriding the money alone would
  -- mail figures that don't reconcile. Overtime is corrected by HOURS, and the
  -- pay is recomputed from them by `overtime_pay_for_hours()` below, so the two
  -- can never disagree. `base_pay` is never shown as hours × rate, so it stays a
  -- direct override with no equivalent risk.
  field_changed       TEXT NOT NULL
                        CHECK (field_changed IN ('base_pay', 'overtime_hours')),

  -- Absolute values, not deltas. `new_value` PINS the field on resend, so a
  -- correction survives attendance being edited between the correction and the
  -- resend (which would otherwise change what payroll_report recomputes).
  -- UNIT FOLLOWS `field_changed`: money for base_pay, HOURS for overtime_hours.
  old_value           NUMERIC(12,2) NOT NULL CHECK (old_value >= 0),
  new_value           NUMERIC(12,2) NOT NULL CHECK (new_value >= 0),

  -- Every correction says why. No silent adjustments to someone's pay.
  reason              TEXT NOT NULL CHECK (length(btrim(reason)) > 0),

  edited_by           UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NULL = logged but not yet re-sent (the employee still has the wrong figure).
  -- Stamped with the resend's delivery id once the corrected payslip goes out.
  -- SET NULL rather than CASCADE: losing the corrected send must not erase the
  -- record that a correction was made.
  applied_delivery_id UUID REFERENCES public.payslip_deliveries(id) ON DELETE SET NULL,

  -- A "correction" that changes nothing is noise in an audit trail.
  CONSTRAINT payslip_edit_log_value_changed CHECK (new_value <> old_value),
  -- A correction can never be its own fix.
  CONSTRAINT payslip_edit_log_applied_is_a_resend
    CHECK (applied_delivery_id IS NULL OR applied_delivery_id <> delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_payslip_edit_log_delivery
  ON public.payslip_edit_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_payslip_edit_log_employee
  ON public.payslip_edit_log(employee_id, edited_at DESC);
-- Drives the "this payslip has corrections waiting to be re-sent" state.
CREATE INDEX IF NOT EXISTS idx_payslip_edit_log_pending
  ON public.payslip_edit_log(employee_id)
  WHERE applied_delivery_id IS NULL;

-- No UPDATE and no DELETE grant for `authenticated`: the log is append-only from
-- the client's side. `applied_delivery_id` is stamped by the send orchestrator
-- running as service_role (which bypasses RLS), so a correction's history can
-- never be rewritten from the browser — the same reasoning that keeps
-- `payslip_deliveries` server-written.
GRANT SELECT, INSERT ON public.payslip_edit_log TO authenticated;
GRANT ALL            ON public.payslip_edit_log TO service_role;
ALTER TABLE public.payslip_edit_log ENABLE ROW LEVEL SECURITY;

-- Read and write are split on purpose.
--
-- Read: payroll.view (owner / admin / hr) — EXACTLY the gate on
-- `payslip_deliveries`. Correction history is part of reading a payslip, so HR
-- keeps full visibility of the payroll page rather than seeing payslips with a
-- mysteriously empty history.
DROP POLICY IF EXISTS "payslip_edit_log_payroll_read" ON public.payslip_edit_log;
CREATE POLICY "payslip_edit_log_payroll_read" ON public.payslip_edit_log
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'payroll.view'));

-- Create: owner / admin ONLY — the same has_any_role() gate as `rewards`, and
-- deliberately tighter than the read above. HR can see corrections; only an
-- owner or admin can restate what someone was paid.
DROP POLICY IF EXISTS "payslip_edit_log_admin_insert" ON public.payslip_edit_log;
CREATE POLICY "payslip_edit_log_admin_insert" ON public.payslip_edit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- No UPDATE / DELETE policy on purpose: see the grant comment above.

COMMENT ON TABLE public.payslip_edit_log IS
  'Append-only log of corrections to already-sent payslip figures. Never edits payslip_deliveries; a correction is applied by RE-SENDING, which appends a new delivery row. delivery_id = the send that was wrong, applied_delivery_id = the send that fixed it.';
COMMENT ON COLUMN public.payslip_edit_log.new_value IS
  'Absolute corrected amount. Pins the field on resend, overriding whatever payroll_report recomputes at that moment.';
COMMENT ON COLUMN public.payslip_edit_log.applied_delivery_id IS
  'NULL while the correction is logged but not yet re-sent. Stamped by the server (service_role) with the corrected payslip delivery.';

-- =========================================================================
-- Overtime pay from corrected hours — WITHOUT a second copy of the formula
--
-- A corrected overtime figure has to be priced with the same rule the payroll
-- report uses. That rule (part-time → hourly_rate × 1.0; otherwise → the
-- salary-derived hourly rate × 1.5) currently lives inline inside
-- `_overtime_pay_line`, which prices ONE SESSION at a time and so cannot answer
-- "what is N corrected hours worth".
--
-- Rather than restate the branch in TypeScript — where it would drift from the
-- report the first time either changed — it is extracted here into
-- `_overtime_rate_for()`. `_overtime_pay_line` is rewritten to call it, so the
-- session path and the correction path are the SAME rule by construction.
-- This is a pure refactor: identical inputs still produce identical pay.
-- =========================================================================

-- The employee's effective overtime rate on a given date: base hourly + the
-- multiplier applied to it. `_ref` matters because the full-time hourly rate is
-- derived from the working days in that date's month.
CREATE OR REPLACE FUNCTION public._overtime_rate_for(
  _employee_id uuid, _ref date,
  OUT base_hourly numeric, OUT multiplier numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _slug text;
  _comp public.employee_compensation%ROWTYPE;
BEGIN
  SELECT et.slug INTO _slug
    FROM public.employees e
    LEFT JOIN public.employment_types et ON et.id = e.employment_type_id
   WHERE e.id = _employee_id;
  SELECT * INTO _comp FROM public.employee_compensation WHERE employee_id = _employee_id;

  -- Base rate + multiplier branch on employment type, with a populated-field
  -- fallback for non full/part-time types. (Moved verbatim from
  -- _overtime_pay_line — do not let these two drift.)
  IF _slug = 'part-time' OR (_comp.hourly_rate IS NOT NULL AND _comp.monthly_salary IS NULL) THEN
    base_hourly := _comp.hourly_rate;
    multiplier  := 1.0;
  ELSE
    base_hourly := public.overtime_full_time_hourly_rate(_comp.monthly_salary, _ref);
    multiplier  := 1.5;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._overtime_rate_for(uuid, date) FROM public;

-- Rewritten to source its rate from _overtime_rate_for(). Behaviour unchanged.
CREATE OR REPLACE FUNCTION public._overtime_pay_line(_session_id uuid)
RETURNS public.overtime_pay_line
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s      public.overtime_sessions%ROWTYPE;
  _comp   public.employee_compensation%ROWTYPE;
  _secs   int;
  _base   numeric;
  _mult   numeric;
  _line   public.overtime_pay_line;
BEGIN
  SELECT * INTO _s FROM public.overtime_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO _comp FROM public.employee_compensation WHERE employee_id = _s.employee_id;

  -- Worked seconds: end − start (overtime has no break tracking in v1).
  _secs := CASE
    WHEN _s.start_time IS NOT NULL AND _s.end_time IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (_s.end_time - _s.start_time))::int)
    ELSE 0 END;

  SELECT r.base_hourly, r.multiplier INTO _base, _mult
    FROM public._overtime_rate_for(_s.employee_id, _s.work_date) r;

  _line.session_id     := _s.id;
  _line.employee_id    := _s.employee_id;
  _line.work_date      := _s.work_date;
  _line.worked_seconds := _secs;
  _line.base_hourly    := _base;
  _line.multiplier     := _mult;
  -- Only APPROVED sessions ever carry a payable amount.
  _line.amount := CASE WHEN _s.status = 'approved'
                       THEN public.overtime_pay_amount(_secs, _base, _mult)
                       ELSE 0 END;
  _line.currency := COALESCE(_comp.currency, 'EGP');
  _line.status   := _s.status;
  RETURN _line;
END;
$$;
REVOKE ALL ON FUNCTION public._overtime_pay_line(uuid) FROM public;

-- What a corrected overtime figure is worth: the SAME arithmetic primitive the
-- per-session path uses (`overtime_pay_amount`), at the SAME rate
-- (`_overtime_rate_for`), just driven by a period total instead of one session.
--
-- Returns NULL when the employee has no configured rate, so the caller must
-- refuse rather than quietly mail a corrected overtime of 0.00.
--
-- Note: pricing a period total is not bit-identical to summing per-session
-- amounts, since the report rounds each session to 2dp before summing. The
-- difference is at most a few cents and only arises on a period that HAS been
-- corrected — where an operator-supplied hours figure is the intended truth.
CREATE OR REPLACE FUNCTION public.overtime_pay_for_hours(
  _employee_id uuid, _ref date, _hours numeric
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _base numeric;
  _mult numeric;
BEGIN
  PERFORM public._require_payroll_view();
  SELECT r.base_hourly, r.multiplier INTO _base, _mult
    FROM public._overtime_rate_for(_employee_id, _ref) r;
  IF _base IS NULL THEN RETURN NULL; END IF;
  RETURN public.overtime_pay_amount(
    round(GREATEST(COALESCE(_hours, 0), 0) * 3600)::int, _base, _mult);
END;
$$;
REVOKE ALL ON FUNCTION public.overtime_pay_for_hours(uuid, date, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.overtime_pay_for_hours(uuid, date, numeric) TO authenticated;

COMMENT ON FUNCTION public.overtime_pay_for_hours(uuid, date, numeric) IS
  'Prices a corrected overtime HOURS figure using the same rate and arithmetic as payroll_report. NULL when the employee has no configured pay rate.';
