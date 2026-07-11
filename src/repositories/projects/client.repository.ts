import type { ListParams } from "@/services/core";
import {
  ClientsService,
  clientsService,
  type ClientInsert,
  type ClientRow,
  type ClientUpdate,
} from "@/services/projects";

/**
 * ClientRepository — domain operations for CRM clients over the `clients` table.
 * Delegates persistence to {@link ClientsService}; the projects → clients link
 * lives on `projects.client_id`.
 */
export class ClientRepository {
  constructor(private readonly service: ClientsService = clientsService) {}

  list(params: ListParams<ClientRow> = {}): Promise<ClientRow[]> {
    return this.service.list({ direction: "asc", ...params });
  }

  listByCompany(companyId: string, params: ListParams<ClientRow> = {}): Promise<ClientRow[]> {
    return this.service.listByCompany(companyId, params);
  }

  getById(id: string): Promise<ClientRow | null> {
    return this.service.getById(id);
  }

  create(input: ClientInsert): Promise<ClientRow> {
    return this.service.create(input);
  }

  update(id: string, patch: ClientUpdate): Promise<ClientRow> {
    return this.service.update(id, patch);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const clientRepository = new ClientRepository();
