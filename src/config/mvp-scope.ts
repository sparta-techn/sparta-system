/**
 * MVP scope — the single source of truth for which features ship in the MVP.
 *
 * Each entry flags a nav item, route, or component-level feature with
 * `inMvp: boolean`. Two consumers read it:
 *   1. `app-sidebar.tsx` — hides (or disables with a "Future Plan" badge) nav
 *      items whose feature is out of scope.
 *   2. `route-guard-gate.tsx` — renders a "planned for a future release"
 *      placeholder for anyone who navigates directly to an out-of-scope route.
 *
 * This gates *visibility and routing only*. No underlying feature code is
 * deleted — out-of-scope modules stay in the tree and can be switched on by
 * flipping `inMvp` to `true`. It is a product-scope layer, not a security
 * boundary (RBAC/RLS remain authoritative).
 *
 * MVP (inMvp: true): auth, organization, employees, RBAC (implicit), attendance,
 * daily reports (incl. manager review), projects, tasks, kanban, dashboards,
 * notifications.
 *
 * Out of MVP (inMvp: false): audit logs, AI assistant/settings, sprints,
 * executive dashboard, analytics, project analytics, time tracking, task file
 * attachments, threaded comments, dependencies, and any dead/company-hub links.
 */

/** How a scoped item is surfaced. */
export type MvpScopeKind =
  /** Appears in the primary sidebar nav. */
  | "nav"
  /** A reachable route not shown in the sidebar (guarded only). */
  | "route"
  /** A panel/widget inside a page — no route of its own. */
  | "feature";

export interface MvpScopeEntry {
  /** Stable id used by nav items to look up their scope. */
  id: string;
  /** Human label (matches the nav label where applicable). */
  label: string;
  /** Whether this feature is part of the MVP. */
  inMvp: boolean;
  /** What kind of surface this governs. */
  kind: MvpScopeKind;
  /**
   * Route path this entry governs (for `kind: "nav" | "route"`). Route guarding
   * matches by longest path prefix, so a more specific out-of-scope child
   * (e.g. `/app/tasks/time`) overrides its in-scope parent (`/app/tasks`).
   */
  path?: string;
  /** Optional rationale, shown only in this file for reviewers. */
  note?: string;
}

