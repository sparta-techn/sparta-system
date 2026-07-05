/**
 * Row / insert / update shapes for the HR backend.
 *
 * These mirror the Postgres tables created in
 * `supabase/migrations/20260630120100_hr_org_and_employees.sql`
 * (`departments`, `teams`, `positions`, `employees`). Columns are **snake_case**
 * because the generic {@link BaseService} forwards filter keys and `orderBy`
 * straight to PostgREST.
 *
 * The mock `HrEmployee` shape in `features/hr` is intentionally *not* reused —
 * it is UI scaffolding with a different shape; the frontend stays untouched.
 */
import type { EmployeeStatus } from "@/features/auth/types";

export type { EmployeeStatus };

// ── Departments ────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  lead_id: string | null;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DepartmentInsert = Pick<Department, "name" | "slug"> &
  Partial<Pick<Department, "description" | "lead_id">>;

export type DepartmentUpdate = Partial<DepartmentInsert> & {
  archived_at?: string | null;
  updated_by?: string | null;
};

// ── Teams ──────────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  department_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  lead_id: string | null;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TeamInsert = Pick<Team, "name" | "slug"> &
  Partial<Pick<Team, "department_id" | "description" | "lead_id">>;

export type TeamUpdate = Partial<TeamInsert> & {
  archived_at?: string | null;
  updated_by?: string | null;
};

// ── Positions ──────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  title: string;
  slug: string;
  department_id: string | null;
  level: string | null;
  description: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PositionInsert = Pick<Position, "title" | "slug"> &
  Partial<Pick<Position, "department_id" | "level" | "description" | "is_active">>;

export type PositionUpdate = Partial<PositionInsert> & {
  archived_at?: string | null;
  updated_by?: string | null;
};

// ── Employees ──────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  user_id: string;
  employee_code: string | null;
  department_id: string | null;
  team_id: string | null;
  position_id: string | null;
  employment_type_id: string | null;
  manager_id: string | null;
  status: EmployeeStatus;
  work_location: string | null;
  work_mode: string | null;
  hire_date: string | null;
  end_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeInsert = Pick<Employee, "user_id"> &
  Partial<
    Pick<
      Employee,
      | "employee_code"
      | "department_id"
      | "team_id"
      | "position_id"
      | "employment_type_id"
      | "manager_id"
      | "status"
      | "work_location"
      | "work_mode"
      | "hire_date"
      | "end_date"
    >
  >;

export type EmployeeUpdate = Partial<Omit<EmployeeInsert, "user_id">> & {
  updated_by?: string | null;
};
