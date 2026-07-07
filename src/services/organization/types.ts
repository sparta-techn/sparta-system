/**
 * Row / insert / update shapes for the organization backbone.
 *
 * These mirror the Postgres tables created in
 * `supabase/migrations/20260702120000_bootstrap_org_registration.sql`
 * (`companies`, `workspaces`, `system_settings`). Columns are **snake_case**
 * because the generic {@link BaseService} forwards filter keys and `orderBy`
 * straight to PostgREST.
 */

// ── Companies ────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  timezone: string;
  /** Logo URL (Storage bucket is out of MVP scope — a plain URL for now). */
  logo_url: string | null;
  support_email: string | null;
  /** Company-local working hours as `'HH:MM'`, or null when unset. */
  work_start_time: string | null;
  work_end_time: string | null;
  /** Working days as short names, e.g. `['Mon','Tue',…]`. */
  working_days: string[];
  primary_owner_id: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInsert = Pick<Company, "name" | "slug"> &
  Partial<
    Pick<
      Company,
      | "legal_name"
      | "timezone"
      | "logo_url"
      | "support_email"
      | "work_start_time"
      | "work_end_time"
      | "working_days"
      | "primary_owner_id"
      | "is_active"
    >
  >;

export type CompanyUpdate = Partial<CompanyInsert> & {
  updated_by?: string | null;
};

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkspaceInsert = Pick<Workspace, "company_id" | "name" | "slug"> &
  Partial<Pick<Workspace, "description" | "is_default">>;

export type WorkspaceUpdate = Partial<Omit<WorkspaceInsert, "company_id">> & {
  archived_at?: string | null;
  updated_by?: string | null;
};

// ── System settings (singleton) ──────────────────────────────────────────────

export interface SystemSettings {
  /** Always `true` — the table holds a single row keyed on a boolean. */
  id: boolean;
  is_bootstrapped: boolean;
  public_registration_enabled: boolean;
  company_id: string | null;
  bootstrapped_at: string | null;
  bootstrapped_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SystemSettingsUpdate = Partial<
  Pick<
    SystemSettings,
    | "is_bootstrapped"
    | "public_registration_enabled"
    | "company_id"
    | "bootstrapped_at"
    | "bootstrapped_by"
  >
>;
