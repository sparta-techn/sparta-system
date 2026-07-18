/**
 * useEmployeeManagement — real Supabase writes for the Owner/HR management
 * actions the directory UI performs on an employee: **edit**, **disable**
 * (deactivate / suspend / reactivate) and **remove** (a permanent hard delete
 * of the underlying auth user + cascaded rows — see `remove` below).
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
  compensationRepository,
  departmentRepository,
  employeeRepository as hrEmployeeRepository,
  teamRepository,
} from "@/repositories/hr";
import type { EmployeeStatus } from "@/services/hr";
import { payrollKeys } from "@/features/payroll/queries";

import { hrKeys } from "./queries";
import { recordEmployeeAudit } from "./employees-store";
import { deleteEmployeeFn } from "./delete-employee.functions";
import type { HrEmployee } from "./mock-data";

/** The editable fields the employee form collects (role handled elsewhere). */
export interface EmployeeEditInput {
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  team: string;
  workMode: HrEmployee["workMode"];
  /** Employment type row id (`employment_types.id`); omitted leaves it unchanged. */
  employmentTypeId?: string;
  /**
   * Pay rates (`employee_compensation`). Present only when the editor holds
   * `payroll.manage`; when so, the whole trio is sent together and a rate of
   * `null` clears that field. Absent → the pay row is left untouched.
   */
  hourlyRate?: number | null;
  monthlySalary?: number | null;
  currency?: string;
}

/** Canonical UUID — the shape of a real Supabase employee id. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Management actions only ever touch real Supabase rows. A legacy
 * localStorage-only record (id like `emp_local_…`, from before create was wired
 * live) is rejected here with a clear message rather than letting the fake id
 * reach Postgres as an `invalid input syntax for type uuid` error.
 */
function assertRealEmployee(employee: Pick<HrEmployee, "id" | "name">): void {
  if (!UUID_RE.test(employee.id)) {
    throw new Error(
      `"${employee.name}" is a local-only record, not a real employee — it can't be ` +
        `changed or removed on the server. Clear the local HR cache to remove it.`,
    );
  }
}

export function useEmployeeManagement() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: hrKeys.employees() });

  /** Full profile edit: name/email/title → profiles, dept/team/mode → employees. */
  async function edit(
    employee: Pick<HrEmployee, "id" | "userId" | "name">,
    input: EmployeeEditInput,
  ): Promise<void> {
    assertRealEmployee(employee);
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
    // Employment type is a direct row id from the form's selector.
    if (input.employmentTypeId) patch.employment_type_id = input.employmentTypeId;
    await hrEmployeeRepository.update(employee.id, patch);

    // employee_compensation — only when the editor manages pay (RLS is the
    // authoritative backstop). Sent as a trio; `null` clears a rate. This is
    // what turns the payroll "no rate" flag into real figures.
    const managesPay =
      input.hourlyRate !== undefined ||
      input.monthlySalary !== undefined ||
      input.currency !== undefined;
    if (managesPay) {
      await compensationRepository.setForEmployee(employee.id, {
        hourly_rate: input.hourlyRate ?? null,
        monthly_salary: input.monthlySalary ?? null,
        ...(input.currency ? { currency: input.currency } : {}),
      });
      await qc.invalidateQueries({ queryKey: hrKeys.compensation(employee.id) });
      // The payroll report reads this row server-side — refresh its cache.
      await qc.invalidateQueries({ queryKey: payrollKeys.all });
    }

    recordEmployeeAudit(employee.id, "edited");
    await invalidate();
  }

  async function setStatus(
    employee: HrEmployee,
    status: EmployeeStatus,
    action: Parameters<typeof recordEmployeeAudit>[1],
    detail?: string,
  ): Promise<void> {
    assertRealEmployee(employee);
    await hrEmployeeRepository.setStatus(employee.id, status);
    recordEmployeeAudit(employee.id, action, detail);
    await invalidate();
  }

  /** Revoke access, keep the record. Reversible via {@link reactivate}. */
  const deactivate = (employee: HrEmployee) => setStatus(employee, "suspended", "deactivated");

  /** Temporary hold (security review). Reversible via {@link reactivate}. */
  const suspend = (employee: HrEmployee) => setStatus(employee, "suspended", "suspended");

  const reactivate = (employee: HrEmployee) => setStatus(employee, "active", "reactivated");

  /**
   * Hard delete — permanently removes the employee by deleting their underlying
   * Supabase Auth user on the server, which CASCADE-removes their profile, roles
   * and employee row. This frees the email so a later invite is genuinely fresh
   * (see `delete-employee.functions.ts`). Irreversible — there is no restore.
   */
  async function remove(employee: HrEmployee): Promise<void> {
    assertRealEmployee(employee);
    await deleteEmployeeFn({ data: { employeeId: employee.id } });
    recordEmployeeAudit(employee.id, "soft_deleted");
    await invalidate();
  }

  async function restore(employee: HrEmployee): Promise<void> {
    assertRealEmployee(employee);
    await hrEmployeeRepository.update(employee.id, { status: "active", end_date: null });
    recordEmployeeAudit(employee.id, "restored");
    await invalidate();
  }

  return { edit, deactivate, suspend, reactivate, remove, restore };
}
