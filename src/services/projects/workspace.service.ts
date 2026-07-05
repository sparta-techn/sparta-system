import { supabase } from "@/integrations/supabase/client";
import type { CompanySettings } from "@/features/attendance/types";
import { toServiceError } from "../core/errors";

export type WorkspaceSettings = CompanySettings;
export type WorkspaceSettingsUpdate = Partial<
  Omit<CompanySettings, "id" | "created_at" | "updated_at">
>;

/**
 * WorkspaceService — read/update the singleton workspace configuration
 * (`company_settings`, keyed `id = true`). Reuses the live, fully-typed
 * `supabase` client (the table is in generated `Database` types) and the
 * existing {@link CompanySettings} shape so there is a single source of truth
 * shared with Attendance.
 */
export class WorkspaceService {
  /** The workspace settings singleton. */
  async get(): Promise<WorkspaceSettings> {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw toServiceError(error, "Failed to load workspace settings");
    }
  }

  /** Patch the workspace settings singleton. */
  async update(patch: WorkspaceSettingsUpdate): Promise<WorkspaceSettings> {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .update(patch as never)
        .eq("id", true)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw toServiceError(error, "Failed to update workspace settings");
    }
  }
}

/** Shared singleton — import this, not the class. */
export const workspaceService = new WorkspaceService();
