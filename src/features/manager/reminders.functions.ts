/**
 * `sendMissingReportRemindersFn` — client-callable server RPC that lets a
 * manager fire the "Missing Report" reminder fan-out on demand instead of
 * waiting for the daily pg_cron job.
 *
 * It mirrors `features/hr/invite.functions.ts`: it runs behind
 * `requireSupabaseAuth` so the acting user id is server-trusted (never passed
 * from the client), authorizes the actor as a reviewer role, and then delegates
 * the privileged work to the service role via the lazily-imported admin client
 * (so the admin key never enters the browser bundle).
 *
 * The actual send path is the existing SECURITY DEFINER database job
 * `public.job_missing_report_reminders()` (migration 20260707130000): it scans
 * for active employees with no submitted EOD report today and inserts inbox
 * notifications for each, plus a reviewer alert per missing employee. The job is
 * idempotent per day, so running it after the 17:30 UTC cron never
 * double-notifies. EXECUTE is granted to `service_role` in migration
 * 20260711150000.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toServiceError } from "@/services/core/errors";
import type { AppRole } from "@/features/auth/types";

/** DB roles permitted to trigger reminder fan-out (the reviewer set). */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin", "hr", "project_manager", "team_lead"];

export const sendMissingReportRemindersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const actorId = context.userId;

    // Authorize against the actor's real grants using the service role. Loaded
    // lazily so the admin client stays out of the client bundle.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as SupabaseClient;

    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId);
    if (roleError) throw toServiceError(roleError, "Failed to check your permissions.");

    const roles = ((roleRows ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
    if (!roles.some((r) => ALLOWED_ROLES.includes(r))) {
      throw new Error("You do not have permission to send reminders.");
    }

    const { error } = await admin.rpc("job_missing_report_reminders");
    if (error) throw toServiceError(error, "Failed to send reminders.");

    return { ok: true };
  });
