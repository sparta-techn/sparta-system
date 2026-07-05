import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { Position, PositionInsert, PositionUpdate } from "./types";

/**
 * PositionsService — CRUD for the job-title catalog (`public.positions`).
 *
 * A position is scoped to a department and flagged `is_active`. Writes are gated
 * to `hr` / `admin` / `owner` by RLS.
 */
export class PositionsService extends BaseService<Position, PositionInsert, PositionUpdate> {
  protected readonly table = "positions";
  protected readonly entity = "Position";
  protected readonly defaultOrderBy = "title";

  /** Positions within a department. */
  listByDepartment(departmentId: string, params: ListParams<Position> = {}): Promise<Position[]> {
    return this.list({ ...params, filters: { ...params.filters, department_id: departmentId } });
  }

  /** Active positions only. */
  listActive(params: ListParams<Position> = {}): Promise<Position[]> {
    return this.list({ ...params, filters: { ...params.filters, is_active: true } });
  }

  /** Resolve a position by its unique slug. */
  async getBySlug(slug: string): Promise<Position | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Position | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Activate / deactivate a position without deleting it. */
  setActive(id: string, isActive: boolean): Promise<Position> {
    return this.update(id, { is_active: isActive });
  }

  /** Soft-archive a position. */
  archive(id: string): Promise<Position> {
    return this.update(id, { archived_at: new Date().toISOString(), is_active: false });
  }
}

/** Shared singleton — import this, not the class. */
export const positionsService = new PositionsService();
