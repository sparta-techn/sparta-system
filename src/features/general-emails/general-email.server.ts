/**
 * General (broadcast) email orchestrator — SERVER ONLY.
 *
 * Turns one composed message into: a stored broadcast, one delivery row per
 * recipient, and one email each — with the outcome of every individual send
 * recorded on its own row.
 *
 * Three properties this file exists to guarantee:
 *
 *   1. **No silent failure.** Every recipient's row ends as `sent` or `failed`,
 *      and the database refuses a `failed` row without an error message. The
 *      caller gets a per-recipient result, not a single boolean.
 *   2. **One failure does not stop the send.** A bad address, a bounce, a
 *      provider hiccup — each is caught per recipient, recorded, and the loop
 *      continues. Twelve recipients with one bad address still means eleven
 *      delivered emails.
 *   3. **The body is sanitized before it is stored**, not on the way out, so
 *      nothing downstream (preview, email, history) can render raw author
 *      markup.
 *
 * Runs with the service-role client. Import ONLY from a server handler via
 * `await import(...)` — it must never reach the browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCompany } from "@/features/payroll/payslip.server";
import { ServiceError, toServiceError } from "@/services/core/errors";
import { appLog, auditLog } from "@/lib/logging";

import { renderGeneralEmail } from "./general-email";
import { isEmptyHtml, sanitizeEmailHtml } from "./sanitize-html";

/** Relaxed handle for tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface SendGeneralEmailInput {
  subject: string;
  /** Raw composer HTML — sanitized here, before anything is stored. */
  bodyHtml: string;
  recipientEmployeeIds: string[];
  /** Authenticated sender (from the JWT) — the audit actor. */
  sentByUserId: string;
}

export interface RecipientResult {
  employeeId: string;
  employeeName: string;
  email: string | null;
  status: "sent" | "failed";
  error?: string;
}

export interface SendGeneralEmailResult {
  emailId: string;
  subject: string;
  sent: number;
  failed: number;
  results: RecipientResult[];
}

interface Recipient {
  employeeId: string;
  name: string;
  email: string | null;
}

/**
 * Resolve each employee to a name and address.
 *
 * An employee with no linked account or no address is returned with a null
 * email rather than dropped — they must still get a `failed` delivery row that
 * says why, or the broadcast would silently reach fewer people than it claimed.
 */
async function resolveRecipients(employeeIds: string[]): Promise<Recipient[]> {
  const { data: employees, error } = await admin()
    .from("employees")
    .select("id, user_id")
    .in("id", employeeIds);
  if (error) throw toServiceError(error, "Couldn't load the selected employees.");

  const rows = (employees ?? []) as Array<{ id: string; user_id: string | null }>;
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));

  const profiles = new Map<string, { name: string; email: string | null }>();
  if (userIds.length > 0) {
    const { data, error: profileError } = await admin()
      .from("profiles")
      .select("id, display_name, full_name, email")
      .in("id", userIds);
    if (profileError) throw toServiceError(profileError, "Couldn't load employee profiles.");

    for (const p of (data ?? []) as Array<{
      id: string;
      display_name: string | null;
      full_name: string | null;
      email: string | null;
    }>) {
      profiles.set(p.id, {
        name: p.display_name ?? p.full_name ?? "there",
        email: p.email?.trim() || null,
      });
    }
  }

  return rows.map((r) => {
    const profile = r.user_id ? profiles.get(r.user_id) : undefined;
    return {
      employeeId: r.id,
      name: profile?.name ?? "there",
      email: profile?.email ?? null,
    };
  });
}

/** Stamp a delivery row's outcome. Never throws — see the call sites. */
async function recordOutcome(
  deliveryId: string,
  patch:
    | { status: "sent"; sent_at: string; provider_message_id: string }
    | { status: "failed"; error_message: string },
): Promise<void> {
  const { error } = await admin()
    .from("general_email_deliveries")
    .update(patch)
    .eq("id", deliveryId);
  if (error) {
    // Bookkeeping must never mask the send itself, but it must not vanish either.
    appLog.error("General email delivery outcome could not be recorded", {
      deliveryId,
      status: patch.status,
      recordError: error.message,
    });
  }
}

