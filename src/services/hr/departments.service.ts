import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { Department, DepartmentInsert, DepartmentUpdate } from "./types";

/**
 * DepartmentsService — CRUD for org departments (`public.departments`).
 *
 * The table pre-exists (auth migration) and was extended with `lead_id`,
 * `description` and `archived_at`. Generic CRUD is inherited; the methods below
 * add the department-specific reads and the soft-archive lifecycle. Writes are
 * gated to `hr` / `admin` / `owner` by RLS.
 */
export class DepartmentsService extends BaseService<
  Department,
  DepartmentInsert,
  DepartmentUpdate
> {
  protected readonly table = "departments";
  protected readonly entity = "Department";
  protected readonly defaultOrderBy = "name";

  /** Departments that have not been archived. */
  async listActive(): Promise<Department[]> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .is("archived_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Department[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** Resolve a department by its unique slug. */
  async getBySlug(slug: string): Promise<Department | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Department | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Departments led by a given employee. */
  listByLead(leadId: string, params: ListParams<Department> = {}): Promise<Department[]> {
    return this.list({ ...params, filters: { ...params.filters, lead_id: leadId } });
  }

  /** Assign (or clear with `null`) the department head. */
  setLead(id: string, leadId: string | null): Promise<Department> {
    return this.update(id, { lead_id: leadId });
  }

  /** Soft-archive a department. */
  archive(id: string): Promise<Department> {
    return this.update(id, { archived_at: new Date().toISOString() });
  }

  /** Reverse a soft-archive. */
  restore(id: string): Promise<Department> {
    return this.update(id, { archived_at: null });
  }
}

/** Shared singleton — import this, not the class. */
export const departmentsService = new DepartmentsService();
