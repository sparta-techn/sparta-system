import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type {
  EmployeeCompensation,
  EmployeeCompensationInsert,
  EmployeeCompensationUpdate,
} from "./types";

/**
 * CompensationService — pay rates for the employment record
 * (`public.employee_compensation`, 1:1 with `employees`).
 *
 * Kept apart from {@link EmployeesService} because `employees` is
 * directory-readable by everyone while pay data must stay behind the
 * `payroll.view` / `payroll.manage` RLS gate. This service owns the one row per
 * employee; the payroll report reads it server-side as the source of truth.
 */
export class CompensationService extends BaseService<
  EmployeeCompensation,
  EmployeeCompensationInsert,
  EmployeeCompensationUpdate
> {
  protected readonly table = "employee_compensation";
  protected readonly entity = "Compensation";

  /** The pay row for an employee, or `null` when none has been set yet. */
  async getByEmployeeId(employeeId: string): Promise<EmployeeCompensation | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EmployeeCompensation | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /**
   * Create or update the single pay row for an employee. Upserts on the
   * `employee_id` unique constraint (not the primary key), so callers never
   * need to know whether a row already exists. Columns omitted from `patch` are
   * left untouched on an existing row and fall back to DB defaults on insert.
   */
  async setForEmployee(
    employeeId: string,
    patch: EmployeeCompensationUpdate,
  ): Promise<EmployeeCompensation> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .upsert({ employee_id: employeeId, ...patch } as never, { onConflict: "employee_id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmployeeCompensation;
    } catch (error) {
      throw toServiceError(error, `Failed to save ${this.entity}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const compensationService = new CompensationService();
