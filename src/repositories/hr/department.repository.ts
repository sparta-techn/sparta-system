import type { ListParams } from "@/services/core";
import {
  DepartmentsService,
  departmentsService,
  type Department,
  type DepartmentInsert,
  type DepartmentUpdate,
} from "@/services/hr";

/**
 * DepartmentRepository — domain operations for departments. Delegates
 * persistence to {@link DepartmentsService}; exposes the read/lifecycle surface
 * the UI/hooks consume. The service is injected (defaulting to the singleton) so
 * the repository stays unit-testable with a stub.
 */
export class DepartmentRepository {
  constructor(private readonly service: DepartmentsService = departmentsService) {}

  list(params: ListParams<Department> = {}): Promise<Department[]> {
    return this.service.list(params);
  }

  listActive(): Promise<Department[]> {
    return this.service.listActive();
  }

  getById(id: string): Promise<Department | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Department> {
    return this.service.getByIdOrThrow(id);
  }

  getBySlug(slug: string): Promise<Department | null> {
    return this.service.getBySlug(slug);
  }

  listByLead(leadId: string, params: ListParams<Department> = {}): Promise<Department[]> {
    return this.service.listByLead(leadId, params);
  }

  create(input: DepartmentInsert): Promise<Department> {
    return this.service.create(input);
  }

  update(id: string, patch: DepartmentUpdate): Promise<Department> {
    return this.service.update(id, patch);
  }

  setLead(id: string, leadId: string | null): Promise<Department> {
    return this.service.setLead(id, leadId);
  }

  archive(id: string): Promise<Department> {
    return this.service.archive(id);
  }

  restore(id: string): Promise<Department> {
    return this.service.restore(id);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const departmentRepository = new DepartmentRepository();
