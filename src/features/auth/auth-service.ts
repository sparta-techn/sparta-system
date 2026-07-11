import { supabase } from "@/integrations/supabase/client";
import { db } from "@/services/core";
import { recordAudit } from "@/features/audit/audit-store";
import { employmentTypeSlug } from "@/features/hr/employment-type";
import type { AppRole, Profile } from "./types";

const SITE_ORIGIN = () => (typeof window !== "undefined" ? window.location.origin : "");

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const trimmed = email.trim();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) {
    // Pre-auth event: attribute to the attempted email, no actor id.
    recordAudit({
      action: "failed_login",
      actor: trimmed,
      actorId: null,
      target: trimmed,
      targetType: "session",
      newValue: error.message,
    });
    throw error;
  }
  recordAudit({
    action: "login",
    actor: trimmed,
    actorId: data.user?.id ?? null,
    target: trimmed,
    targetType: "session",
  });
}

export async function signOut(): Promise<void> {
  recordAudit({ action: "logout", target: "session", targetType: "session" });
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${SITE_ORIGIN()}/auth/reset-password`,
  });
  if (error) throw error;
}

/**
 * Used by both invitation acceptance and password reset.
 * The Supabase session is already established by the auth callback that the
 * email link triggers, so a plain `updateUser` is sufficient and safe.
 */
export async function updatePassword(
  newPassword: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    ...(metadata ? { data: metadata } : {}),
  });
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,display_name,avatar_url,job_title,department_id,team_id,status,timezone,locale",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as AppRole);
}

/**
 * The signed-in user's employment type slug (`full-time` / `part-time` / …), or
 * `null` when they have no employee record or none is set. Drives the daily
 * workflow differences (attendance target, midday requirement) via the helpers
 * in `@/features/hr/employment-type`. Uses the relaxed `db` client because
 * `employees` / `employment_types` are not in the generated Supabase types.
 */
export async function fetchEmploymentType(userId: string): Promise<string | null> {
  const { data, error } = await db
    .from("employees")
    .select("employment_type:employment_types ( slug )")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const embed = (data as { employment_type: { slug: string } | { slug: string }[] | null } | null)
    ?.employment_type;
  const row = Array.isArray(embed) ? (embed[0] ?? null) : embed;
  return employmentTypeSlug(row?.slug);
}
