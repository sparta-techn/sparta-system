import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { Company, CompanyInsert, CompanyUpdate } from "./types";

/**
 * CompaniesService — CRUD for the organization identity (`public.companies`).
 *
 * A SpartaFlow deployment is single-company in practice (the row created during
 * {@link ../../repositories/bootstrap bootstrap}), but the table is modelled as
 * a normal collection. Writes are gated to `owner` / `admin` by RLS.
 */
export class CompaniesService extends BaseService<Company, CompanyInsert, CompanyUpdate> {
  protected readonly table = "companies";
  protected readonly entity = "Company";
  protected readonly defaultOrderBy = "name";

  /** Resolve a company by its unique slug. */
  async getBySlug(slug: string): Promise<Company | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Company | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /**
   * The primary (first, active) company. Convenience for the single-company
   * deployment shape — returns `null` before bootstrap has run.
   */
  async getPrimary(): Promise<Company | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Company | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const companiesService = new CompaniesService();
