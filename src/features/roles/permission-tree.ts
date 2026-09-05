/**
 * Pure shaping helpers for the permission picker.
 *
 * The catalog is a flat list of `(module, action, scope)` rows. The editor
 * needs it grouped module → action → scopes, plus the id sets behind each bulk
 * selection control ("all view permissions", "everything in this module", …).
 *
 * No React, no data fetching — kept separate so the selection maths is unit
 * tested without rendering anything. See `permission-tree.test.ts`.
 */
import type { PermissionScope, RbacPermission } from "@/services/rbac";

/** Display order for scopes: narrowest first. */
export const SCOPE_ORDER: readonly PermissionScope[] = ["own", "team", "all"];

/** Human labels for the scope tiers. */
export const SCOPE_LABELS: Record<PermissionScope, string> = {
  own: "Own",
  team: "Team",
  all: "All",
};

/** What each scope actually means, for tooltips/help text. */
export const SCOPE_HINTS: Record<PermissionScope, string> = {
  own: "Only records the user owns.",
  team: "The user's own team and their direct reports.",
  all: "Every record, organization-wide.",
};

/** Display order for the common actions; anything else sorts after, A–Z. */
const ACTION_ORDER = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "assign",
  "archive",
  "invite",
  "export",
];

/** Friendly module names. Falls back to a title-cased slug when unlisted. */
const MODULE_LABELS: Record<string, string> = {
  hr: "HR",
  organization: "Organization",
  attendance: "Attendance",
  reports: "Daily reports",
  payroll: "Payroll",
  projects: "Projects",
  tasks: "Tasks",
  sprints: "Sprints",
  approvals: "Approvals",
  clients: "Clients",
  rewards: "Rewards",
  analytics: "Analytics",
  roles: "Roles & permissions",
  settings: "Settings",
  integrations: "Integrations",
  notifications: "Notifications",
  audit: "Audit log",
};

/** Title-case a `snake_case` slug: `daily_reports` → `Daily reports`. */
export function titleize(slug: string): string {
  const spaced = slug.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Display label for a module slug. */
export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? titleize(module);
}

/** Display label for an action slug. */
export function actionLabel(action: string): string {
  return titleize(action);
}

/** A single selectable permission, as rendered in the picker. */
export interface PermissionCell {
  id: string;
  scope: PermissionScope;
  description: string | null;
}

/** One action row within a module: the scopes the catalog offers for it. */
export interface ActionRow {
  action: string;
  label: string;
  cells: PermissionCell[];
}

/** One module section of the picker. */
export interface ModuleGroup {
  module: string;
  label: string;
  actions: ActionRow[];
  /** Every permission id in this module — the "select all" target. */
  allIds: string[];
}

function actionRank(action: string): number {
  const i = ACTION_ORDER.indexOf(action);
  return i === -1 ? ACTION_ORDER.length : i;
}

/**
 * Group a flat catalog into module → action → scope cells, ordered for display
 * (modules A–Z by label, actions by {@link ACTION_ORDER}, scopes narrowest
 * first).
 */
export function groupByModule(catalog: RbacPermission[]): ModuleGroup[] {
  const byModule = new Map<string, Map<string, PermissionCell[]>>();

  for (const p of catalog) {
    let actions = byModule.get(p.module);
    if (!actions) {
      actions = new Map();
      byModule.set(p.module, actions);
    }
    const cells = actions.get(p.action) ?? [];
    cells.push({ id: p.id, scope: p.scope, description: p.description });
    actions.set(p.action, cells);
  }

  const groups: ModuleGroup[] = [];
  for (const [module, actions] of byModule) {
    const rows: ActionRow[] = [];
    for (const [action, cells] of actions) {
      rows.push({
        action,
        label: actionLabel(action),
        cells: [...cells].sort(
          (a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope),
        ),
      });
    }
    rows.sort(
      (a, b) => actionRank(a.action) - actionRank(b.action) || a.action.localeCompare(b.action),
    );
    groups.push({
      module,
      label: moduleLabel(module),
      actions: rows,
      allIds: rows.flatMap((r) => r.cells.map((c) => c.id)),
    });
  }

  groups.sort((a, b) => a.label.localeCompare(b.label));
  return groups;
}

/** Every distinct action present in the catalog, in display order. */
export function distinctActions(catalog: RbacPermission[]): string[] {
  const seen = new Set(catalog.map((p) => p.action));
  return [...seen].sort((a, b) => actionRank(a) - actionRank(b) || a.localeCompare(b));
}

/** Permission ids matching an action across every module ("all view"). */
export function idsForAction(catalog: RbacPermission[], action: string): string[] {
  return catalog.filter((p) => p.action === action).map((p) => p.id);
}

/** Permission ids matching a scope across every module ("everything at Own"). */
export function idsForScope(catalog: RbacPermission[], scope: PermissionScope): string[] {
  return catalog.filter((p) => p.scope === scope).map((p) => p.id);
}

/**
 * Toggle a batch of ids in a selection.
 *
 * `select` adds them all; otherwise they are all removed. Returns a new Set —
 * the caller keeps selection state immutable so React re-renders predictably.
 */
export function toggleMany(
  selected: ReadonlySet<string>,
  ids: readonly string[],
  select: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (select) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Tri-state for a bulk checkbox: none / some / all of `ids` are selected. */
export type BulkState = "none" | "partial" | "all";

/** How much of `ids` is currently selected. */
export function bulkState(selected: ReadonlySet<string>, ids: readonly string[]): BulkState {
  if (ids.length === 0) return "none";
  let hits = 0;
  for (const id of ids) if (selected.has(id)) hits++;
  if (hits === 0) return "none";
  return hits === ids.length ? "all" : "partial";
}

/** Ids present in `before` but missing from `after` — i.e. revoked on save. */
export function removedIds(before: readonly string[], after: ReadonlySet<string>): string[] {
  return before.filter((id) => !after.has(id));
}
