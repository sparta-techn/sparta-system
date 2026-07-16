import {
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  GaugeCircle,
  HeartHandshake,
  Home,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Settings,
  ShieldCheck,
  ShieldHalf,
  Sparkles,
  Target,
  Users,
  Workflow,
} from "lucide-react";

import { isFeatureInMvp } from "@/config/mvp-scope";
import { requiresMidday } from "@/features/hr/employment-type";
import type { AppRole } from "@/features/auth/types";

export type NavItem = {
  /** Matches an id in `src/config/mvp-scope.ts` to resolve MVP scope. */
  id: string;
  title: string;
  url: string;
  icon: typeof Home;
  /**
   * How to surface this item when its feature is out of MVP scope.
   * "hide" (default) drops it; "future" renders it disabled with a badge.
   */
  whenOutOfMvp?: "hide" | "future";
  /**
   * Roles allowed to see this item. Absent = visible to every role. Mirrors the
   * permission-catalog intent in `src/features/auth/permissions.ts` and the RLS
   * boundaries — the authoritative enforcement is still RLS + route guards; this
   * only controls nav visibility.
   */
  roles?: AppRole[];
  /**
   * Hidden for part-time employees (who skip this part of the daily workflow).
   * Currently only the Midday report — part-timers file check-in and end-of-day
   * but not the midday pulse. See `@/features/hr/employment-type`.
   */
  hiddenForPartTime?: boolean;
};

// ── Role groups (mirror of the permission catalog / RLS intent) ───────────────
/** Company leadership. */
const LEADERSHIP: AppRole[] = ["owner", "admin"];
/** Roles that land on / operate the Manager dashboard (not team leads). */
const MANAGERS: AppRole[] = ["owner", "admin", "hr", "project_manager"];
/** Roles that may review team members' reports & attendance (`can_review_reports`). */
const REVIEWERS: AppRole[] = ["owner", "admin", "hr", "project_manager", "team_lead"];
/** Roles with HR-workspace access. */
const HR_ACCESS: AppRole[] = ["owner", "admin", "hr"];
/**
 * Individual-contributor roles that perform the daily attendance workflow
 * (check-in / midday / end-of-day). Deliberately excludes owner/admin — company
 * leadership does not clock in, so these items are hidden from them.
 */
const IC_DAILY: AppRole[] = ["hr", "project_manager", "team_lead", "employee", "intern"];

export const PRIMARY_NAV: NavItem[] = [
  { id: "dashboard", title: "Dashboard", url: "/app", icon: Home },
  { id: "check-in", title: "Check-in", url: "/app/check-in", icon: Sparkles, roles: IC_DAILY },
  {
    id: "midday",
    title: "Midday",
    url: "/app/midday",
    icon: GaugeCircle,
    roles: IC_DAILY,
    hiddenForPartTime: true,
  },
  { id: "eod", title: "End-of-day", url: "/app/eod", icon: ClipboardCheck, roles: IC_DAILY },
  { id: "attendance", title: "Attendance", url: "/app/attendance", icon: Calendar },
  {
    id: "workflow",
    title: "Workflow",
    url: "/app/workflow",
    icon: ClipboardList,
    whenOutOfMvp: "hide",
  },
  {
    id: "dependencies",
    title: "Dependencies",
    url: "/app/dependencies",
    icon: Workflow,
    whenOutOfMvp: "future",
  },
  { id: "projects", title: "Projects", url: "/app/projects", icon: Briefcase },
  { id: "tasks", title: "Tasks", url: "/app/tasks", icon: CheckSquare },
  { id: "sprints", title: "Sprints", url: "/app/sprints", icon: Target, whenOutOfMvp: "future" },
  {
    id: "announcements",
    title: "Announcements",
    url: "/app/announcements",
    icon: Megaphone,
    whenOutOfMvp: "hide",
  },
  { id: "notifications", title: "Notifications", url: "/app/notifications", icon: Bell },
];

export const TEAM_NAV: NavItem[] = [
  {
    id: "executive",
    title: "Executive",
    url: "/app/executive",
    icon: Gauge,
    whenOutOfMvp: "future",
    roles: LEADERSHIP,
  },
  { id: "manager", title: "Manager", url: "/app/manager", icon: LayoutDashboard, roles: MANAGERS },
  {
    id: "report-review",
    title: "Report reviews",
    url: "/app/report-review",
    icon: ClipboardList,
    roles: REVIEWERS,
  },
  { id: "hr", title: "HR workspace", url: "/app/hr", icon: HeartHandshake, roles: HR_ACCESS },
  { id: "directory", title: "Directory", url: "/app/hr/employees", icon: Users, roles: REVIEWERS },
  { id: "payroll", title: "Payroll", url: "/app/payroll", icon: Receipt, roles: HR_ACCESS },
  {
    id: "analytics",
    title: "Analytics",
    url: "/app/analytics",
    icon: BarChart3,
    whenOutOfMvp: "future",
    roles: REVIEWERS,
  },
  {
    id: "audit",
    title: "Audit log",
    url: "/app/audit",
    icon: ShieldCheck,
    whenOutOfMvp: "future",
    roles: LEADERSHIP,
  },
  { id: "admin", title: "Admin Console", url: "/app/admin", icon: ShieldHalf, roles: LEADERSHIP },
];

export const SYSTEM_NAV: NavItem[] = [
  // Company-wide settings (organization profile / working hours) are leadership-only,
  // matching the /settings route guard.
  { id: "settings", title: "Settings", url: "/settings", icon: Settings, roles: LEADERSHIP },
];

/** Whether a nav item's feature is deferred (out of MVP but shown disabled). */
export function isNavItemDeferred(item: NavItem): boolean {
  return !isFeatureInMvp(item.id);
}

/**
 * Whether a nav item should appear for a user holding `roles` with the given
 * `employmentType` slug. Combines MVP scope (in-MVP, or explicitly surfaced as a
 * "future" item), the item's role allowlist (absent = everyone), and the
 * part-time daily-workflow trim (Midday is hidden for part-timers).
 */
export function isNavItemVisible(
  item: NavItem,
  roles: AppRole[],
  employmentType?: string | null,
): boolean {
  const inScope = isFeatureInMvp(item.id) || item.whenOutOfMvp === "future";
  if (!inScope) return false;
  if (item.roles && !item.roles.some((role) => roles.includes(role))) return false;
  if (item.hiddenForPartTime && !requiresMidday(employmentType)) return false;
  return true;
}
