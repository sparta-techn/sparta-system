/**
 * Bootstrap orchestrator — SERVER ONLY.
 *
 * Provisions a brand-new SpartaFlow deployment when the database is empty:
 *   1. Owner account (auth user + profile + `owner` role)
 *   2. Company (organization identity)
 *   3. Default workspace
 *   4. Default departments
 *   5. Default roles + permissions + role→permission matrix
 * and then disables public self-registration.
 *
 * This is privileged infrastructure work: it creates auth users and writes rows
 * that RLS would (correctly) forbid from an unauthenticated context, so it runs
 * with the service-role admin client rather than the normal
 * repository → service → Supabase path. Import only from other `.server.ts`
 * modules or server entrypoints (e.g. `scripts/bootstrap.ts`); this file must
 * never reach the browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditLog } from "@/lib/logging";
import type { AppRole } from "@/features/auth/types";
import {
  DEFAULT_COMPANY_NAME,
  DEFAULT_DEPARTMENTS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_TIMEZONE,
  DEFAULT_WORKSPACE_NAME,
} from "./constants";
import type { BootstrapInput, BootstrapResult, BootstrapStatus } from "./types";

/** Relaxed handle for tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Lowercase, hyphenated, url-safe slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/** Read the platform's current bootstrap/registration state. */
export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  const { data, error } = await admin()
    .from("system_settings")
    .select("is_bootstrapped, public_registration_enabled, company_id, bootstrapped_at")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;

  return {
    isBootstrapped: Boolean(data?.is_bootstrapped),
    publicRegistrationEnabled: data?.public_registration_enabled ?? true,
    companyId: data?.company_id ?? null,
    bootstrappedAt: data?.bootstrapped_at ?? null,
  };
}

/** Page through auth users to find one by email (case-insensitive). */
async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return { id: match.id };
    if (data.users.length < 200) break;
  }
  return null;
}

