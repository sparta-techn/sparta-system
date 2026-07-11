/**
 * Invitation provisioning orchestrator — SERVER ONLY.
 *
 * Turns an HR "invite employee" request into real backend state:
 *   1. Creates the Supabase auth user by email via an admin **invite**
 *      (`auth.admin.inviteUserByEmail`). Because an invite stamps
 *      `auth.users.invited_at`, the `handle_new_user` trigger (a) is allowed
 *      through even when public registration is closed and (b) honors the
 *      `role` carried in user metadata — see
 *      `supabase/migrations/20260702120000_bootstrap_org_registration.sql`.
 *      The invite also emails the invitee a secure setup link.
 *   2. Lets `handle_new_user` create the `profiles` row + the default
 *      `user_roles` grant (from the invited role) inside the auth insert.
 *   3. Assigns department / role / position against the real employee tables
 *      (`departments`, `positions`, `user_roles`, `employees`).
 *
 * Like `repositories/bootstrap/bootstrap.server.ts`, this is privileged work
 * that RLS would (correctly) forbid from a normal authenticated context, so it
 * runs with the service-role admin client. Import it ONLY from a server handler
 * via `await import(...)` (see `invite.functions.ts`) — it must never reach the
 * browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ServiceError, toServiceError } from "@/services/core/errors";
import { auditLog } from "@/lib/logging";
import type { AppRole } from "@/features/auth/types";
import type { Department, EmployeeRole } from "./mock-data";

/** Relaxed handle for HR tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

/** UI role enum (mock-data) → canonical DB `app_role`. */
const ROLE_TO_APP_ROLE: Record<EmployeeRole, AppRole> = {
  owner: "owner",
  admin: "admin",
  hr: "hr",
  manager: "project_manager",
  team_lead: "team_lead",
  employee: "employee",
};

export interface ProvisionInvitedEmployeeInput {
  email: string;
  fullName?: string;
  role: EmployeeRole;
  department: Department;
  /** Optional position/job title to attach (resolved against `positions.title`). */
  positionTitle?: string;
  /** Authenticated inviter (from the JWT) — the audit actor. */
  invitedByUserId: string;
  /** Absolute URL the invite email should send the invitee to. */
  redirectTo?: string;
}

export interface ProvisionInvitedEmployeeResult {
  userId: string;
  employeeId: string;
  appRole: AppRole;
  /** Whether the named department/position resolved to a real row. */
  departmentResolved: boolean;
  positionResolved: boolean;
  /** Server-derived actor identity for client-side audit attribution. */
  actor: { id: string; name: string };
}

/** Page through auth users to find one by email (re-invite / partial-run path). */
async function findAuthUserByEmail(
  email: string,
): Promise<{ id: string; emailConfirmedAt: string | null } | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw toServiceError(error, "Failed to look up existing users.");
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return { id: match.id, emailConfirmedAt: match.email_confirmed_at ?? null };
    if (data.users.length < 200) break;
  }
  return null;
}

/** Resolve a department row id by (case-insensitive) name. */
async function resolveDepartmentId(name: string): Promise<string | null> {
  const { data, error } = await admin()
    .from("departments")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();
  if (error) throw toServiceError(error, "Failed to resolve the department.");
  return (data as { id: string } | null)?.id ?? null;
}

