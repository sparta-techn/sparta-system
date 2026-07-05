import type { AppRole, EmployeeStatus, Profile } from "@/features/auth/types";
import { AuthService, authService } from "@/services/auth";
import type { ListParams } from "@/services/core";

export type EmployeeInsert = Partial<Profile> & { id: string; email: string };
export type EmployeeUpdate = Partial<Profile>;

/**
 * EmployeeRepository — directory operations over the canonical employee record
 * (the `profiles` table). Delegates to {@link AuthService}, which owns
 * `profiles` CRUD; this repository frames it in HR/people terms (by department,
 * by team, status changes) and resolves roles.
 *
 * The `HrEmployee` mock shape in `features/hr` is unaffected — repositories are
 * additive and the UI continues to read its mock stores.
 */
export class EmployeeRepository {
  constructor(private readonly service: AuthService = authService) {}

  /** All employees (profiles), ordered by name. */
  list(params: ListParams<Profile> = {}): Promise<Profile[]> {
    return this.service.list(params);
  }

  /** A single employee by id, or `null`. */
  getById(id: string): Promise<Profile | null> {
    return this.service.getById(id);
  }

  /** A single employee by id, throwing if absent. */
  getByIdOrThrow(id: string): Promise<Profile> {
    return this.service.getByIdOrThrow(id);
  }

  /** Look an employee up by email. */
  async getByEmail(email: string): Promise<Profile | null> {
    const [match] = await this.service.list({
      filters: { email: email.trim() },
      limit: 1,
    });
    return match ?? null;
  }

  /** Employees in a department. */
  listByDepartment(departmentId: string, params: ListParams<Profile> = {}): Promise<Profile[]> {
    return this.service.list({
      ...params,
      filters: { ...params.filters, department_id: departmentId },
    });
  }

  /** Employees on a team. */
  listByTeam(teamId: string, params: ListParams<Profile> = {}): Promise<Profile[]> {
    return this.service.list({
      ...params,
      filters: { ...params.filters, team_id: teamId },
    });
  }

  /** Employees by lifecycle status (active / invited / suspended / offboarded). */
  listByStatus(status: EmployeeStatus, params: ListParams<Profile> = {}): Promise<Profile[]> {
    return this.service.list({ ...params, filters: { ...params.filters, status } });
  }

  /** Create an employee profile (e.g. on invitation acceptance). */
  create(input: EmployeeInsert): Promise<Profile> {
    return this.service.create(input);
  }

  /** Patch an employee profile. */
  update(id: string, patch: EmployeeUpdate): Promise<Profile> {
    return this.service.update(id, patch);
  }

  /** Change an employee's lifecycle status. */
  setStatus(id: string, status: EmployeeStatus): Promise<Profile> {
    return this.service.update(id, { status });
  }

  /** Resolve an employee's assigned roles. */
  getRoles(id: string): Promise<AppRole[]> {
    return this.service.getRoles(id);
  }
}

/** Shared singleton — import this, not the class. */
export const employeeRepository = new EmployeeRepository();
