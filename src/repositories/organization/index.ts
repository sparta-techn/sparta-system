/**
 * Organization repository layer.
 *
 * Domain-facing data API over the organization services
 * (`companies`, `workspaces`, `system_settings` — migrations 20260702120000
 * and 20260707120000). Import the singletons from `@/repositories/organization`.
 *
 * NOTE: intentionally NOT re-exported from the root `@/repositories` barrel —
 * same convention as `@/repositories/reports` and `@/repositories/hr`.
 */
export {
  CompanyRepository,
  companyRepository,
  LOGO_ACCEPTED_MIME,
  LOGO_MAX_BYTES,
} from "./company.repository";
