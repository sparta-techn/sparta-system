/**
 * Payslip server RPCs — "mark as paid & send payslip" and the sent-state lookup.
 *
 * Same shape as `hr/invite.functions.ts`: behind `requireSupabaseAuth`, so the
 * acting user id comes from the verified JWT and is never passed in from the
 * client. The handler authorizes against the actor's REAL grants before
 * delegating the privileged work to `payslip.server.ts`, loaded via
 * `await import(...)` so the service-role client and the Resend key stay out of
 * the browser bundle.
 *
 * Authorization is `payroll.manage` — the same Owner/Admin/HR set that gates the
 * payroll page, checked here against the database rather than trusted from the
 * route guard (which is only a UX affordance).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toServiceError } from "@/services/core/errors";
import type { AppRole } from "@/features/auth/types";

import type { CorrectableField, CorrectionState } from "./corrections.server";
import type { ExistingDelivery, SendPayslipResult } from "./payslip.server";

/** DB roles permitted to confirm a payment and email a payslip. */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin", "hr"];

/**
 * DB roles permitted to RESTATE what someone was paid. Deliberately tighter
 * than {@link ALLOWED_ROLES} and matched to the RLS insert policy on
 * `payslip_edit_log`: HR can read correction history, but only an owner or
 * admin can create a correction.
 */
const CORRECTION_ROLES: readonly AppRole[] = ["owner", "admin"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface SendPayslipRequest {
  employeeId: string;
  from: string;
  to: string;
  periodLabel: string;
  /** Required to send again when the employee was already paid this period. */
  confirmResend?: boolean;
}

export interface LogCorrectionRequest {
  employeeId: string;
  from: string;
  to: string;
  field: CorrectableField;
  /** Money for `base_pay`, HOURS for `overtime_hours`. */
  newValue: number;
  reason: string;
}

export interface PayslipDeliveryRecord {
  employeeId: string;
  paidAt: string;
  attempt: number;
  recipientEmail: string;
  totalPay: number;
}

/** Throw unless the caller actually holds one of `allowed` (default Owner / Admin / HR). */
async function authorize(
  actorId: string,
  action: string,
  allowed: readonly AppRole[] = ALLOWED_ROLES,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SupabaseClient;

  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", actorId);
  if (error) throw toServiceError(error, "Failed to check your permissions.");

  const roles = ((data ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error(`You do not have permission to ${action}.`);
  }
}

function validatePeriod(from: unknown, to: unknown): { from: string; to: string } {
  const f = String(from ?? "").trim();
  const t = String(to ?? "").trim();
  if (!DATE_RE.test(f) || !DATE_RE.test(t)) {
    throw new Error("A valid pay period is required.");
  }
  if (t < f) throw new Error("The pay period's end date must not precede its start date.");
  return { from: f, to: t };
}

/**
 * Mark ONE employee as paid for the period and email them their payslip.
 * Deliberately single-employee and explicitly invoked — there is no bulk verb
 * here, and nothing calls this from the .xlsx export path.
 */
export const sendPayslipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SendPayslipRequest): SendPayslipRequest => {
    const employeeId = String(data?.employeeId ?? "").trim();
    if (!UUID_RE.test(employeeId)) throw new Error("A valid employee is required.");

    const { from, to } = validatePeriod(data?.from, data?.to);
    const periodLabel = String(data?.periodLabel ?? "").trim();
    if (!periodLabel) throw new Error("A pay period label is required.");

    return { employeeId, from, to, periodLabel, confirmResend: data?.confirmResend === true };
  })
  .handler(async ({ data, context }): Promise<SendPayslipResult> => {
    await authorize(context.userId, "send payslips");
    const { sendPayslip } = await import("./payslip.server");
    return sendPayslip({ ...data, sentByUserId: context.userId });
  });

/**
 * Which employees have already been marked paid for the period — drives the
 * "Paid on ..." state and the resend confirmation in the payroll table.
 */
export const listPayslipDeliveriesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { from: string; to: string }) => validatePeriod(data?.from, data?.to))
  .handler(async ({ data, context }): Promise<PayslipDeliveryRecord[]> => {
    await authorize(context.userId, "view payroll");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as SupabaseClient;

    const { data: rows, error } = await admin
      .from("payslip_deliveries")
      .select("employee_id, paid_at, attempt, recipient_email, total_pay")
      .eq("period_from", data.from)
      .eq("period_to", data.to)
      .order("attempt", { ascending: false });
    if (error) throw toServiceError(error, "Couldn't load payslip send history.");

    // Keep only the latest attempt per employee (rows arrive attempt-desc).
    const latest = new Map<string, PayslipDeliveryRecord>();
    for (const r of (rows ?? []) as Array<{
      employee_id: string;
      paid_at: string;
      attempt: number;
      recipient_email: string;
      total_pay: number;
    }>) {
      if (latest.has(r.employee_id)) continue;
      latest.set(r.employee_id, {
        employeeId: r.employee_id,
        paidAt: r.paid_at,
        attempt: r.attempt,
        recipientEmail: r.recipient_email,
        totalPay: Number(r.total_pay),
      });
    }
    return [...latest.values()];
  });

/**
 * Record a correction to an already-sent payslip.
 *
 * Logs the change only — it deliberately does NOT email anything. Telling the
 * employee about the correction is a separate, explicit "resend" click, so
 * whoever fixes a typo chooses whether it is worth a second email.
 *
 * `oldValue` is never accepted from the client: the server derives the figure
 * currently in effect so the log cannot be seeded with a fictitious starting
 * point.
 */
export const logPayslipCorrectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: LogCorrectionRequest): LogCorrectionRequest => {
    const employeeId = String(data?.employeeId ?? "").trim();
    if (!UUID_RE.test(employeeId)) throw new Error("A valid employee is required.");

    const { from, to } = validatePeriod(data?.from, data?.to);

    const field = String(data?.field ?? "");
    if (field !== "base_pay" && field !== "overtime_hours") {
      throw new Error("Only base pay and overtime hours can be corrected.");
    }

    const newValue = Number(data?.newValue);
    if (!Number.isFinite(newValue) || newValue < 0) {
      throw new Error("A valid, non-negative amount is required.");
    }

    const reason = String(data?.reason ?? "").trim();
    if (!reason) throw new Error("A reason is required for every correction.");
    if (reason.length > 500) throw new Error("Keep the reason under 500 characters.");

    return { employeeId, from, to, field, newValue, reason };
  })
  .handler(async ({ data, context }) => {
    await authorize(context.userId, "correct payslips", CORRECTION_ROLES);
    const { logCorrection } = await import("./corrections.server");
    return logCorrection({ ...data, editedByUserId: context.userId });
  });

/**
 * Correction history for the period, plus the figures currently in effect for
 * anyone with corrections that have not yet been re-sent.
 *
 * Readable by the whole payroll set (Owner / Admin / HR) — matching the RLS
 * read policy — so HR is never shown a payslip whose history is silently hidden.
 */
export const listPayslipCorrectionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { from: string; to: string }) => validatePeriod(data?.from, data?.to))
  .handler(async ({ data, context }): Promise<CorrectionState[]> => {
    await authorize(context.userId, "view payroll");
    const { correctionStates } = await import("./corrections.server");
    return correctionStates(data.from, data.to);
  });

export type { ExistingDelivery, SendPayslipResult };
export type { CorrectableField, CorrectionState, PayslipCorrection } from "./corrections.server";