/**
 * Send a broadcast to the selected employees.
 *
 * The message and every delivery row are written BEFORE any email goes out, so
 * a crash mid-send leaves a truthful record: rows still `pending` are exactly
 * the people who may not have been reached.
 */
export async function sendGeneralEmail(
  input: SendGeneralEmailInput,
): Promise<SendGeneralEmailResult> {
  const { sentByUserId } = input;
  const subject = input.subject.trim();

  // Sanitize BEFORE storage — the stored body is what the preview, the email
  // and the history all render.
  const bodyHtml = sanitizeEmailHtml(input.bodyHtml);
  if (isEmptyHtml(bodyHtml)) {
    throw new ServiceError(
      "The message body is empty once formatting is removed. Write something to send.",
      "invalid_request",
    );
  }

  const employeeIds = [...new Set(input.recipientEmployeeIds)];
  if (employeeIds.length === 0) {
    throw new ServiceError("Select at least one recipient.", "invalid_request");
  }

  const recipients = await resolveRecipients(employeeIds);
  if (recipients.length === 0) {
    throw new ServiceError("None of the selected employees could be found.", "not_found");
  }

  const company = await loadCompany();

  // Pre-flight the sender domain BEFORE anything is stored or mailed. Resend
  // accepts a send from an unverified domain and only then fails delivery,
  // which would record a broadcast that never arrived. (Same guard as
  // payslip.server.ts.)
  const { ensureSenderVerified, resendEmailClient } =
    await import("@/integrations/email/resend.server");
  const client = resendEmailClient();
  await ensureSenderVerified(client, "general");

  const { data: emailRow, error: emailError } = await admin()
    .from("general_emails")
    .insert({ subject, body_html: bodyHtml, sent_by: sentByUserId })
    .select("id")
    .single();
  if (emailError) throw toServiceError(emailError, "Couldn't save the message.");
  const emailId = (emailRow as { id: string }).id;

  const { data: deliveryRows, error: deliveryError } = await admin()
    .from("general_email_deliveries")
    .insert(recipients.map((r) => ({ email_id: emailId, employee_id: r.employeeId })))
    .select("id, employee_id");
  if (deliveryError) {
    throw toServiceError(deliveryError, "Couldn't set up delivery tracking for this message.");
  }

  const deliveryIdByEmployee = new Map(
    ((deliveryRows ?? []) as Array<{ id: string; employee_id: string }>).map((d) => [
      d.employee_id,
      d.id,
    ]),
  );

  const results: RecipientResult[] = [];

  for (const recipient of recipients) {
    const deliveryId = deliveryIdByEmployee.get(recipient.employeeId);
    if (!deliveryId) continue;

    const base = {
      employeeId: recipient.employeeId,
      employeeName: recipient.name,
      email: recipient.email,
    };

    if (!recipient.email) {
      const error = "No email address on file for this employee.";
      await recordOutcome(deliveryId, { status: "failed", error_message: error });
      results.push({ ...base, status: "failed", error });
      continue;
    }

    // Every recipient is independent: one failure is recorded and the loop
    // moves on, so a single bad address cannot cost the rest of the team
    // their message.
    try {
      const rendered = renderGeneralEmail({
        subject,
        bodyHtml,
        employeeName: recipient.name,
        company,
      });

      const sent = await client.send("general", {
        to: [{ address: recipient.email, name: recipient.name }],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(company.supportEmail ? { replyTo: { address: company.supportEmail } } : {}),
        // Keyed on broadcast + recipient: a retry after a partial failure
        // replays the original accepted send rather than emailing twice.
        idempotencyKey: `general:${emailId}:${recipient.employeeId}`,
      });

      await recordOutcome(deliveryId, {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: sent.messageId,
      });
      results.push({ ...base, status: "sent" });
    } catch (cause) {
      const message = toServiceError(cause, "The email could not be sent.").message;
      await recordOutcome(deliveryId, {
        status: "failed",
        error_message: message.slice(0, 2000),
      });
      results.push({ ...base, status: "failed", error: message });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.length - sent;

  auditLog.record(
    {
      action: "hr.general_email_sent",
      targetTable: "general_emails",
      targetId: emailId,
      after: {
        subject,
        recipientCount: results.length,
        sent,
        failed,
        failedRecipients: results.filter((r) => r.status === "failed").map((r) => r.employeeName),
      },
      reason: `Sent "${subject}" to ${results.length} employee(s) — ${sent} delivered, ${failed} failed`,
    },
    { userId: sentByUserId },
  );

  return { emailId, subject, sent, failed, results };
}

export interface GeneralEmailDelivery {
  employeeId: string;
  employeeName: string;
  status: "pending" | "sent" | "failed";
  errorMessage: string | null;
  sentAt: string | null;
}

export interface GeneralEmailRecord {
  id: string;
  subject: string;
  bodyHtml: string;
  sentByName: string | null;
  createdAt: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  deliveries: GeneralEmailDelivery[];
}

/** Past broadcasts, newest first, each with its per-recipient outcomes. */
export async function listGeneralEmails(limit = 50): Promise<GeneralEmailRecord[]> {
  const { data: emails, error } = await admin()
    .from("general_emails")
    .select("id, subject, body_html, sent_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toServiceError(error, "Couldn't load sent messages.");

  const rows = (emails ?? []) as Array<{
    id: string;
    subject: string;
    body_html: string;
    sent_by: string | null;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  const { data: deliveries, error: deliveryError } = await admin()
    .from("general_email_deliveries")
    .select("email_id, employee_id, status, error_message, sent_at")
    .in(
      "email_id",
      rows.map((r) => r.id),
    );
  if (deliveryError) throw toServiceError(deliveryError, "Couldn't load delivery status.");

  const deliveryRows = (deliveries ?? []) as Array<{
    email_id: string;
    employee_id: string;
    status: "pending" | "sent" | "failed";
    error_message: string | null;
    sent_at: string | null;
  }>;

  const names = await displayNames(
    deliveryRows.map((d) => d.employee_id),
    rows.map((r) => r.sent_by),
  );

  return rows.map((r) => {
    const mine = deliveryRows.filter((d) => d.email_id === r.id);
    return {
      id: r.id,
      subject: r.subject,
      bodyHtml: r.body_html,
      sentByName: r.sent_by ? (names.users.get(r.sent_by) ?? null) : null,
      createdAt: r.created_at,
      recipientCount: mine.length,
      sentCount: mine.filter((d) => d.status === "sent").length,
      failedCount: mine.filter((d) => d.status === "failed").length,
      deliveries: mine.map((d) => ({
        employeeId: d.employee_id,
        employeeName: names.employees.get(d.employee_id) ?? "Unknown employee",
        status: d.status,
        errorMessage: d.error_message,
        sentAt: d.sent_at,
      })),
    };
  });
}

/** Display names for employees (via their profile) and for sender user ids. */
async function displayNames(
  employeeIds: string[],
  userIds: Array<string | null>,
): Promise<{ employees: Map<string, string>; users: Map<string, string> }> {
  const employees = new Map<string, string>();
  const users = new Map<string, string>();

  const uniqueEmployees = [...new Set(employeeIds)];
  const uniqueUsers = [...new Set(userIds.filter((id): id is string => Boolean(id)))];

  const employeeUserId = new Map<string, string>();
  if (uniqueEmployees.length > 0) {
    const { data } = await admin()
      .from("employees")
      .select("id, user_id")
      .in("id", uniqueEmployees);
    for (const e of (data ?? []) as Array<{ id: string; user_id: string | null }>) {
      if (e.user_id) employeeUserId.set(e.id, e.user_id);
    }
  }

  const allUserIds = [...new Set([...uniqueUsers, ...employeeUserId.values()])];
  if (allUserIds.length === 0) return { employees, users };

  const { data } = await admin()
    .from("profiles")
    .select("id, display_name, full_name")
    .in("id", allUserIds);

  const byUser = new Map<string, string>();
  for (const p of (data ?? []) as Array<{
    id: string;
    display_name: string | null;
    full_name: string | null;
  }>) {
    const name = p.display_name ?? p.full_name;
    if (name) byUser.set(p.id, name);
  }

  for (const id of uniqueUsers) {
    const name = byUser.get(id);
    if (name) users.set(id, name);
  }
  for (const [employeeId, userId] of employeeUserId) {
    const name = byUser.get(userId);
    if (name) employees.set(employeeId, name);
  }

  return { employees, users };
}
