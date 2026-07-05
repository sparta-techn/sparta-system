/**
 * Organization services — the company / workspace / platform-settings backbone.
 *
 * These sit over the tables added in
 * `supabase/migrations/20260702120000_bootstrap_org_registration.sql` and are
 * composed by the {@link ../../repositories/bootstrap bootstrap} orchestrator
 * as well as ordinary feature code (via repositories).
 */
export { companiesService, CompaniesService } from "./companies.service";
export { workspacesService, WorkspacesService } from "./workspaces.service";
export { systemSettingsService, SystemSettingsService } from "./system-settings.service";
export type {
  Company,
  CompanyInsert,
  CompanyUpdate,
  Workspace,
  WorkspaceInsert,
  WorkspaceUpdate,
  SystemSettings,
  SystemSettingsUpdate,
} from "./types";
