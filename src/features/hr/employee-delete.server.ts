/**
 * Employee hard-delete orchestrator — SERVER ONLY.
 *
 * Permanently removes an employee by deleting the underlying Supabase Auth
 * user. The schema's `ON DELETE CASCADE` chain then removes everything keyed off
 * that user in one shot:
 *
 *   employees.user_id → profiles(id)   ON DELETE CASCADE
 *   profiles.id       → auth.users(id) ON DELETE CASCADE
 *   user_roles.user_id→ auth.users(id) ON DELETE CASCADE
 *
 * This is what makes a later re-invite to the same email a genuinely fresh
 * invite (`inviteUserByEmail` succeeds and sends), instead of silently hitting
 * the "email already registered" reuse path that sends no email.
 *
 * Irreversible — unlike the former soft-delete, there is no restore. Privileged
 * work that RLS would forbid, so it runs with the service-role admin client and
 * must never reach the browser bundle (import via `await import(...)`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ServiceError, toServiceError } from "@/services/core/errors";
import { auditLog } from "@/lib/logging";
import type { AppRole } from "@/features/auth/types";

/** Relaxed handle for HR tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface HardDeleteEmployeeInput {
  employeeId: string;
  /** Authenticated actor (from the JWT) — the audit actor and self-delete guard. */
  actorId: string;
}

export interface HardDeleteEmployeeResult {
  userId: string;
}

/**
 * Delete the auth user behind `employeeId`, cascading away their profile, roles
 * and employee row. Guards against removing yourself or the organization owner.
 */
export async function hardDeleteEmployee(
  input: HardDeleteEmployeeInput,
): Promise<HardDeleteEmployeeResult> {
  // Resolve the employee → its auth user id.
  const { data: emp, error: empError } = await admin()
    .from("employees")
    .select("user_id")
    .eq("id", input.employeeId)
    .maybeSingle();
  if (empError) throw toServiceError(empError, "Failed to look up the employee.");
  const userId = (emp as { user_id: string } | null)?.user_id ?? null;
  if (!userId) throw new ServiceError("That employee no longer exists.", "not_found");

  // Guard rails on an irreversible action.
  if (userId === input.actorId) {
    throw new ServiceError("You can't remove your own account.", "invalid_request");
  }
  const { data: targetRoles, error: rolesError } = await admin()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw toServiceError(rolesError, "Failed to check the employee's roles.");
  const isOwner = ((targetRoles ?? []) as Array<{ role: AppRole }>).some((r) => r.role === "owner");
  if (isOwner) {
    throw new ServiceError("The organization owner can't be removed.", "invalid_request");
  }

  // Delete the auth user → cascades to profiles / user_roles / employees.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) throw toServiceError(deleteError, "Failed to remove the employee's account.");

  auditLog.record(
    {
      action: "employee.deleted",
      targetTable: "employees",
      targetId: input.employeeId,
      before: { userId },
      reason: `Hard-deleted employee ${input.employeeId} (auth user ${userId})`,
    },
    { userId: input.actorId },
  );

  return { userId };
}
