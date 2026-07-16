import type { AppRole, Permission } from "./types";

/**
 * Enterprise RBAC — the single source of truth for the granular permission
 * catalog and the role → permission matrix.
 *
 * Authorization is enforced authoritatively by Postgres RLS (role-based
 * policies + the `has_permission()` function over the `permissions` /
 * `role_permissions` tables). This module mirrors that model for the UI and is
 * mirrored, in turn, by the SQL seed in
 * `supabase/migrations/20260703120100_rbac_granular_permissions.sql` and reused
 * by the bootstrap orchestrator. Keep the three in sync — the drift is guarded
 * by `permissions.test.ts` and `repositories/bootstrap/constants.test.ts`.
 *
 * See `docs/RBAC.md`.
 */

/** A permission the platform understands, with UI grouping + human copy. */
export interface PermissionDefinition {
  key: Permission;
  /** UI grouping, e.g. "employees", "projects". */
  category: string;
  description: string;
}

/** The full permission catalog (`domain.action`), grouped by category. */
export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  // People / HR directory
  {
    key: "employees.read",
    category: "employees",
    description: "View the employee directory and profiles",
  },
  { key: "employees.create", category: "employees", description: "Add employees" },
  { key: "employees.update", category: "employees", description: "Edit employee records" },
  { key: "employees.delete", category: "employees", description: "Delete / offboard employees" },
  { key: "employees.invite", category: "employees", description: "Invite people to the platform" },
  // Org structure
  {
    key: "organization.manage",
    category: "organization",
    description: "Manage departments, teams and positions",
  },
  // Projects
  { key: "projects.read", category: "projects", description: "View projects" },
  { key: "projects.create", category: "projects", description: "Create projects" },
  { key: "projects.edit", category: "projects", description: "Edit project details" },
  { key: "projects.archive", category: "projects", description: "Archive projects" },
  { key: "projects.delete", category: "projects", description: "Permanently delete projects" },
  // Tasks
  { key: "tasks.read", category: "tasks", description: "View tasks" },
  { key: "tasks.create", category: "tasks", description: "Create tasks" },
  { key: "tasks.edit", category: "tasks", description: "Edit tasks" },
  { key: "tasks.assign", category: "tasks", description: "Assign tasks to members" },
  { key: "tasks.delete", category: "tasks", description: "Delete tasks" },
  // Sprints
  { key: "sprints.manage", category: "sprints", description: "Plan and manage sprints" },
  // Attendance
  { key: "attendance.read", category: "attendance", description: "View own attendance" },
  { key: "attendance.review", category: "attendance", description: "Review team / all attendance" },
  {
    key: "attendance.manage",
    category: "attendance",
    description: "Adjust others' attendance records",
  },
  // Daily reports
  { key: "reports.submit", category: "reports", description: "Submit daily reports" },
  { key: "reports.read", category: "reports", description: "View reports" },
  { key: "reports.review", category: "reports", description: "Review team members' reports" },
  // Analytics & dashboards
  { key: "analytics.view", category: "analytics", description: "View analytics and dashboards" },
  {
    key: "dashboard.executive.view",
    category: "analytics",
    description: "Access the executive / owner dashboard",
  },
  // Access administration
  { key: "roles.assign", category: "access", description: "Grant and revoke user roles" },
  {
    key: "permissions.manage",
    category: "access",
    description: "Edit the role → permission matrix",
  },
  // Platform
  { key: "settings.manage", category: "settings", description: "Manage company / system settings" },
  {
    key: "integrations.manage",
    category: "settings",
    description: "Configure external integrations",
  },
  {
    key: "company.manage",
    category: "settings",
    description: "Manage company identity and ownership",
  },
  // Payroll
  { key: "payroll.view", category: "payroll", description: "View employee pay rates and payroll data" },
  {
    key: "payroll.manage",
    category: "payroll",
    description: "Edit employee pay rates and payroll data",
  },
];