/** Resolve a position row id by (case-insensitive) title, optional dept scope. */
async function resolvePositionId(
  title: string,
  departmentId: string | null,
): Promise<string | null> {
  let query = admin().from("positions").select("id").ilike("title", title.trim());
  if (departmentId) query = query.eq("department_id", departmentId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw toServiceError(error, "Failed to resolve the position.");
  return (data as { id: string } | null)?.id ?? null;
}

/** Read the inviter's display name for audit attribution. */
async function resolveActorName(userId: string): Promise<string> {
  const { data, error } = await admin()
    .from("profiles")
    .select("full_name, display_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw toServiceError(error, "Failed to resolve the inviting user.");
  const p = data as { full_name?: string; display_name?: string; email?: string } | null;
  return p?.full_name || p?.display_name || p?.email || "Unknown";
}

/**
 * True when `inviteUserByEmail` failed *specifically* because the email is already
 * registered. That is the ONLY failure we recover from (by re-inviting a pending
 * invitee — see the handler). Every other error must fail visibly — most
 * importantly a mailer/SMTP send failure, which GoTrue returns as a 500 *after* it
 * has already created the `auth.users` row. If we treated that as "already
 * registered", we'd proceed and report success for an invite whose email was never
 * delivered (the "success but no email" bug).
 */
function isAlreadyRegisteredError(cause: unknown): boolean {
  const err = cause as { code?: string; status?: number; message?: string } | null;
  if (err?.code === "email_exists" || err?.code === "user_already_exists") return true;
  const message = err?.message?.toLowerCase() ?? "";
  return (
    err?.status === 422 &&
    (message.includes("already been registered") ||
      message.includes("already registered") ||
      message.includes("already exists"))
  );
}

/**
 * Turn a failed `inviteUserByEmail` into an actionable error. The dominant cause
 * is the project's email/SMTP not being configured (or rate-limited): GoTrue
 * returns a 500 with an empty body, which supabase-js surfaces as an
 * `AuthRetryableFetchError` whose `.message` is `{}`. Say that plainly instead.
 * The `invalid_request` code makes `getErrorMessage` (see `@/lib/errors`) surface
 * this authored message verbatim to the admin rather than a generic fallback.
 */
function emailInviteError(cause: unknown): ServiceError {
  const status = (cause as { status?: number } | null)?.status;
  const name = (cause as { name?: string } | null)?.name;
  const isSendFailure =
    name === "AuthRetryableFetchError" || (typeof status === "number" && status >= 500);
  if (isSendFailure) {
    return new ServiceError(
      "Couldn't send the invitation email — check the email/SMTP configuration in Supabase Auth settings.",
      "invalid_request",
      cause,
    );
  }
  // Other failures (e.g. an invalid email address) already carry a usable message.
  return toServiceError(cause, "Couldn't invite this employee.");
}

/**
 * Provision a freshly-invited employee end-to-end. Idempotent on re-invite:
 * an existing auth user is reused and the employee row is upserted on `user_id`.
 */
export async function provisionInvitedEmployee(
  input: ProvisionInvitedEmployeeInput,
): Promise<ProvisionInvitedEmployeeResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("An invitee email is required.");

  const appRole = ROLE_TO_APP_ROLE[input.role];
  if (!appRole) throw new Error(`Unknown role: ${input.role}`);

  const fullName = input.fullName?.trim() || email.split("@")[0];

  // 1. Create the auth user via an admin invite. `invited_at` is set, so
  //    handle_new_user honors the role metadata and bypasses the signup gate,
  //    and Supabase emails the setup link.
  const inviteOptions = {
    data: { full_name: fullName, display_name: fullName, role: appRole },
    // Land the invitee directly on the set-password page (which has no route
    // guard), so the token is exchanged there instead of bouncing through the
    // root/dashboard flow — where a missing session redirects them to sign-in.
    ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
  };
  const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOptions);

  let userId = invited.data.user?.id ?? null;
  if (invited.error) {
    // A non-"already registered" error is a real failure (most importantly a
    // mailer/SMTP send failure, which GoTrue returns *after* creating the user
    // row) — fail visibly.
    if (!isAlreadyRegisteredError(invited.error)) {
      throw emailInviteError(invited.error);
    }
    // The address already has an auth user. `inviteUserByEmail` only emails on
    // user *creation* and there is no admin "re-send invite" call, so a plain
    // reuse would report success for an email that never went out (the original
    // "success but no email" bug). Instead:
    //   • already accepted (email confirmed) → do NOT touch the live account;
    //     surface that they already have access.
    //   • still pending (never accepted) → delete the stub (its profile/role/
    //     employee rows are ON DELETE CASCADE) and invite again, which sends a
    //     fresh setup email.
    const existing = await findAuthUserByEmail(email);
    if (!existing) throw emailInviteError(invited.error);
    if (existing.id === input.invitedByUserId) {
      throw new ServiceError("You can't invite your own account.", "invalid_request");
    }
    if (existing.emailConfirmedAt) {
      throw new ServiceError(
        `${email} has already accepted an invitation and has an active account.`,
        "invalid_request",
      );
    }
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existing.id);
    if (deleteError) {
      throw toServiceError(deleteError, "Couldn't refresh the pending invitation to resend it.");
    }
    const reinvited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (reinvited.error) throw emailInviteError(reinvited.error);
    userId = reinvited.data.user?.id ?? null;
  }
  if (!userId) throw new Error("Failed to resolve the invited user id.");

  // 2. handle_new_user has created the profile + a default role grant from the
  //    invite metadata. Defensively ensure the requested role is present (covers
  //    the re-invite path where the trigger did not re-run).
  const { error: roleError } = await admin()
    .from("user_roles")
    .upsert(
      { user_id: userId, role: appRole },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (roleError) throw toServiceError(roleError, "Failed to assign the employee's role.");

  // 3. Assign department / position via the real employee tables.
  const departmentId = await resolveDepartmentId(input.department);
  const positionId = input.positionTitle
    ? await resolvePositionId(input.positionTitle, departmentId)
    : null;

  const { data: employee, error: employeeError } = await admin()
    .from("employees")
    .upsert(
      {
        user_id: userId,
        department_id: departmentId,
        position_id: positionId,
        status: "invited",
        created_by: input.invitedByUserId,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (employeeError) throw toServiceError(employeeError, "Failed to create the employee record.");
  const employeeId = (employee as { id: string }).id;

  const actor = { id: input.invitedByUserId, name: await resolveActorName(input.invitedByUserId) };

  auditLog.record(
    {
      action: "employee.invited",
      targetTable: "employees",
      targetId: employeeId,
      after: { userId, email, appRole, departmentId, positionId },
      reason: `Invited ${email} as ${appRole}`,
    },
    { userId: input.invitedByUserId },
  );

  return {
    userId,
    employeeId,
    appRole,
    departmentResolved: departmentId !== null,
    positionResolved: positionId !== null,
    actor,
  };
}