export const MVP_SCOPE: readonly MvpScopeEntry[] = [
  // ---------- Workspace (primary nav) ----------
  { id: "dashboard", label: "Dashboard", inMvp: true, kind: "nav", path: "/app" },
  { id: "check-in", label: "Check-in", inMvp: true, kind: "nav", path: "/app/check-in" },
  { id: "midday", label: "Midday", inMvp: true, kind: "nav", path: "/app/midday" },
  { id: "eod", label: "End-of-day", inMvp: true, kind: "nav", path: "/app/eod" },
  { id: "attendance", label: "Attendance", inMvp: true, kind: "nav", path: "/app/attendance" },
  {
    id: "workflow",
    label: "Workflow",
    inMvp: false,
    kind: "nav",
    path: "/app/workflow",
    note: "No backing route; part of the out-of-scope dependencies/workflow surface.",
  },
  {
    id: "dependencies",
    label: "Dependencies",
    inMvp: false,
    kind: "nav",
    path: "/app/dependencies",
    note: "Cross-team dependency tracking — out of MVP.",
  },
  { id: "projects", label: "Projects", inMvp: true, kind: "nav", path: "/app/projects" },
  { id: "tasks", label: "Tasks", inMvp: true, kind: "nav", path: "/app/tasks" },
  {
    id: "sprints",
    label: "Sprints",
    inMvp: false,
    kind: "nav",
    path: "/app/sprints",
    note: "Sprint management — out of MVP.",
  },
  {
    id: "announcements",
    label: "Announcements",
    inMvp: false,
    kind: "nav",
    path: "/app/announcements",
    note: "Company hub announcements; no backing route at this path.",
  },
  {
    id: "notifications",
    label: "Notifications",
    inMvp: true,
    kind: "nav",
    path: "/app/notifications",
  },

  // ---------- Team (primary nav) ----------
  {
    id: "executive",
    label: "Executive",
    inMvp: false,
    kind: "nav",
    path: "/app/executive",
    note: "Executive/owner dashboard — out of MVP.",
  },
  {
    id: "manager",
    label: "Manager",
    inMvp: true,
    kind: "nav",
    path: "/app/manager",
    note: "Manager dashboard for daily-report review — in MVP.",
  },
  {
    id: "report-review",
    label: "Report reviews",
    inMvp: true,
    kind: "nav",
    path: "/app/report-review",
  },
  { id: "hr", label: "HR workspace", inMvp: true, kind: "nav", path: "/app/hr" },
  { id: "directory", label: "Directory", inMvp: true, kind: "nav", path: "/app/hr/employees" },
  {
    id: "analytics",
    label: "Analytics",
    inMvp: false,
    kind: "nav",
    path: "/app/analytics",
    note: "Analytics workspace (team/exec/hr/saved) — out of MVP.",
  },
  {
    id: "audit",
    label: "Audit log",
    inMvp: false,
    kind: "nav",
    path: "/app/audit",
    note: "Audit-log viewer — out of MVP.",
  },
  {
    id: "admin",
    label: "Admin Console",
    inMvp: true,
    kind: "nav",
    path: "/app/admin",
    note: "Hosts the in-scope Organization settings; system-settings panel can be gated separately later.",
  },

  // ---------- System (primary nav) ----------
  { id: "settings", label: "Settings", inMvp: true, kind: "nav", path: "/settings" },
  { id: "help", label: "Help", inMvp: true, kind: "nav", path: "/help" },

  // ---------- Routes reachable but not in the sidebar ----------
  {
    id: "integrations",
    label: "Integrations",
    inMvp: false,
    kind: "route",
    path: "/app/integrations",
    note: "External-system integrations — out of MVP.",
  },
  {
    id: "tasks-time",
    label: "My time",
    inMvp: false,
    kind: "route",
    path: "/app/tasks/time",
    note: "Time tracking — out of MVP. More specific than /app/tasks so it overrides it.",
  },

  // ---------- Component-level features (no route of their own) ----------
  {
    id: "task-file-attachments",
    label: "Task file attachments",
    inMvp: false,
    kind: "feature",
    note: "Task-files panel; hide the panel, keep the code.",
  },
  {
    id: "task-comments",
    label: "Threaded task comments",
    inMvp: false,
    kind: "feature",
    note: "Task communication / threaded comments.",
  },
  {
    id: "project-analytics",
    label: "Project analytics",
    inMvp: false,
    kind: "feature",
    note: "Per-project analytics widgets.",
  },
  {
    id: "ai-assistant",
    label: "AI assistant",
    inMvp: false,
    kind: "feature",
    note: "AI assistant surface — out of MVP.",
  },
  {
    id: "ai-settings",
    label: "AI settings",
    inMvp: false,
    kind: "feature",
    note: "AI configuration — out of MVP.",
  },
] as const;

/** Fast id → entry lookup. */
const BY_ID = new Map<string, MvpScopeEntry>(MVP_SCOPE.map((e) => [e.id, e]));

/**
 * Is a feature (by id) in the MVP? Unknown ids default to `true` (fail-open) so
 * an un-catalogued surface is never accidentally hidden.
 */
export function isFeatureInMvp(id: string): boolean {
  return BY_ID.get(id)?.inMvp ?? true;
}

/** Entries that map to a route path, longest path first (for prefix matching). */
const ROUTED_ENTRIES = MVP_SCOPE.filter(
  (e): e is MvpScopeEntry & { path: string } => typeof e.path === "string",
).sort((a, b) => b.path.length - a.path.length);

/** Does `pathname` fall under `path` (exact or as a path segment prefix)? */
function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Is a route path in the MVP? Resolves by the **most specific** (longest)
 * matching entry, so `/app/tasks/time` (out) overrides `/app/tasks` (in).
 * Paths with no catalogued match default to `true` (in MVP).
 */
export function isPathInMvp(pathname: string): boolean {
  const match = ROUTED_ENTRIES.find((e) => pathMatches(pathname, e.path));
  return match?.inMvp ?? true;
}

/** All out-of-MVP entries — handy for docs/tests. */
export const OUT_OF_MVP = MVP_SCOPE.filter((e) => !e.inMvp);
