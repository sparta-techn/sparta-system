import type { User } from "@supabase/supabase-js";

/**
 * Application roles (the Postgres `app_role` enum). The seven canonical
 * enterprise roles are `owner … intern`; `viewer` is a deprecated legacy role
 * kept only because Postgres enum values cannot be dropped. See `docs/RBAC.md`.
 */
export type AppRole =
  "owner" | "admin" | "hr" | "project_manager" | "team_lead" | "employee" | "intern" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  hr: "HR",
  project_manager: "Project Manager",
  team_lead: "Team Lead",
  employee: "Employee",
  intern: "Intern",
  viewer: "Viewer",
};

export const ROLE_RANK: Record<AppRole, number> = {
  owner: 100,
  admin: 90,
  hr: 70,
  project_manager: 60,
  team_lead: 50,
  employee: 30,
  intern: 20,
  viewer: 10,
};

/** The seven canonical enterprise roles, highest privilege first. */
export const ENTERPRISE_ROLES: readonly AppRole[] = [
  "owner",
  "admin",
  "hr",
  "project_manager",
  "team_lead",
  "employee",
  "intern",
];

export type EmployeeStatus = "active" | "invited" | "suspended" | "offboarded";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department_id: string | null;
  team_id: string | null;
  status: EmployeeStatus;
  timezone: string | null;
  locale: string | null;
}

/**
 * Granular permission keys (`domain.action`) — the enterprise RBAC capability
 * model. The database remains the authoritative enforcement layer via RLS;
 * these keys gate the UI and mirror the `permissions` / `role_permissions`
 * tables. The catalog (with descriptions) and the role→permission matrix live
 * in `permissions.ts`. See `docs/RBAC.md`.
 */
export type Permission =
  // People / HR directory
  | "employees.read"
  | "employees.create"
  | "employees.update"
  | "employees.delete"
  | "employees.invite"
  // Org structure
  | "organization.manage"
  // Projects
  | "projects.read"
  | "projects.create"
  | "projects.edit"
  | "projects.archive"
  | "projects.delete"
  // Tasks
  | "tasks.read"
  | "tasks.create"
  | "tasks.edit"
  | "tasks.assign"
  | "tasks.delete"
  // Sprints
  | "sprints.manage"
  // Attendance
  | "attendance.read"
  | "attendance.review"
  | "attendance.manage"
  // Daily reports
  | "reports.submit"
  | "reports.read"
  | "reports.review"
  // Analytics & dashboards
  | "analytics.view"
  | "dashboard.executive.view"
  // Access administration
  | "roles.assign"
  | "permissions.manage"
  // Platform
  | "settings.manage"
  | "integrations.manage"
  | "company.manage";

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
