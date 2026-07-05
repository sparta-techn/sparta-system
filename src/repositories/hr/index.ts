/**
 * SpartaFlow HR repository layer.
 *
 * Domain-facing data API over the HR services (`@/services/hr`). Hooks /
 * TanStack Query call these repositories; repositories never touch Supabase
 * directly. Import the singleton.
 *
 * ```ts
 * import { departmentRepository } from "@/repositories/hr";
 * const depts = await departmentRepository.listActive();
 * ```
 *
 * NOTE: the HR `EmployeeRepository` here (over `public.employees`) is distinct
 * from the top-level `EmployeeRepository` in `@/repositories` (over `profiles`).
 * These are intentionally not merged into the root barrel; import HR repos from
 * `@/repositories/hr`.
 *
 * See `docs/HR_BACKEND.md` for the full reference.
 */
export { DepartmentRepository, departmentRepository } from "./department.repository";
export { TeamRepository, teamRepository } from "./team.repository";
export { PositionRepository, positionRepository } from "./position.repository";
export { EmployeeRepository, employeeRepository } from "./employee.repository";
