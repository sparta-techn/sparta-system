// Legacy mock-typed scaffold (camelCase Project type). `ProjectInsert` /
// `ProjectUpdate` stay bound to this for the existing `project.repository.ts`.
export { ProjectsService, projectsService } from "./projects.service";
export type { ProjectInsert, ProjectUpdate } from "./projects.service";

// Services over the project-execution tables (migration 20260630150000, snake-case).
export { ProjectRecordsService, projectRecordsService } from "./project-records.service";
export { ProjectRolesService, projectRolesService } from "./project-roles.service";
export { ProjectMembersService, projectMembersService } from "./project-members.service";
export { MilestonesService, milestonesService } from "./milestones.service";
export { EpicsService, epicsService } from "./epics.service";
export { ProjectActivityService, projectActivityService } from "./project-activity.service";
export { ProjectCalendarService, projectCalendarService } from "./project-calendar.service";
export { ProjectRisksService, projectRisksService } from "./project-risks.service";
export { ClientsService, clientsService } from "./clients.service";
export {
  WorkspaceService,
  workspaceService,
  type WorkspaceSettings,
  type WorkspaceSettingsUpdate,
} from "./workspace.service";

// Snake-case row types. The project insert/update are aliased so they don't
// collide with the legacy `ProjectInsert` / `ProjectUpdate` above.
export type {
  ProjectInsert as ProjectRecordInsert,
  ProjectUpdate as ProjectRecordUpdate,
} from "./types";
export type {
  ProjectRow,
  ProjectStatus,
  ProjectHealth,
  PriorityLevel,
  ProjectRoleRow,
  ProjectRoleInsert,
  ProjectRoleUpdate,
  ProjectMemberRow,
  ProjectMemberInsert,
  ProjectMemberUpdate,
  MilestoneRow,
  MilestoneInsert,
  MilestoneUpdate,
  MilestoneStatus,
  EpicRow,
  EpicInsert,
  EpicUpdate,
  ProjectActivityRow,
  ProjectActivityInsert,
  ProjectActivityType,
  ProjectCalendarEventRow,
  ProjectCalendarEventInsert,
  ProjectCalendarEventUpdate,
  CalendarEventType,
  ProjectRiskRow,
  ProjectRiskInsert,
  ProjectRiskUpdate,
  RiskStatus,
  ClientRow,
  ClientInsert,
  ClientUpdate,
} from "./types";
