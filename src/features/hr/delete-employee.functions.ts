/**
 * `deleteEmployeeFn` — client-callable server RPC that permanently removes an
 * employee (and their underlying Supabase Auth user).
 *
 * Same shape as `inviteEmployeeFn`: it runs behind `requireSupabaseAuth`, so the
 * acting user id is server-trusted (never passed from the client). The handler
 * authorizes the actor (Owner / Admin / HR only) and then delegates the
 * privileged, service-role deletion to `employee-delete.server.ts`, loaded via
 * `await import(...)` so the admin client never enters the browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toServiceError } from "@/services/core/errors";
import type { AppRole } from "@/features/auth/types";
import type { HardDeleteEmployeeResult } from "./employee-delete.server";

/** DB roles permitted to remove employees. */
const ALLOWED_ROLES: readonly AppRole[] = ["owner", "admin", "hr"];

/** Canonical UUID — the shape of a real Supabase employee id. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DeleteEmployeeInput {
  employeeId: string;
}

export const deleteEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: DeleteEmployeeInput): DeleteEmployeeInput => {
    const employeeId = String(data?.employeeId ?? "").trim();
    if (!UUID_RE.test(employeeId)) {
      throw new Error("A valid employee id is required.");
    }
    return { employeeId };
  })
  .handler(async ({ data, context }): Promise<HardDeleteEmployeeResult> => {
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
      throw new Error("You do not have permission to remove employees.");
    }

    const { hardDeleteEmployee } = await import("./employee-delete.server");
    return hardDeleteEmployee({ employeeId: data.employeeId, actorId });
  });
