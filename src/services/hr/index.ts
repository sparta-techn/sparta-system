/**
 * SpartaFlow HR service layer.
 *
 * Class-based services over the HR tables created in
 * `supabase/migrations/2026063012*_hr_*.sql`. Each extends {@link BaseService}
 * for uniform CRUD and adds domain reads + lifecycle verbs. Import the singleton.
 *
 * ```ts
 * import { departmentsService } from "@/services/hr";
 * const depts = await departmentsService.listActive();
 * ```
 *
 * See `docs/HR_BACKEND.md` for the full reference.
 */
export { DepartmentsService, departmentsService } from "./departments.service";
export { TeamsService, teamsService } from "./teams.service";
export { PositionsService, positionsService } from "./positions.service";
export { EmployeesService, employeesService } from "./employees.service";

export type {
  Department,
  DepartmentInsert,
  DepartmentUpdate,
  Team,
  TeamInsert,
  TeamUpdate,
  Position,
  PositionInsert,
  PositionUpdate,
  Employee,
  EmployeeInsert,
  EmployeeUpdate,
  EmployeeStatus,
} from "./types";
