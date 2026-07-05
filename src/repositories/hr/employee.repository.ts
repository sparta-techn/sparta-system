import type { ListParams } from "@/services/core";
import {
  EmployeesService,
  employeesService,
  type Employee,
  type EmployeeInsert,
  type EmployeeStatus,
  type EmployeeUpdate,
} from "@/services/hr";

/**
 * EmployeeRepository (HR) — domain operations for the employment record
 * (`public.employees`). Delegates persistence to {@link EmployeesService} and
 * frames the org-relationship reads (reports-to, direct reports) in domain terms.
 *
 * NOTE: distinct from the directory-facing `EmployeeRepository` in
 * `src/repositories/employee.repository.ts` (which reads `profiles`). Import the
 * HR one from `@/repositories/hr` to avoid confusion.
 */
export class EmployeeRepository {
  constructor(private readonly service: EmployeesService = employeesService) {}

  list(params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.service.list(params);
  }

  getById(id: string): Promise<Employee | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Employee> {
    return this.service.getByIdOrThrow(id);
  }

  /** The employment record for an auth user / profile id. */
  getByUserId(userId: string): Promise<Employee | null> {
    return this.service.getByUserId(userId);
  }

  getByCode(employeeCode: string): Promise<Employee | null> {
    return this.service.getByCode(employeeCode);
  }

  listByDepartment(departmentId: string, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.service.listByDepartment(departmentId, params);
  }

  listByTeam(teamId: string, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.service.listByTeam(teamId, params);
  }

  listByStatus(status: EmployeeStatus, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.service.listByStatus(status, params);
  }

  /** Direct reports of a manager. */
  getDirectReports(managerId: string, params: ListParams<Employee> = {}): Promise<Employee[]> {
    return this.service.listByManager(managerId, params);
  }

  /** Resolve the manager record for an employee, or `null`. */
  async getManager(id: string): Promise<Employee | null> {
    const employee = await this.service.getById(id);
    if (!employee?.manager_id) return null;
    return this.service.getById(employee.manager_id);
  }

  create(input: EmployeeInsert): Promise<Employee> {
    return this.service.create(input);
  }

  update(id: string, patch: EmployeeUpdate): Promise<Employee> {
    return this.service.update(id, patch);
  }

  setStatus(id: string, status: EmployeeStatus): Promise<Employee> {
    return this.service.setStatus(id, status);
  }

  assignManager(id: string, managerId: string | null): Promise<Employee> {
    return this.service.assignManager(id, managerId);
  }

  setDepartment(id: string, departmentId: string | null): Promise<Employee> {
    return this.service.setDepartment(id, departmentId);
  }

  setTeam(id: string, teamId: string | null): Promise<Employee> {
    return this.service.setTeam(id, teamId);
  }

  setPosition(id: string, positionId: string | null): Promise<Employee> {
    return this.service.setPosition(id, positionId);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const employeeRepository = new EmployeeRepository();
