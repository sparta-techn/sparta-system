/**
 * Project-execution repository layer (new schema, migration 20260630150000).
 *
 * Domain-facing data API over the project-execution services. Import the
 * singletons from `@/repositories/projects`.
 *
 * NOTE: intentionally NOT re-exported from the root `@/repositories` barrel —
 * the root `ProjectRepository` (mock-typed) keeps that name. Same convention as
 * `@/repositories/hr`, `@/repositories/attendance`, `@/repositories/reports`.
 *
 *   Project CRUD (+ reuses tasks)   → {@link ProjectRepository}
 *   Workspace CRUD                  → {@link WorkspaceRepository}
 *   Member assignment               → {@link ProjectMemberRepository}
 *   Milestones                      → {@link MilestoneRepository}
 *   Epics                           → {@link EpicRepository}
 *   Project calendar                → {@link ProjectCalendarRepository}
 *   Project activity                → {@link ProjectActivityRepository}
 *   Risk management                 → {@link ProjectRiskRepository}
 */
export { ProjectRepository, projectRepository } from "./project.repository";
export { WorkspaceRepository, workspaceRepository } from "./workspace.repository";
export { ProjectMemberRepository, projectMemberRepository } from "./project-member.repository";
export { MilestoneRepository, milestoneRepository } from "./milestone.repository";
export { EpicRepository, epicRepository } from "./epic.repository";
export {
  ProjectCalendarRepository,
  projectCalendarRepository,
} from "./project-calendar.repository";
export {
  ProjectActivityRepository,
  projectActivityRepository,
} from "./project-activity.repository";
export { ProjectRiskRepository, projectRiskRepository } from "./project-risk.repository";
export { ClientRepository, clientRepository } from "./client.repository";
