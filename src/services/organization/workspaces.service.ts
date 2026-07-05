import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { Workspace, WorkspaceInsert, WorkspaceUpdate } from "./types";

/**
 * WorkspacesService — CRUD for company workspaces (`public.workspaces`).
 *
 * Bootstrap creates one default workspace per company; additional workspaces
 * can be added later. Writes are gated to `owner` / `admin` by RLS.
 */
export class WorkspacesService extends BaseService<Workspace, WorkspaceInsert, WorkspaceUpdate> {
  protected readonly table = "workspaces";
  protected readonly entity = "Workspace";
  protected readonly defaultOrderBy = "name";

  /** Workspaces belonging to a company (excluding archived). */
  async listByCompany(companyId: string): Promise<Workspace[]> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("company_id", companyId)
        .is("archived_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Workspace[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** The default workspace for a company, or `null` if none is flagged. */
  async getDefault(companyId: string): Promise<Workspace | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("company_id", companyId)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Workspace | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const workspacesService = new WorkspacesService();
