import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { Team, TeamInsert, TeamUpdate } from "./types";

/**
 * TeamsService — CRUD for teams (`public.teams`).
 *
 * Teams belong to a department (`department_id`) and have an optional lead
 * (`lead_id`). The table pre-exists and was extended with `lead_id`,
 * `description` and `archived_at`. Writes are gated to `hr` / `admin` /
 * `owner` by RLS.
 */
export class TeamsService extends BaseService<Team, TeamInsert, TeamUpdate> {
  protected readonly table = "teams";
  protected readonly entity = "Team";
  protected readonly defaultOrderBy = "name";

  /** Teams within a department. */
  listByDepartment(departmentId: string, params: ListParams<Team> = {}): Promise<Team[]> {
    return this.list({ ...params, filters: { ...params.filters, department_id: departmentId } });
  }

  /** Teams that have not been archived. */
  async listActive(): Promise<Team[]> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .is("archived_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Team[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** Resolve a team by its unique slug. */
  async getBySlug(slug: string): Promise<Team | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Team | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Assign (or clear with `null`) the team lead. */
  setLead(id: string, leadId: string | null): Promise<Team> {
    return this.update(id, { lead_id: leadId });
  }

  /** Soft-archive a team. */
  archive(id: string): Promise<Team> {
    return this.update(id, { archived_at: new Date().toISOString() });
  }

  /** Reverse a soft-archive. */
  restore(id: string): Promise<Team> {
    return this.update(id, { archived_at: null });
  }
}

/** Shared singleton — import this, not the class. */
export const teamsService = new TeamsService();