/** Every permission key — convenience for "grant all" (owner-style) roles. */
export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_CATALOG.map((p) => p.key);

/**
 * Role → permission matrix. Mirror of RLS intent on the backend.
 *
 * - `owner` holds everything **except** `attendance.manage` (owners have
 *   read-only access to attendance — a deliberate product rule; see the
 *   attendance helpers below).
 * - `admin` is the full platform administrator, minus the owner-exclusive
 *   `company.manage` and `dashboard.executive.view`.
 * - `viewer` is a deprecated legacy role: read-only.
 */
export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: ALL_PERMISSIONS.filter((p) => p !== "attendance.manage"),

  admin: ALL_PERMISSIONS.filter((p) => p !== "company.manage" && p !== "dashboard.executive.view"),

  hr: [
    "employees.read",
    "employees.create",
    "employees.update",
    "employees.invite",
    "organization.manage",
    "attendance.read",
    "attendance.review",
    "attendance.manage",
    "reports.read",
    "reports.review",
    "analytics.view",
    "payroll.view",
    "payroll.manage",
  ],

  project_manager: [
    "employees.read",
    "projects.read",
    "projects.create",
    "projects.edit",
    "projects.archive",
    "tasks.read",
    "tasks.create",
    "tasks.edit",
    "tasks.assign",
    "tasks.delete",
    "sprints.manage",
    "attendance.read",
    "attendance.review",
    "reports.submit",
    "reports.read",
    "reports.review",
    "analytics.view",
  ],

  team_lead: [
    "employees.read",
    "projects.read",
    "tasks.read",
    "tasks.create",
    "tasks.edit",
    "tasks.assign",
    "attendance.read",
    "attendance.review",
    "reports.submit",
    "reports.read",
    "reports.review",
  ],

  employee: [
    "employees.read",
    "projects.read",
    "tasks.read",
    "tasks.edit",
    "attendance.read",
    "reports.submit",
  ],

  intern: ["employees.read", "projects.read", "tasks.read", "attendance.read", "reports.submit"],

  // Deprecated legacy role — read-only.
  viewer: ["employees.read", "projects.read", "tasks.read", "attendance.read", "reports.read"],
};

/** The set of permissions a user holds given their roles (union across roles). */
export function permissionsForRoles(roles: AppRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return set;
}

/** Whether the held roles grant a specific permission. */
export function rolesHavePermission(roles: AppRole[], permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

// ── Attendance & reports access rules (mirror of RLS intent) ──────────────────
// Authoritative enforcement is RLS (`can_review_reports`, attendance policies);
// these helpers gate the UI and are unit-tested as the business-rule contract.

/** Roles that may review (read) team members' daily reports & attendance. */
const REPORT_REVIEWER_ROLES: AppRole[] = ["owner", "admin", "hr", "project_manager", "team_lead"];

/** Roles that may adjust (write) other employees' attendance records. */
const ATTENDANCE_ADMIN_ROLES: AppRole[] = ["admin", "hr"];

function hasAny(roles: AppRole[], allowed: AppRole[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

/** Managers / HR / owner may review other people's reports. */
export function canReviewReports(roles: AppRole[]): boolean {
  return hasAny(roles, REPORT_REVIEWER_ROLES);
}

/** Owner + managers + HR may read all attendance (not just their own). */
export function canViewAllAttendance(roles: AppRole[]): boolean {
  return hasAny(roles, REPORT_REVIEWER_ROLES);
}

/** Only admin / HR may edit others' attendance; owner is read-only. */
export function canAdministerAttendance(roles: AppRole[]): boolean {
  return hasAny(roles, ATTENDANCE_ADMIN_ROLES);
}

/**
 * Owners have **read-only** access to all attendance: they can see everyone's
 * records but cannot mutate them. True when the elevated access a role grants is
 * view-without-write (the owner case).
 */
export function isAttendanceReadOnly(roles: AppRole[]): boolean {
  return canViewAllAttendance(roles) && !canAdministerAttendance(roles);
}
