/**
 * useEmployeeManagement — real Supabase writes for the Owner/HR management
 * actions the directory UI performs on an employee: **edit**, **disable**
 * (deactivate / suspend / reactivate) and **delete** (soft-delete via
 * `status='offboarded'`, reversible with restore).
 *
 * Follows the repository pattern used elsewhere (components → repositories →
 * services; never Supabase directly) and the `useMutation`-style invalidate the
 * rest of the app uses: each action writes through the HR/profile repositories,
 * then invalidates `hrKeys.employees()` so the live directory read reconciles.
 * Audit entries are recorded via {@link recordEmployeeAudit} so the per-employee
 * timeline stays populated.
 *
 * Scope: edit spans `profiles` (name / email / job title) and `employees`
 * (department / team / work mode). Role stays on the dedicated "Assign role"
 * action; assign department/team/manager and reset password remain overlay-only
 * for now (see `employees-store`).
 */
import { useQueryClient } from "@tanstack/react-query";

import { employeeRepository as profileRepository } from "@/repositories";
import {
  departmentRepository,
  employeeRepository as hrEmployeeRepository,
  teamRepository,
} from "@/repositories/hr";
import type { EmployeeStatus } from "@/services/hr";

import { hrKeys } from "./queries";
import { recordEmployeeAudit } from "./employees-store";
import type { HrEmployee } from "./mock-data";

/** The editable fields the employee form collects (role handled elsewhere). */
export interface EmployeeEditInput {
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  team: string;
  workMode: HrEmployee["workMode"];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useEmployeeManagement() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: hrKeys.employees() });

  /** Full profile edit: name/email/title → profiles, dept/team/mode → employees. */
  async function edit(employee: HrEmployee, input: EmployeeEditInput): Promise<void> {
    // profiles — name/email/job title (keyed by the auth/profile id).
    if (employee.userId) {
      await profileRepository.update(employee.userId, {
        full_name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        job_title: input.jobTitle.trim() || null,
      });
    }

    // employees — department/team resolved by name, plus work mode.
    const [departments, teams] = await Promise.all([
      departmentRepository.listActive(),
      teamRepository.listActive(),
    ]);
    const departmentId = departments.find((d) => d.name === input.department)?.id;
    const teamId = teams.find((t) => t.name === input.team)?.id;

    const patch: Parameters<typeof hrEmployeeRepository.update>[1] = {
      work_mode: input.workMode.toLowerCase(),
    };
    // Only overwrite the FK when the name resolves to a real row.
    if (departmentId) patch.department_id = departmentId;
    if (teamId) patch.team_id = teamId;
    await hrEmployeeRepository.update(employee.id, patch);

    recordEmployeeAudit(employee.id, "edited");
    await invalidate();
  }

  async function setStatus(
    employee: HrEmployee,
    status: EmployeeStatus,
    action: Parameters<typeof recordEmployeeAudit>[1],
    detail?: string,
  ): Promise<void> {
    await hrEmployeeRepository.setStatus(employee.id, status);
    recordEmployeeAudit(employee.id, action, detail);
    await invalidate();
  }

  /** Revoke access, keep the record. Reversible via {@link reactivate}. */
  const deactivate = (employee: HrEmployee) => setStatus(employee, "suspended", "deactivated");

  /** Temporary hold (security review). Reversible via {@link reactivate}. */
  const suspend = (employee: HrEmployee) => setStatus(employee, "suspended", "suspended");

  const reactivate = (employee: HrEmployee) => setStatus(employee, "active", "reactivated");

  /** Soft delete — status 'offboarded' hides the row from the directory read. */
  async function softDelete(employee: HrEmployee): Promise<void> {
    await hrEmployeeRepository.update(employee.id, {
      status: "offboarded",
      end_date: todayIso(),
    });
    recordEmployeeAudit(employee.id, "soft_deleted");
    await invalidate();
  }

  async function restore(employee: HrEmployee): Promise<void> {
    await hrEmployeeRepository.update(employee.id, { status: "active", end_date: null });
    recordEmployeeAudit(employee.id, "restored");
    await invalidate();
  }

  return { edit, deactivate, suspend, reactivate, softDelete, restore };
}
