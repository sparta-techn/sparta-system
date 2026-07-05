/**
 * SpartaFlow service layer.
 *
 * The single backend boundary for the app: all external communication goes
 * through these service classes (per CLAUDE.md). Components never call Supabase
 * directly — they import a service singleton (or call one inside a hook /
 * TanStack Query function).
 *
 * ```ts
 * import { tasksService } from "@/services";
 * const tasks = await tasksService.listByProject(projectId);
 * ```
 *
 * See `docs/SERVICES.md` for the full reference.
 */

// Shared foundation
export * from "./core";

// Domain services
export { authService, AuthService } from "./auth";
export { attendanceService, AttendanceService } from "./attendance";
export { projectsService, ProjectsService } from "./projects";
export { tasksService, TasksService } from "./tasks";
export { sprintsService, SprintsService } from "./sprints";
export { reportsService, ReportsService } from "./reports";
export { notificationsService, NotificationsService } from "./notifications";
export { analyticsService, AnalyticsService } from "./analytics";
export { executiveKpiService, ExecutiveKpiService } from "./kpi";
export { executiveAlertEngine, ExecutiveAlertEngine } from "./alerts";
export { computeOrganizationHealth } from "./health";
export { aiService, AiService } from "./ai";

// Attendance & daily-reports services over the migration-20260630130000 tables.
export {
  attendanceRecordsService,
  AttendanceRecordsService,
  attendanceSessionsService,
  AttendanceSessionsService,
  breakSessionsService,
  BreakSessionsService,
  attendanceEventsService,
  AttendanceEventsService,
} from "./attendance";
export {
  dailyReportsService,
  DailyReportsService,
  statusUpdatesService,
  StatusUpdatesService,
  dependencyRequestsService,
  DependencyRequestsService,
} from "./reports";

// HR services (departments, teams, positions, employees) — see @/services/hr
export {
  departmentsService,
  DepartmentsService,
  teamsService,
  TeamsService,
  positionsService,
  PositionsService,
  employeesService,
  EmployeesService,
} from "./hr";

// Organization backbone (company, workspaces, platform settings) — see
// @/services/organization
export {
  companiesService,
  CompaniesService,
  workspacesService,
  WorkspacesService,
  systemSettingsService,
  SystemSettingsService,
} from "./organization";
