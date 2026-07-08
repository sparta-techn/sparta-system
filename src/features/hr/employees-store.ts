/**
 * Employee management store — localStorage-backed reactive *overlay*.
 *
 * The employee directory + profile read the live, Supabase-backed list
 * (`hrQueries.employees()` → `HrEmployee[]`). This store layers the Owner/HR
 * *management actions* on top of that read: local field overrides, locally
 * created records, soft-deletes, and an audit trail. `useManagedEmployees`
 * merges a fetched base list with these overrides so the UI reflects every
 * action immediately, without regenerating the live read.
 *
 * Each verb here maps 1:1 to a method on the HR `employeeRepository`
 * (`@/repositories/hr`) — swapping the overlay for real writes (plus
 * `queryClient.invalidateQueries(hrKeys.employees())`) is a per-verb change
 * that leaves the components untouched. See `docs/EMPLOYEE_MANAGEMENT.md`.
 *
 * NOTE: **edit / disable / delete are now real Supabase writes** performed by
 * {@link useEmployeeManagement} (`./use-employee-management`), which invalidates
 * `hrKeys.employees()` on success and logs to the timeline via
 * {@link recordEmployeeAudit}. The overlay verbs for those actions remain here
 * (still exercised by the unit tests and reused by `createEmployee`) but are no
 * longer called by the directory UI. The remaining overlay verbs — assign
 * department/team/manager/role, reset password, create — are still
 * localStorage-only and are the next to migrate.
 */
import { useSyncExternalStore } from "react";

import { getCurrentActor } from "@/features/audit/audit-store";
import type { Department, EmployeeRole, EmploymentStatus, HrEmployee } from "./mock-data";

const KEY = "spartaflow:hr:employee-mgmt:v1";

export type EmployeeAuditAction =
  | "created"
  | "edited"
  | "deactivated"
  | "reactivated"
  | "suspended"
  | "soft_deleted"
  | "restored"
  | "password_reset"
  | "department_changed"
  | "manager_assigned"
  | "team_assigned"
  | "role_assigned";

export interface EmployeeAuditEntry {
  id: string;
  employeeId: string;
  at: string;
  actor: string;
  action: EmployeeAuditAction;
  detail?: string;
}

/** Per-employee local changes overlaid on the fetched record. */
export interface EmployeeOverride extends Partial<HrEmployee> {
  /** Set when soft-deleted; the record is hidden from the directory by default. */
  deletedAt?: string | null;
}

interface State {
  overrides: Record<string, EmployeeOverride>;
  /** Records created directly (not via invitation), not present in the live read. */
  created: HrEmployee[];
  audit: EmployeeAuditEntry[];
}

function defaultState(): State {
  return { overrides: {}, created: [], audit: [] };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      overrides: parsed.overrides ?? {},
      created: parsed.created ?? [],
      audit: parsed.audit ?? [],
    };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- helpers ----------

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function logAudit(employeeId: string, action: EmployeeAuditAction, detail?: string) {
  const entry: EmployeeAuditEntry = {
    id: uid("aud"),
    employeeId,
    at: new Date().toISOString(),
    // Attribute to the signed-in user (set by the auth layer); "System" pre-auth.
    actor: getCurrentActor().name,
    action,
    detail,
  };
  state = { ...state, audit: [entry, ...state.audit] };
}

/**
 * Record a management audit entry from outside the store (e.g. the real
 * Supabase write path in {@link useEmployeeManagement}), so server-backed
 * edit/disable/delete actions still appear in the per-employee timeline that
 * {@link useEmployeeAudit} renders.
 */
export function recordEmployeeAudit(
  employeeId: string,
  action: EmployeeAuditAction,
  detail?: string,
): void {
  logAudit(employeeId, action, detail);
  emit();
}

/** Merge one base record with its override (created records have no base). */
function applyOverride(base: HrEmployee, override: EmployeeOverride | undefined): HrEmployee {
  if (!override) return base;
  const { deletedAt: _deletedAt, ...fields } = override;
  return { ...base, ...fields };
}

// ---------- reads ----------

export function isSoftDeleted(id: string): boolean {
  return !!state.overrides[id]?.deletedAt;
}

/**
 * Merge a fetched base list with local created records + overrides.
 * Soft-deleted records are excluded unless `includeDeleted` is set.
 */
export function mergeEmployees(
  base: HrEmployee[],
  opts: { includeDeleted?: boolean } = {},
): HrEmployee[] {
  const merged = [...state.created, ...base].map((e) => applyOverride(e, state.overrides[e.id]));
  if (opts.includeDeleted) return merged;
  return merged.filter((e) => !state.overrides[e.id]?.deletedAt);
}

export function auditFor(employeeId: string): EmployeeAuditEntry[] {
  return state.audit.filter((a) => a.employeeId === employeeId);
}

export function useEmployeesOverlay(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => defaultState(),
  );
}

