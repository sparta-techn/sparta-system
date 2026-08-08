/**
 * Payslip send orchestrator — SERVER ONLY.
 *
 * Turns one deliberate "I confirmed this transfer" click into: the authoritative
 * figures, a rendered payslip, a real email, and a durable payment record.
 *
 * Two properties this file exists to guarantee:
 *
 *   1. **One calculation.** The figures come from `payroll_report(_from,_to)` —
 *      the same RPC the .xlsx export calls — filtered to one employee. There is
 *      deliberately no second code path that could drift from the sheet.
 *   2. **No silent double-send.** `payslip_deliveries` records every send. A
 *      second send for the same employee+period is refused unless the caller
 *      explicitly confirms a resend, and the Resend idempotency key is derived
 *      from the attempt number, so a retry after a partial failure cannot mail
 *      the employee twice.
 *
 * Runs with the service-role client: `payslip_deliveries` has no INSERT policy
 * for `authenticated` on purpose (see the migration), because "paid" is an
 * assertion that real money moved. Import ONLY from a server handler via
 * `await import(...)` — it must never reach the browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ServiceError, toServiceError } from "@/services/core/errors";
import { auditLog } from "@/lib/logging";

import { renderPayslipEmail, type PayslipCompany } from "./payslip-email";
import type { PayrollLine } from "./types";

/** Relaxed handle for tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface SendPayslipInput {
  employeeId: string;
  /** Period bounds, exactly as the payroll page passes them (`YYYY-MM-DD`). */
  from: string;
  to: string;
  /** Human label for the period, e.g. "July 2026". */
  periodLabel: string;
  /** Must be true to send again when this employee was already paid this period. */
  confirmResend?: boolean;
  /** Authenticated sender (from the JWT) — the audit actor. */
  sentByUserId: string;
}

export interface SendPayslipResult {
  deliveryId: string;
  recipientEmail: string;
  attempt: number;
  paidAt: string;
  messageId: string;
  totalPay: number;
  currency: string;
}

/** A previous send for the same employee+period, if any. */
export interface ExistingDelivery {
  paidAt: string;
  attempt: number;
  recipientEmail: string;
  totalPay: number;
}

/**
 * The employee's authoritative line for the period. Reads the SAME RPC as the
 * export and picks one row — never a re-implementation of the maths.
 */
async function payrollLineFor(employeeId: string, from: string, to: string): Promise<PayrollLine> {
  const { data, error } = await supabaseAdmin.rpc("payroll_report", { _from: from, _to: to });
  if (error) throw toServiceError(error, "Couldn't calculate payroll for this period.");

  const lines = (data ?? []) as unknown as PayrollLine[];
  const line = lines.find((l) => l.employee_id === employeeId);
  if (!line) {
    throw new ServiceError(
      "This employee has no payroll line for the selected period.",
      "not_found",
    );
  }
  return line;
}

/** The employee's email address, via their profile. */
async function recipientEmailFor(employeeId: string): Promise<string> {
  const { data: employee, error: employeeError } = await admin()
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (employeeError) throw toServiceError(employeeError, "Couldn't load the employee.");

  const userId = (employee as { user_id?: string } | null)?.user_id;
  if (!userId) {
    throw new ServiceError("This employee has no linked user account.", "invalid_request");
  }

  const { data: profile, error: profileError } = await admin()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw toServiceError(profileError, "Couldn't load the employee's profile.");

  const email = (profile as { email?: string | null } | null)?.email?.trim();
  if (!email) {
    throw new ServiceError(
      "This employee has no email address on file, so a payslip can't be sent.",
      "invalid_request",
    );
  }
  return email;
}

/**
 * Org branding for the email shell. Falls back to a usable default.
 * Exported for other transactional-email senders (e.g. rewards).
 */
export async function loadCompany(): Promise<PayslipCompany> {
  const { data } = await admin()
    .from("companies")
    .select("name, logo_url, support_email")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const c = data as {
    name?: string;
    logo_url?: string | null;
    support_email?: string | null;
  } | null;
  return {
    name: c?.name ?? "SpartaFlow",
    logoUrl: c?.logo_url ?? null,
    supportEmail: c?.support_email ?? null,
  };
}

/** The most recent send for this employee+period, or null. */
export async function latestDelivery(
  employeeId: string,
  from: string,
  to: string,
): Promise<ExistingDelivery | null> {
  const { data, error } = await admin()
    .from("payslip_deliveries")
    .select("paid_at, attempt, recipient_email, total_pay")
    .eq("employee_id", employeeId)
    .eq("period_from", from)
    .eq("period_to", to)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toServiceError(error, "Couldn't check whether this payslip was already sent.");

  const row = data as {
    paid_at: string;
    attempt: number;
    recipient_email: string;
    total_pay: number;
  } | null;
  if (!row) return null;
  return {
    paidAt: row.paid_at,
    attempt: row.attempt,
    recipientEmail: row.recipient_email,
    totalPay: Number(row.total_pay),
  };
}