/** Create (or find) the initial owner auth user and grant it the owner role. */
async function ensureOwner(input: BootstrapInput["owner"]): Promise<string> {
  const email = input.email.trim();
  const fullName = input.fullName?.trim() || email.split("@")[0];

  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName, display_name: fullName },
  });

  let userId = created.data.user?.id ?? null;
  if (created.error) {
    // Idempotent: an owner may already exist from a previous partial run.
    const existing = await findAuthUserByEmail(email);
    if (!existing) throw created.error;
    userId = existing.id;
  }
  if (!userId) throw new Error("Failed to resolve the owner user id");

  // The on-signup trigger provisions a profile + default `employee` role.
  // Promote to owner and drop the default employee grant for a clean record.
  const { error: roleError } = await admin()
    .from("user_roles")
    .upsert(
      { user_id: userId, role: "owner" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (roleError) throw roleError;

  await admin().from("user_roles").delete().eq("user_id", userId).eq("role", "employee");

  const { error: profileError } = await admin()
    .from("profiles")
    .update({ full_name: fullName, display_name: fullName, status: "active" })
    .eq("id", userId);
  if (profileError) throw profileError;

  return userId;
}

/** Upsert the default departments (by slug); returns how many are defined. */
async function ensureDepartments(ownerId: string): Promise<number> {
  const rows = DEFAULT_DEPARTMENTS.map((d) => ({
    name: d.name,
    slug: d.slug,
    description: d.description,
    created_by: ownerId,
  }));
  const { error } = await admin()
    .from("departments")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

/**
 * Ensure the permission catalog + role→permission matrix exist. Returns the
 * number of permission keys defined.
 */
async function ensurePermissions(): Promise<number> {
  const permRows = DEFAULT_PERMISSIONS.map((p) => ({
    key: p.key,
    category: p.category,
    description: p.description,
  }));
  const { error: permError } = await admin()
    .from("permissions")
    .upsert(permRows, { onConflict: "key", ignoreDuplicates: true });
  if (permError) throw permError;

  const { data: perms, error: readError } = await admin().from("permissions").select("id, key");
  if (readError) throw readError;

  const idByKey = new Map<string, string>();
  for (const p of (perms ?? []) as Array<{ id: string; key: string }>) idByKey.set(p.key, p.id);

  const matrixRows: Array<{ role: AppRole; permission_id: string }> = [];
  for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as AppRole[]) {
    for (const key of DEFAULT_ROLE_PERMISSIONS[role]) {
      const permissionId = idByKey.get(key);
      if (permissionId) matrixRows.push({ role, permission_id: permissionId });
    }
  }

  if (matrixRows.length > 0) {
    const { error: matrixError } = await admin()
      .from("role_permissions")
      .upsert(matrixRows, { onConflict: "role,permission_id", ignoreDuplicates: true });
    if (matrixError) throw matrixError;
  }

  return permRows.length;
}

/** Insert the company + its default workspace; returns both ids. */
async function ensureCompanyAndWorkspace(
  ownerId: string,
  input: BootstrapInput,
): Promise<{ companyId: string; workspaceId: string }> {
  const companyName = input.company?.name?.trim() || DEFAULT_COMPANY_NAME;
  const companySlug = input.company?.slug?.trim() || slugify(companyName);
  const timezone = input.company?.timezone?.trim() || DEFAULT_TIMEZONE;

  // Idempotent: reuse a company from a previous partial run rather than
  // colliding on the unique slug.
  const existingCompany = await admin()
    .from("companies")
    .select("id")
    .eq("slug", companySlug)
    .maybeSingle();
  if (existingCompany.error) throw existingCompany.error;

  let companyId = (existingCompany.data as { id: string } | null)?.id ?? null;
  if (!companyId) {
    const { data: company, error: companyError } = await admin()
      .from("companies")
      .insert({
        name: companyName,
        slug: companySlug,
        timezone,
        primary_owner_id: ownerId,
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (companyError) throw companyError;
    companyId = (company as { id: string }).id;
  }

  const workspaceName = input.workspace?.name?.trim() || DEFAULT_WORKSPACE_NAME;
  const workspaceSlug = input.workspace?.slug?.trim() || slugify(`${companySlug}-${workspaceName}`);

  const existingWorkspace = await admin()
    .from("workspaces")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle();
  if (existingWorkspace.error) throw existingWorkspace.error;

  let workspaceId = (existingWorkspace.data as { id: string } | null)?.id ?? null;
  if (!workspaceId) {
    const { data: workspace, error: workspaceError } = await admin()
      .from("workspaces")
      .insert({
        company_id: companyId,
        name: workspaceName,
        slug: workspaceSlug,
        is_default: true,
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (workspaceError) throw workspaceError;
    workspaceId = (workspace as { id: string }).id;
  }

  return { companyId, workspaceId };
}

/**
 * Run the one-time bootstrap. Idempotent: if the platform is already
 * bootstrapped it makes no changes and returns the existing state.
 */
export async function runBootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  if (!input.owner?.email || !input.owner?.password) {
    throw new Error("Bootstrap requires an owner email and password.");
  }

  const status = await getBootstrapStatus();
  if (status.isBootstrapped && status.companyId) {
    return {
      ownerUserId: "",
      companyId: status.companyId,
      workspaceId: "",
      departmentCount: DEFAULT_DEPARTMENTS.length,
      permissionCount: DEFAULT_PERMISSIONS.length,
      roleCount: DEFAULT_ROLES.length,
      publicRegistrationEnabled: status.publicRegistrationEnabled,
      alreadyBootstrapped: true,
    };
  }

  // 5. Default roles + permissions first, so the owner role resolves cleanly.
  const permissionCount = await ensurePermissions();

  // 1. Owner account
  const ownerUserId = await ensureOwner(input.owner);

  // 4. Default departments
  const departmentCount = await ensureDepartments(ownerUserId);

  // 2 + 3. Company and its default workspace
  const { companyId, workspaceId } = await ensureCompanyAndWorkspace(ownerUserId, input);

  // Flip platform flags: mark bootstrapped and (by default) close public signup.
  const publicRegistrationEnabled = input.disablePublicRegistration === false;
  const { error: settingsError } = await admin()
    .from("system_settings")
    .update({
      is_bootstrapped: true,
      public_registration_enabled: publicRegistrationEnabled,
      company_id: companyId,
      bootstrapped_at: new Date().toISOString(),
      bootstrapped_by: ownerUserId,
    })
    .eq("id", true);
  if (settingsError) throw settingsError;

  auditLog.record(
    {
      action: "platform.bootstrap",
      targetTable: "companies",
      targetId: companyId,
      after: {
        ownerUserId,
        workspaceId,
        departmentCount,
        permissionCount,
        roleCount: DEFAULT_ROLES.length,
        publicRegistrationEnabled,
      },
      reason: "One-time platform bootstrap completed",
    },
    { userId: ownerUserId },
  );

  return {
    ownerUserId,
    companyId,
    workspaceId,
    departmentCount,
    permissionCount,
    roleCount: DEFAULT_ROLES.length,
    publicRegistrationEnabled,
    alreadyBootstrapped: false,
  };
}
