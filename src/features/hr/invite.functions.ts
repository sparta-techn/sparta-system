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
import { toServiceError } from "@/services/core/errors";
import type { AppRole } from "@/features/auth/types";
import type { Department, EmployeeRole } from "./mock-data";
import type { ProvisionInvitedEmployeeResult } from "./invitations.server";

/** DB roles permitted to invite employees. */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin", "hr"];

const VALID_UI_ROLES: readonly EmployeeRole[] = [
  "owner",
  "admin",
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
  /** Absolute URL GoTrue should send the invitee to (the set-password page). */
  redirectTo?: string;
}

/**
 * Where the invite email should land the invitee: the in-app set-password page.
 * Must also be present in the Supabase project's Auth → Redirect URLs allowlist,
 * otherwise GoTrue silently falls back to the Site URL.
 */
export function acceptInvitationRedirectUrl(): string | undefined {
  return typeof window !== "undefined"
    ? `${window.location.origin}/auth/accept-invitation`
    : undefined;
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
    // Only allow an absolute http(s) URL — this becomes a link in an email, so a
    // malformed/other-scheme value must never flow through to GoTrue.
    const redirectTo = data?.redirectTo?.trim() || undefined;
    if (redirectTo) {
      let ok = false;
      try {
        const u = new URL(redirectTo);
        ok = u.protocol === "https:" || u.protocol === "http:";
      } catch {
        ok = false;
      }
      if (!ok) throw new Error("A valid redirect URL is required.");
    }
    return {
      email,
      role: data.role,
      department: department as Department,
      fullName: data.fullName?.trim() || undefined,
      positionTitle: data.positionTitle?.trim() || undefined,
      redirectTo,
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
    if (roleError) throw toServiceError(roleError, "Failed to check your permissions.");

    const roles = ((roleRows ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
    if (!roles.some((r) => ALLOWED_ROLES.includes(r))) {
      throw new Error("You do not have permission to invite employees.");
    }

    const { provisionInvitedEmployee } = await import("./invitations.server");
    return provisionInvitedEmployee({ ...data, invitedByUserId: actorId });
  });
