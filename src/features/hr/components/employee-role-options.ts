import type { EmployeeRole } from "../mock-data";

/**
 * Roles an Owner/HR can assign from the management UI. `owner` is intentionally
 * omitted — ownership transfer is a separate, guarded flow.
 */
export const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "team_lead", label: "Team Lead" },
  { value: "manager", label: "Manager" },
  { value: "hr", label: "HR" },
  { value: "super_admin", label: "Super Admin" },
];
