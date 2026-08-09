/**
 * General (broadcast) email server RPCs.
 *
 * Same shape as `payroll/payslip.functions.ts`: behind `requireSupabaseAuth`, so
 * the acting user id comes from the verified JWT and is never passed in from the
 * client. The handler authorizes against the actor's REAL grants before
 * delegating to `general-email.server.ts`, loaded via `await import(...)` so the
 * service-role client and the Resend key stay out of the browser bundle.
 *
 * Authorization is Owner / Admin — the same set the route guard and the RLS
 * policies use, checked here against the database rather than trusted from the
 * guard (which is only a UX affordance).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toServiceError } from "@/services/core/errors";
import type { AppRole } from "@/features/auth/types";

import type { GeneralEmailRecord, SendGeneralEmailResult } from "./general-email.server";

/** DB roles permitted to email the whole team. */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A broadcast is a blunt instrument — cap it well above any real team size. */
const MAX_RECIPIENTS = 500;
const MAX_SUBJECT = 200;
const MAX_BODY = 100_000;

export interface SendGeneralEmailRequest {
  subject: string;
  bodyHtml: string;
  recipientEmployeeIds: string[];
}

/** Throw unless the caller actually holds Owner / Admin. */
async function authorize(actorId: string, action: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SupabaseClient;

  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", actorId);
  if (error) throw toServiceError(error, "Failed to check your permissions.");

  const roles = ((data ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
  if (!roles.some((r) => ALLOWED_ROLES.includes(r))) {
    throw new Error(`You do not have permission to ${action}.`);
  }
}

/**
 * Compose and send one message to the selected employees.
 *
 * The body is sanitized server-side before storage — the client's sanitization
 * is for the preview only and is never trusted.
 */
export const sendGeneralEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SendGeneralEmailRequest): SendGeneralEmailRequest => {
    const subject = String(data?.subject ?? "").trim();
    if (!subject) throw new Error("A subject is required.");
    if (subject.length > MAX_SUBJECT) {
      throw new Error(`Keep the subject under ${MAX_SUBJECT} characters.`);
    }

    const bodyHtml = String(data?.bodyHtml ?? "");
    if (!bodyHtml.trim()) throw new Error("A message body is required.");
    if (bodyHtml.length > MAX_BODY) throw new Error("That message is too long to send.");

    const ids = Array.isArray(data?.recipientEmployeeIds) ? data.recipientEmployeeIds : [];
    const recipientEmployeeIds = [...new Set(ids.map((id) => String(id).trim()))];
    if (recipientEmployeeIds.length === 0) throw new Error("Select at least one recipient.");
    if (recipientEmployeeIds.some((id) => !UUID_RE.test(id))) {
      throw new Error("One of the selected recipients is not valid.");
    }
    if (recipientEmployeeIds.length > MAX_RECIPIENTS) {
      throw new Error(`A single message can go to at most ${MAX_RECIPIENTS} people.`);
    }

    return { subject, bodyHtml, recipientEmployeeIds };
  })
  .handler(async ({ data, context }): Promise<SendGeneralEmailResult> => {
    await authorize(context.userId, "send team emails");
    const { sendGeneralEmail } = await import("./general-email.server");
    return sendGeneralEmail({ ...data, sentByUserId: context.userId });
  });

/** Past broadcasts with their per-recipient delivery status. */
export const listGeneralEmailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GeneralEmailRecord[]> => {
    await authorize(context.userId, "view team emails");
    const { listGeneralEmails } = await import("./general-email.server");
    return listGeneralEmails();
  });

export type {
  GeneralEmailDelivery,
  GeneralEmailRecord,
  RecipientResult,
  SendGeneralEmailResult,
} from "./general-email.server";
