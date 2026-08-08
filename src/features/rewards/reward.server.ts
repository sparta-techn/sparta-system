/**
 * Reward send orchestrator — SERVER ONLY.
 *
 * Turns one "send reward" click into: a rendered bilingual email, a real send,
 * and a durable outcome on the reward row. Mirrors `payroll/payslip.server.ts`.
 *
 * The row IS the delivery record: the UI inserts it as `pending` (RLS-gated to
 * owner/admin), then this function — running with the service-role client —
 * emails the employee and stamps the outcome:
 *
 *   success → status 'sent',   sent_at = now
 *   failure → status 'failed', error_message = the captured error, and the
 *             error is RETHROWN so the caller sees the failure too. Nothing
 *             here fails silently; the DB itself refuses a 'failed' row
 *             without an error message.
 *
 * A reward already marked 'sent' is refused — v1 has no resend. Import ONLY
 * from a server handler via `await import(...)` — it must never reach the
 * browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ServiceError, toServiceError } from "@/services/core/errors";
import { auditLog, appLog } from "@/lib/logging";
import { loadCompany } from "@/features/payroll/payslip.server";
import type { Reward } from "@/services/hr";

import { renderRewardEmail } from "./reward-email";

/** Relaxed handle for tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface SendRewardInput {
  rewardId: string;
  /** Authenticated sender (from the JWT) — the audit actor. */
  sentByUserId: string;
}

export interface SendRewardResult {
  rewardId: string;
  recipientEmail: string;
  sentAt: string;
  messageId: string;
  amount: number;
  currency: string;
}

/** The reward row, or a clear error when it doesn't exist. */
async function loadReward(rewardId: string): Promise<Reward> {
  const { data, error } = await admin()
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .maybeSingle();
  if (error) throw toServiceError(error, "Couldn't load the reward.");
  if (!data) throw new ServiceError("This reward no longer exists.", "not_found");
  return data as Reward;
}

/** The employee's email + display name, via their profile. */
async function recipientFor(employeeId: string): Promise<{ email: string; name: string }> {
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
    .select("email, display_name, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw toServiceError(profileError, "Couldn't load the employee's profile.");

  const p = profile as {
    email?: string | null;
    display_name?: string | null;
    full_name?: string | null;
  } | null;
  const email = p?.email?.trim();
  if (!email) {
    throw new ServiceError(
      "This employee has no email address on file, so the reward email can't be sent.",
      "invalid_request",
    );
  }
  return { email, name: p?.display_name?.trim() || p?.full_name?.trim() || "there" };
}

/**
 * Record a send failure on the reward row so the UI shows WHY it failed. Never
 * throws — the original send error must surface, not be masked by a bookkeeping
 * problem — but a failure to record is loudly logged, never swallowed.
 */
async function markFailed(rewardId: string, message: string): Promise<void> {
  const { error } = await admin()
    .from("rewards")
    .update({ status: "failed", error_message: message.slice(0, 2000) })
    .eq("id", rewardId);
  if (error) {
    appLog.error("Reward email failed AND the failure could not be recorded on the row", {
      rewardId,
      sendError: message,
      recordError: error.message,
    });
  }
}

/**
 * Email one employee their reward and stamp the outcome on the reward row.
 *
 * Refuses when: the reward doesn't exist, it was already sent, or the employee
 * has no email on file. A `pending` or `failed` row is sendable — retrying a
 * failure is explicitly supported.
 */
export async function sendReward(input: SendRewardInput): Promise<SendRewardResult> {
  const { rewardId, sentByUserId } = input;

  const reward = await loadReward(rewardId);
  if (reward.status === "sent") {
    throw new ServiceError(
      "This reward email was already sent. Create a new reward to send another.",
      "already_sent",
    );
  }

  const recipient = await recipientFor(reward.employee_id);
  const company = await loadCompany();

  const email = renderRewardEmail({
    employeeName: recipient.name,
    amount: Number(reward.amount),
    currency: reward.currency,
    reason: reward.reason,
    company,
    sentAtLabel: new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  const { ensureSenderVerified, resendEmailClient } =
    await import("@/integrations/email/resend.server");

  let messageId: string;
  try {
    const client = resendEmailClient();

    // Pre-flight the sender domain BEFORE sending (see payslip.server.ts):
    // Resend accepts a send from an unverified domain and only then fails
    // delivery, which would mark the reward sent when nothing arrived.
    await ensureSenderVerified(client, "rewards");

    // Idempotency key on the reward id: if the status update below fails and
    // the sender retries, Resend replays the ORIGINAL accepted send instead of
    // emailing the employee twice. (Rejected sends are not replayed, so
    // retrying a genuine failure still goes through.)
    const sent = await client.send("rewards", {
      to: [{ address: recipient.email, name: recipient.name }],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(company.supportEmail ? { replyTo: { address: company.supportEmail } } : {}),
      idempotencyKey: `reward:${rewardId}`,
    });
    messageId = sent.messageId;
  } catch (cause) {
    const serviceError = toServiceError(cause, "The reward email could not be sent.");
    await markFailed(rewardId, serviceError.message);
    throw serviceError;
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await admin()
    .from("rewards")
    .update({ status: "sent", sent_at: sentAt, error_message: null })
    .eq("id", rewardId);

  if (updateError) {
    // The employee HAS been emailed — say so plainly rather than let the sender
    // believe nothing happened and start over blind.
    throw new ServiceError(
      `The reward email was sent to ${recipient.email} (message ${messageId}) but recording it failed: ${updateError.message}. Retry — the email will not be sent twice.`,
      "record_failed",
      updateError,
    );
  }

  auditLog.record(
    {
      action: "rewards.reward_sent",
      targetTable: "rewards",
      targetId: rewardId,
      after: {
        employeeId: reward.employee_id,
        recipientEmail: recipient.email,
        amount: Number(reward.amount),
        currency: reward.currency,
        reason: reward.reason,
        messageId,
      },
      reason: `Sent ${recipient.name} a reward of ${Number(reward.amount)} ${reward.currency}`,
    },
    { userId: sentByUserId },
  );

  return {
    rewardId,
    recipientEmail: recipient.email,
    sentAt,
    messageId,
    amount: Number(reward.amount),
    currency: reward.currency,
  };
}
