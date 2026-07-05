/**
 * Security / system audit-log domain types.
 *
 * A tamper-evident record of who did what, when, and what changed. Distinct
 * from the HR-scoped activity list (`features/hr` `auditLog`) and the
 * project/task `activity_feed` — this is the cross-cutting *security* audit
 * (auth events, RBAC changes, destructive actions, settings changes).
 *
 * Shaped to mirror a future append-only Supabase `audit_logs` table so the
 * store internals can be swapped for an `AuditService` without touching the
 * emitters. See `docs/AUDIT_LOGS.md`.
 */

/** The tracked event kinds. */
export type AuditAction =
  | "login"
  | "logout"
  | "failed_login"
  | "role_changed"
  | "permission_changed"
  | "employee_created"
  | "employee_deleted"
  | "project_deleted"
  | "settings_changed";

/** Coarse grouping for filtering the log. */
export type AuditCategory = "auth" | "access" | "employee" | "project" | "settings";

/** Which category each action rolls up to. */
export const ACTION_CATEGORY: Record<AuditAction, AuditCategory> = {
  login: "auth",
  logout: "auth",
  failed_login: "auth",
  role_changed: "access",
  permission_changed: "access",
  employee_created: "employee",
  employee_deleted: "employee",
  project_deleted: "project",
  settings_changed: "settings",
};

/** Human-readable, past-tense labels for the UI. */
export const ACTION_LABEL: Record<AuditAction, string> = {
  login: "Signed in",
  logout: "Signed out",
  failed_login: "Failed sign-in",
  role_changed: "Changed role",
  permission_changed: "Changed permissions",
  employee_created: "Created employee",
  employee_deleted: "Deleted employee",
  project_deleted: "Deleted project",
  settings_changed: "Changed settings",
};

/** Actions that represent a security concern / failure (highlighted in the UI). */
export const SENSITIVE_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "failed_login",
  "role_changed",
  "permission_changed",
  "employee_deleted",
  "project_deleted",
]);

/**
 * One immutable audit record.
 *
 * Columns map to the task's required fields: `actor` (who), `at` (when),
 * `action` (what), `oldValue` / `newValue` (change), and `ip` / `device`
 * (reserved — populated server-side in a later phase).
 */
export interface AuditEvent {
  id: string;
  /** When — ISO timestamp. */
  at: string;
  /** Who — the acting user's id (null for pre-auth events like failed login). */
  actorId: string | null;
  /** Who — display name or email of the actor. */
  actor: string;
  /** What — the tracked action. */
  action: AuditAction;
  category: AuditCategory;
  /** The object acted upon (employee name, project, "Invitation settings", …). */
  target: string;
  /** Optional type of the target (e.g. "employee", "project", "settings"). */
  targetType?: string;
  /** Value before the change, if applicable. */
  oldValue?: string | null;
  /** Value after the change, if applicable. */
  newValue?: string | null;
  /** Source IP — reserved for the server-side phase. */
  ip?: string | null;
  /** Originating device / user-agent — reserved for the server-side phase. */
  device?: string | null;
  /** Free-form structured context. */
  meta?: Record<string, unknown>;
}

/** Input to {@link recordAudit} — identity + timestamps are filled in for you. */
export interface AuditInput {
  action: AuditAction;
  target: string;
  targetType?: string;
  oldValue?: string | null;
  newValue?: string | null;
  /** Override the actor (e.g. the attempted email on a failed login). */
  actor?: string;
  actorId?: string | null;
  meta?: Record<string, unknown>;
}
