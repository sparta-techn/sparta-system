import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Relaxed Supabase client view used by the generic service layer.
 *
 * Some domain tables (projects, tasks, reports, notifications, …) are not yet
 * present in the generated `Database` types. The strongly-typed `supabase`
 * client rejects unknown table names at compile time, so the generic
 * {@link BaseService} talks to this single relaxed view instead. Every loose
 * cast in the service layer is isolated to this module — feature code keeps the
 * fully-typed `supabase` client.
 */
export const db = supabase as unknown as SupabaseClient;

// Re-export the strongly-typed client for services that target real tables and
// RPCs (auth, attendance) so they keep full type-safety.
export { supabase };
