/**
 * HR data access — Supabase-backed reads that map the real HR tables
 * (`employees`, `profiles`, `departments`, `teams`, `positions`,
 * `employment_types`, `employee_profiles`, `user_roles`) onto the **existing**
 * mock view-model shapes (`HrEmployee`, `HrTeam`, …) so the current UI renders
 * unchanged.
 *
 * Only the Employee directory, Employee details, Departments, Teams and Roles
 * surfaces consume this. The remaining HR tabs (leave, documents, audit, …)
 * still read their mock seed arrays — they are out of scope here.
 *
 * Uses the relaxed `db` client (these tables are not yet in the generated
 * Supabase `Database` types) plus the HR repositories for simple single-table
 * reads.
 */
import { db } from "@/services/core";
import { departmentRepository, teamRepository } from "@/repositories/hr";
import {
  ROLE_RANK,
  type AppRole,
  type EmployeeStatus as DbEmployeeStatus,
} from "@/features/auth/types";
import type { Department, EmployeeRole, EmploymentStatus, HrEmployee, HrTeam } from "./mock-data";

// ── Mappers ────────────────────────────────────────────────────────────────

const ROLE_TO_MOCK: Record<AppRole, EmployeeRole> = {
  owner: "owner",
  admin: "admin",
  hr: "hr",
  project_manager: "manager",
  team_lead: "team_lead",
  employee: "employee",
  intern: "employee",
  viewer: "employee",
};

const STATUS_TO_MOCK: Record<DbEmployeeStatus, EmploymentStatus> = {
  active: "active",
  invited: "invited",
  suspended: "deactivated",
  offboarded: "offboarding",
};

/** Pick the highest-ranked role a user holds and map it to the UI role enum. */
function pickRole(roles: AppRole[]): EmployeeRole {
  if (roles.length === 0) return "employee";
  const top = [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
  return ROLE_TO_MOCK[top];
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

/** Deterministic avatar hue from the row id (cosmetic only). */
function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function formatBirthday(date: string | null | undefined): string {
  if (!date) return "—";
  // "YYYY-MM-DD" -> "MM-DD"
  const parts = date.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : "—";
}

function normalizeWorkMode(mode: string | null | undefined): HrEmployee["workMode"] {
  return (mode ?? "").toLowerCase() === "hybrid" ? "Hybrid" : "Remote";
}

/** PostgREST embeds can come back as object or single-element array. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

type Embed<T> = T | T[] | null;

interface ProfileEmbed {
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  timezone: string | null;
}

interface DetailsEmbed {
  birth_date: string | null;
  phone: string | null;
  city: string | null;
}

interface EmployeeRow {
  id: string;
  user_id: string;
  status: DbEmployeeStatus;
  manager_id: string | null;
  hire_date: string | null;
  created_at: string | null;
  work_location: string | null;
  work_mode: string | null;
  department: Embed<{ name: string }>;
  team: Embed<{ name: string }>;
  position: Embed<{ title: string }>;
  employment_type: Embed<{ name: string }>;
  profile: Embed<ProfileEmbed>;
  details: Embed<DetailsEmbed>;
}

function mapEmployee(r: EmployeeRow, rolesByUser: Map<string, AppRole[]>): HrEmployee {
  const profile = one(r.profile);
  const details = one(r.details);
  const dept = one(r.department);
  const team = one(r.team);
  const position = one(r.position);
  const empType = one(r.employment_type);
  const name = profile?.full_name || profile?.display_name || profile?.email || "Unknown";

  return {
    id: r.id,
    userId: r.user_id,
    name,
    initials: initialsOf(name),
    email: profile?.email ?? "",
    phone: details?.phone ?? undefined,
    avatarHue: hueOf(r.id),
    department: (dept?.name ?? "—") as Department,
    team: team?.name ?? "—",
    jobTitle: position?.title ?? profile?.job_title ?? "—",
    role: pickRole(rolesByUser.get(r.user_id) ?? []),
    status: STATUS_TO_MOCK[r.status] ?? "active",
    managerId: r.manager_id ?? null,
    joinedAt: r.hire_date ?? r.created_at ?? new Date().toISOString(),
    birthday: formatBirthday(details?.birth_date),
    location: r.work_location ?? details?.city ?? "—",
    timezone: profile?.timezone ?? "—",
    employmentType: (empType?.name ?? "Full-time") as HrEmployee["employmentType"],
    workMode: normalizeWorkMode(r.work_mode),
  };
}

async function fetchRolesByUser(userIds: string[]): Promise<Map<string, AppRole[]>> {
  const map = new Map<string, AppRole[]>();
  if (userIds.length === 0) return map;
  const { data, error } = await db
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);
  if (error) throw error;
  for (const row of (data ?? []) as { user_id: string; role: AppRole }[]) {
    const arr = map.get(row.user_id) ?? [];
    arr.push(row.role);
    map.set(row.user_id, arr);
  }
  return map;
}

// ── Public reads ─────────────────────────────────────────────────────────

/** Full employee directory, mapped to the UI `HrEmployee` shape. */
export async function fetchHrEmployees(): Promise<HrEmployee[]> {
  const { data, error } = await db.from("employees").select(`
      id, user_id, status, manager_id, hire_date, created_at, work_location, work_mode,
      department:departments!employees_department_id_fkey ( name ),
      team:teams!employees_team_id_fkey ( name ),
      position:positions ( title ),
      employment_type:employment_types ( name ),
      profile:profiles ( full_name, display_name, email, avatar_url, job_title, timezone ),
      details:employee_profiles ( birth_date, phone, city )
    `);
  if (error) throw error;

  const rows = (data ?? []) as unknown as EmployeeRow[];
  const rolesByUser = await fetchRolesByUser(rows.map((r) => r.user_id));
  // Soft-deleted employees carry status 'offboarded' (mock: 'offboarding'). RLS
  // still returns them to HR/owner/admin, so hide them from the directory here
  // to preserve the "removed" UX (mirrors the former localStorage soft-delete).
  return rows.map((r) => mapEmployee(r, rolesByUser)).filter((e) => e.status !== "offboarding");
}

/** Active department names (used by the directory filter + org structure). */
export async function fetchHrDepartments(): Promise<string[]> {
  const departments = await departmentRepository.listActive();
  return departments.map((d) => d.name);
}

/** A selectable employment type (Full-time / Part-time / …) from the reference table. */
export interface HrEmploymentType {
  id: string;
  name: string;
  slug: string;
}

/**
 * Active employment types (reference data) for the invite / edit selectors.
 * Ordered by name so Full-time / Part-time surface predictably.
 */
export async function fetchHrEmploymentTypes(): Promise<HrEmploymentType[]> {
  const { data, error } = await db
    .from("employment_types")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HrEmploymentType[];
}

/** Active teams, mapped to the UI `HrTeam` shape (with member counts). */
export async function fetchHrTeams(): Promise<HrTeam[]> {
  const [teams, departments] = await Promise.all([
    teamRepository.listActive(),
    departmentRepository.listActive(),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  // Member counts per team.
  const { data, error } = await db.from("employees").select("team_id");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { team_id: string | null }[]) {
    if (!row.team_id) continue;
    counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
  }

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    department: (t.department_id ? (deptName.get(t.department_id) ?? "—") : "—") as Department,
    leadId: t.lead_id ?? "",
    memberCount: counts.get(t.id) ?? 0,
  }));
}
