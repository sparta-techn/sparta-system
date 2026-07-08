/**
 * `inviteEmployeeFn` — client-callable server RPC that issues a real employee
 * invitation.
 *
 * It runs behind the `requireSupabaseAuth` middleware, so the caller is
 * authenticated from their JWT and the acting user id is server-trusted (never
 * passed from the client). The handler authorizes the actor (Owner / Admin / HR
 * only) and then delegates the privileged, service-role work to
 * `invitations.server.ts`, which is loaded via `await import(...)` so the admin
 * client never enters the browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/features/auth/types";
import type { Department, EmployeeRole } from "./mock-data";
import type { ProvisionInvitedEmployeeResult } from "./invitations.server";

/** DB roles permitted to invite employees. */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin", "hr"];

const VALID_UI_ROLES: readonly EmployeeRole[] = [
  "owner",
  "super_admin",
  "hr",
  "manager",
  "team_lead",
  "employee",
];

export interface InviteEmployeeInput {
  email: string;
  role: EmployeeRole;
  department: Department;
  fullName?: string;
  positionTitle?: string;
}

export const inviteEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: InviteEmployeeInput): InviteEmployeeInput => {
    const email = String(data?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("A valid invitee email is required.");
    }
    if (!VALID_UI_ROLES.includes(data?.role)) {
      throw new Error("A valid role is required.");
    }
    const department = String(data?.department ?? "").trim();
    if (!department) {
      throw new Error("A department is required.");
    }
    return {
      email,
      role: data.role,
      department: department as Department,
      fullName: data.fullName?.trim() || undefined,
      positionTitle: data.positionTitle?.trim() || undefined,
    };
  })
  .handler(async ({ data, context }): Promise<ProvisionInvitedEmployeeResult> => {
    const actorId = context.userId;

    // Authorize against the actor's real grants using the service role. Loaded
    // lazily so the admin client stays out of the client bundle.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as SupabaseClient;

    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId);
    if (roleError) throw roleError;

    const roles = ((roleRows ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
    if (!roles.some((r) => ALLOWED_ROLES.includes(r))) {
      throw new Error("You do not have permission to invite employees.");
    }

    const { provisionInvitedEmployee } = await import("./invitations.server");
    return provisionInvitedEmployee({ ...data, invitedByUserId: actorId });
  });