/** Reactive merged list — pass the fetched base in. */
export function useManagedEmployees(
  base: HrEmployee[],
  opts: { includeDeleted?: boolean } = {},
): HrEmployee[] {
  useEmployeesOverlay(); // subscribe to overlay changes
  return mergeEmployees(base, opts);
}

/** Reactive audit timeline for one employee. */
export function useEmployeeAudit(employeeId: string): EmployeeAuditEntry[] {
  useEmployeesOverlay();
  return auditFor(employeeId);
}

// ---------- writes ----------

export interface CreateEmployeeInput {
  name: string;
  email: string;
  department: Department;
  role: EmployeeRole;
  jobTitle?: string;
  team?: string;
  managerId?: string | null;
  location?: string;
  timezone?: string;
  employmentType?: HrEmployee["employmentType"];
  workMode?: HrEmployee["workMode"];
}

/**
 * @deprecated Local-only overlay create — no longer used by the UI. "New
 * employee" now provisions a real Supabase row via `inviteEmployeeFn`. Retained
 * only for the overlay unit tests; do not re-wire this into any component.
 */
export function createEmployee(input: CreateEmployeeInput): HrEmployee {
  const id = uid("emp_local");
  const name = input.name.trim();
  const employee: HrEmployee = {
    id,
    name,
    initials: initialsOf(name),
    email: input.email.trim().toLowerCase(),
    avatarHue: hueOf(id),
    department: input.department,
    team: input.team?.trim() || "—",
    jobTitle: input.jobTitle?.trim() || "—",
    role: input.role,
    status: "active",
    managerId: input.managerId ?? null,
    joinedAt: new Date().toISOString(),
    birthday: "—",
    location: input.location?.trim() || "—",
    timezone: input.timezone?.trim() || "—",
    employmentType: input.employmentType ?? "Full-time",
    workMode: input.workMode ?? "Remote",
  };
  state = { ...state, created: [employee, ...state.created] };
  logAudit(id, "created", `${employee.jobTitle} · ${employee.department}`);
  emit();
  return employee;
}

function setOverride(
  id: string,
  patch: EmployeeOverride,
  action: EmployeeAuditAction,
  detail?: string,
) {
  state = {
    ...state,
    overrides: { ...state.overrides, [id]: { ...state.overrides[id], ...patch } },
  };
  logAudit(id, action, detail);
  emit();
}

export interface EditEmployeeInput {
  name?: string;
  email?: string;
  jobTitle?: string;
  department?: Department;
  team?: string;
  role?: EmployeeRole;
  location?: string;
  timezone?: string;
  employmentType?: HrEmployee["employmentType"];
  workMode?: HrEmployee["workMode"];
}

/** General profile edit. Recomputes initials when the name changes. */
export function editEmployee(id: string, patch: EditEmployeeInput): void {
  const clean: EmployeeOverride = { ...patch };
  if (patch.name !== undefined) {
    clean.name = patch.name.trim();
    clean.initials = initialsOf(clean.name);
  }
  if (patch.email !== undefined) clean.email = patch.email.trim().toLowerCase();
  setOverride(id, clean, "edited");
}

export function changeDepartment(id: string, department: Department): void {
  setOverride(id, { department }, "department_changed", department);
}

export function assignManager(id: string, managerId: string | null, managerName?: string): void {
  setOverride(
    id,
    { managerId },
    "manager_assigned",
    managerId ? (managerName ?? managerId) : "None",
  );
}

export function assignTeam(id: string, team: string): void {
  setOverride(id, { team }, "team_assigned", team);
}

export function assignRole(id: string, role: EmployeeRole): void {
  setOverride(id, { role }, "role_assigned", role);
}

/** Reversible: revokes access but keeps the record. */
export function deactivateEmployee(id: string): void {
  setOverride(id, { status: "deactivated" }, "deactivated");
}

export function reactivateEmployee(id: string): void {
  setOverride(id, { status: "active" }, "reactivated");
}

/** Temporary hold (e.g. security review); reversible via reactivate. */
export function suspendEmployee(id: string): void {
  setOverride(id, { status: "suspended" }, "suspended");
}

/** Soft delete — hidden from the directory, record retained and restorable. */
export function softDeleteEmployee(id: string): void {
  setOverride(id, { deletedAt: new Date().toISOString() }, "soft_deleted");
}

export function restoreEmployee(id: string): void {
  setOverride(id, { deletedAt: null }, "restored");
}

/**
 * Trigger a password reset. No change to the employee record — in a live build
 * this calls `supabase.auth.resetPasswordForEmail(email)`; here it just audits.
 */
export function resetPassword(id: string, email: string): void {
  logAudit(id, "password_reset", email);
  emit();
}

/** Test/support helper — clear all local management state. */
export function __resetEmployeeMgmt(): void {
  state = defaultState();
  emit();
}
