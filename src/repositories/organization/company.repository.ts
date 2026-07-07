import {
  CompaniesService,
  companiesService,
  type Company,
  type CompanyUpdate,
} from "@/services/organization";

/**
 * CompanyRepository — domain-facing API over the organization identity
 * (`public.companies`, migrations 20260702120000 + 20260707120000).
 *
 * The deployment is single-company in practice, so the org-settings UI reads
 * {@link getPrimary} and writes through {@link update}. Delegates to
 * {@link CompaniesService}; writes are gated to owner/admin by RLS.
 */
export class CompanyRepository {
  constructor(private readonly service: CompaniesService = companiesService) {}

  /** The primary (first, active) company — the org whose settings are edited. */
  getPrimary(): Promise<Company | null> {
    return this.service.getPrimary();
  }

  getById(id: string): Promise<Company | null> {
    return this.service.getById(id);
  }

  /** Patch an existing company's settings (name, timezone, logo, hours, …). */
  update(id: string, patch: CompanyUpdate): Promise<Company> {
    return this.service.update(id, patch);
  }
}

/** Shared singleton — import this, not the class. */
export const companyRepository = new CompanyRepository();
