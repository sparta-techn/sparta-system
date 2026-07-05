/**
 * SpartaFlow repository layer.
 *
 * Repositories are the domain-facing data API. They sit above the service layer
 * (`src/services`) — composing one or more services and exposing aggregate,
 * intention-revealing operations (e.g. `getCurrentIdentity`,
 * `getWithMilestones`). Hooks / TanStack Query call repositories; repositories
 * never touch Supabase directly.
 *
 * ```ts
 * import { taskRepository } from "@/repositories";
 * const tasks = await taskRepository.listByProject(projectId);
 * ```
 *
 * See `docs/REPOSITORIES.md` for the full reference.
 */
export { AuthRepository, authRepository } from "./auth.repository";
export type { CurrentIdentity } from "./auth.repository";

export { EmployeeRepository, employeeRepository } from "./employee.repository";
export type { EmployeeInsert, EmployeeUpdate } from "./employee.repository";

export { ProjectRepository, projectRepository } from "./project.repository";
export type { ProjectWithMilestones } from "./project.repository";

export { TaskRepository, taskRepository } from "./task.repository";

export { SprintRepository, sprintRepository } from "./sprint.repository";

export { AttendanceRepository, attendanceRepository } from "./attendance.repository";

export { ReportRepository, reportRepository } from "./report.repository";
