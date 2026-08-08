/**
 * Reward server RPC — "send reward email".
 *
 * Same shape as `payroll/payslip.functions.ts`: behind `requireSupabaseAuth`,
 * so the acting user id comes from the verified JWT and is never passed in from
 * the client. The handler authorizes against the actor's REAL grants before
 * delegating the privileged work to `reward.server.ts`, loaded via
 * `await import(...)` so the service-role client and the Resend key stay out of
 * the browser bundle.
 *
 * Authorization is Owner/Admin — the same role set that gates the `rewards`
 * table's RLS — checked here against the database rather than trusted from the
 * route guard (which is only a UX affordance). Reward CREATION does not need an
 * RPC: the UI inserts through `rewardsService`, where RLS enforces the same
 * roles.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toServiceError } from "@/services/core/errors";
import type { AppRole } from "@/features/auth/types";

import type { SendRewardResult } from "./reward.server";

/** DB roles permitted to send rewards — mirrors the `rewards` RLS policies. */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SendRewardRequest {
  rewardId: string;
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
 * Email ONE employee their reward and stamp the outcome on the reward row.
 * Deliberately single-reward and explicitly invoked — bulk sending is a
 * follow-up, not a v1 verb.
 */
export const sendRewardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SendRewardRequest): SendRewardRequest => {
    const rewardId = String(data?.rewardId ?? "").trim();
    if (!UUID_RE.test(rewardId)) throw new Error("A valid reward is required.");
    return { rewardId };
  })
  .handler(async ({ data, context }): Promise<SendRewardResult> => {
    await authorize(context.userId, "send rewards");
    const { sendReward } = await import("./reward.server");
    return sendReward({ rewardId: data.rewardId, sentByUserId: context.userId });
  });

export type { SendRewardResult };
