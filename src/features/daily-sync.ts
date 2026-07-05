/**
 * Shared sync helpers for the daily-report cluster stores (check-in, midday,
 * eod, dependencies). They let the existing synchronous store APIs hydrate from
 * and write through to Supabase without changing any component code.
 */
import { getCurrentWorkDate } from "@/features/attendance/api";
import { supabase } from "@/integrations/supabase/client";

/** The signed-in user's id (or `null` when unauthenticated). */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** The company-timezone work date from the server (`current_work_date` RPC). */
export function resolveWorkDate(): Promise<string> {
  return getCurrentWorkDate();
}

/** A client-side `YYYY-MM-DD` used as the default cache key before the server date resolves. */
export function localWorkDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
