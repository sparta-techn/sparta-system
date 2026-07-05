import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { Employee, EmployeeInsert, EmployeeStatus, EmployeeUpdate } from "./types";

/**
 * EmployeesService — CRUD for the HR employment record (`public.employees`).
 *
 * One row per person, 1:1 with `profiles` via `user_id`. `manager_id` is a
 * self-referential reporting line (cycle-guarded by a DB trigger). Reads are
 * directory-scoped; writes are gated to `hr` / `admin` / `owner` by RLS.
 *
 * Distinct from the directory-facing `EmployeeRepository` in
 * `src/repositories/employee.repository.ts`, which reads the lightweight
 * `profiles` table. This service owns the richer employment record.
 */
export class EmployeesService extends BaseService<Employee, EmployeeInsert, EmployeeUpdate> {
  protected readonly table = "employees";
  protected readonly entity = "Employee";
  protected readonly defaultOrderBy = "created_at";

  /** Employees in a department. */
  listByDepartment(departmentId: string, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.list({ ...params, filters: { ...params.filters, department_id: departmentId } });
  }

  /** Employees on a team. */
  listByTeam(teamId: string, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.list({ ...params, filters: { ...params.filters, team_id: teamId } });
  }

  /** Direct reports of a manager. */
  listByManager(managerId: string, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.list({ ...params, filters: { ...params.filters, manager_id: managerId } });
  }

  /** Employees by lifecycle status. */
  listByStatus(status: EmployeeStatus, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.list({ ...params, filters: { ...params.filters, status } });
  }

  /** The employment record for a given auth user / profile id. */
  async getByUserId(userId: string): Promise<Employee | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Employee | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Resolve an employee by their unique employee code. */
  async getByCode(employeeCode: string): Promise<Employee | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("employee_code", employeeCode)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Employee | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Change an employee's lifecycle status. */
  setStatus(id: string, status: EmployeeStatus): Promise<Employee> {
    return this.update(id, { status });
  }

  /** Set (or clear with `null`) the reporting manager. Cycle-guarded in the DB. */
  assignManager(id: string, managerId: string | null): Promise<Employee> {
    return this.update(id, { manager_id: managerId });
  }

  /** Move an employee to a department (or clear with `null`). */
  setDepartment(id: string, departmentId: string | null): Promise<Employee> {
    return this.update(id, { department_id: departmentId });
  }

  /** Move an employee to a team (or clear with `null`). */
  setTeam(id: string, teamId: string | null): Promise<Employee> {
    return this.update(id, { team_id: teamId });
  }

  /** Set an employee's position (or clear with `null`). */
  setPosition(id: string, positionId: string | null): Promise<Employee> {
    return this.update(id, { position_id: positionId });
  }
}

/** Shared singleton — import this, not the class. */
export const employeesService = new EmployeesService();
