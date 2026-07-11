import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";
import type { ClientInsert, ClientRow, ClientUpdate } from "./types";

/**
 * ClientsService — CRUD for the `clients` table (migration 20260711120000,
 * snake-case schema). Clients are org-scoped via `company_id`; RLS restricts
 * writes to owner / admin / project_manager.
 */
export class ClientsService extends BaseService<ClientRow, ClientInsert, ClientUpdate> {
  protected readonly table = "clients";
  protected readonly entity = "Client";
  protected readonly defaultOrderBy = "company";

  /** Clients belonging to a company, ordered by name. */
  listByCompany(companyId: string, params: ListParams<ClientRow> = {}): Promise<ClientRow[]> {
    return this.list({
      direction: "asc",
      ...params,
      filters: { ...params.filters, company_id: companyId },
    });
  }
}

/** Shared singleton — import this, not the class. */
export const clientsService = new ClientsService();
