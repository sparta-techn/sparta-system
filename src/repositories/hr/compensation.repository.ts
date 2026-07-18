import {
  CompensationService,
  compensationService,
  type EmployeeCompensation,
  type EmployeeCompensationUpdate,
} from "@/services/hr";

/**
 * CompensationRepository (HR) — domain operations for employee pay rates
 * (`public.employee_compensation`). Delegates persistence to
 * {@link CompensationService}; frames the read/write in employee-centric terms
 * so hooks and the payroll UI never touch the 1:1 mechanics directly.
 *
 * Reads and writes are RLS-gated to `payroll.view` / `payroll.manage`.
 */
export class CompensationRepository {
  constructor(private readonly service: CompensationService = compensationService) {}

  /** The pay row for an employee, or `null` when none is set. */
  getForEmployee(employeeId: string): Promise<EmployeeCompensation | null> {
    return this.service.getByEmployeeId(employeeId);
  }

  /** Create or update an employee's pay row (upserts on `employee_id`). */
  setForEmployee(
    employeeId: string,
    patch: EmployeeCompensationUpdate,
  ): Promise<EmployeeCompensation> {
    return this.service.setForEmployee(employeeId, patch);
  }
}

/** Shared singleton — import this, not the class. */
export const compensationRepository = new CompensationRepository();