/**
 * Mark an employee as paid for the period and email them their payslip.
 *
 * Refuses when: the period has no line for them, no pay rate is configured, the
 * total is zero, they have no email on file, or they were already paid this
 * period and `confirmResend` was not set.
 */
export async function sendPayslip(input: SendPayslipInput): Promise<SendPayslipResult> {
  const { employeeId, from, to, periodLabel, sentByUserId } = input;

  const line = await payrollLineFor(employeeId, from, to);

  // Refuse to tell someone they were paid a number the system couldn't compute.
  if (!line.has_pay_data) {
    throw new ServiceError(
      `${line.employee_name ?? "This employee"} has no pay rate configured, so their payslip figures would be zero. Set their pay rate first.`,
      "invalid_request",
    );
  }
  if (Number(line.total_pay ?? 0) <= 0) {
    throw new ServiceError(
      `${line.employee_name ?? "This employee"}'s total for ${periodLabel} is zero — nothing to confirm as paid.`,
      "invalid_request",
    );
  }

  // Already paid this period? Only an explicit confirmation gets past here.
  const previous = await latestDelivery(employeeId, from, to);
  if (previous && !input.confirmResend) {
    throw new ServiceError(
      `${line.employee_name ?? "This employee"} was already marked paid for ${periodLabel} on ${new Date(previous.paidAt).toLocaleDateString()}. Confirm explicitly to send again.`,
      "already_sent",
    );
  }

  const attempt = (previous?.attempt ?? 0) + 1;
  const recipientEmail = await recipientEmailFor(employeeId);
  const company = await loadCompany();
  const paidAt = new Date();

  const email = renderPayslipEmail({
    line,
    periodLabel,
    company,
    paidAtLabel: paidAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  const { ensureSenderVerified, resendEmailClient } =
    await import("@/integrations/email/resend.server");
  const client = resendEmailClient();

  // Pre-flight the sender domain BEFORE anything is mailed or recorded. Resend
  // accepts a send from an unverified domain and only then fails delivery — which
  // would leave a payslip marked sent, with a real message id, that never
  // arrived, and `payslip_deliveries` would suppress the retry.
  await ensureSenderVerified(client, "payroll");

  // Send BEFORE recording, but with an idempotency key derived from the attempt
  // number: if the insert below fails and the sender retries, the same attempt
  // is recomputed, Resend recognises the key and returns the ORIGINAL message id
  // instead of mailing the employee a second time.
  const sent = await client.send("payroll", {
    to: [{ address: recipientEmail, name: line.employee_name ?? undefined }],
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(company.supportEmail ? { replyTo: { address: company.supportEmail } } : {}),
    idempotencyKey: `payslip:${employeeId}:${from}:${to}:${attempt}`,
  });

  const { data: delivery, error: insertError } = await admin()
    .from("payslip_deliveries")
    .insert({
      employee_id: employeeId,
      period_from: from,
      period_to: to,
      paid_at: paidAt.toISOString(),
      attempt,
      sent_by: sentByUserId,
      recipient_email: recipientEmail,
      currency: line.currency ?? "EGP",
      base_pay: Number(line.base_pay ?? 0),
      overtime_hours: Number(line.overtime_hours ?? 0),
      overtime_pay: Number(line.overtime_pay ?? 0),
      total_pay: Number(line.total_pay ?? 0),
      absence_days: Number(line.absence_days ?? 0),
      paid_exception_count: Number(line.paid_exception_count ?? 0),
      unpaid_exception_count: Number(line.unpaid_exception_count ?? 0),
      provider: "resend",
      provider_message_id: sent.messageId,
    })
    .select("id")
    .single();

  if (insertError) {
    // The employee HAS been emailed — say so plainly rather than let the sender
    // believe nothing happened and start over blind.
    throw new ServiceError(
      `The payslip email was sent to ${recipientEmail} (message ${sent.messageId}) but recording the payment failed: ${insertError.message}. Retry — the email will not be sent twice.`,
      "record_failed",
      insertError,
    );
  }

  const deliveryId = (delivery as { id: string }).id;

  auditLog.record(
    {
      action: "payroll.payslip_sent",
      targetTable: "payslip_deliveries",
      targetId: deliveryId,
      after: {
        employeeId,
        employeeName: line.employee_name,
        period: { from, to },
        attempt,
        recipientEmail,
        basePay: Number(line.base_pay ?? 0),
        overtimePay: Number(line.overtime_pay ?? 0),
        totalPay: Number(line.total_pay ?? 0),
        currency: line.currency,
        messageId: sent.messageId,
      },
      reason:
        attempt === 1
          ? `Marked ${line.employee_name} paid for ${periodLabel} and sent their payslip`
          : `Resent ${line.employee_name}'s ${periodLabel} payslip (attempt ${attempt})`,
    },
    { userId: sentByUserId },
  );

  return {
    deliveryId,
    recipientEmail,
    attempt,
    paidAt: paidAt.toISOString(),
    messageId: sent.messageId,
    totalPay: Number(line.total_pay ?? 0),
    currency: line.currency ?? "EGP",
  };
}
