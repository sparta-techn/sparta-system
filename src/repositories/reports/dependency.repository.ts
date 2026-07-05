import type { ListParams } from "@/services/core";
import {
  DependencyRequestsService,
  dependencyRequestsService,
  type DependencyPriority,
  type DependencyRequestInsert,
  type DependencyRequestRow,
  type DependencyRequestUpdate,
  type DependencyState,
} from "@/services/reports";

/**
 * DependencyRequestRepository — cross-team requests / blockers over
 * `public.dependency_requests` (migration 20260630130000). Delegates to
 * {@link DependencyRequestsService} and frames the state machine in domain terms.
 */
export class DependencyRequestRepository {
  constructor(private readonly service: DependencyRequestsService = dependencyRequestsService) {}

  // ── Reads ────────────────────────────────────────────────────────────────────

  get(id: string): Promise<DependencyRequestRow | null> {
    return this.service.getById(id);
  }

  getOrThrow(id: string): Promise<DependencyRequestRow> {
    return this.service.getByIdOrThrow(id);
  }

  list(params: ListParams<DependencyRequestRow> = {}): Promise<DependencyRequestRow[]> {
    return this.service.list(params);
  }

  listOpen(params: ListParams<DependencyRequestRow> = {}): Promise<DependencyRequestRow[]> {
    return this.service.listOpen(params);
  }

  listForRequester(
    requesterId: string,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.service.listByRequester(requesterId, params);
  }

  listForOwner(
    ownerId: string,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.service.listByOwner(ownerId, params);
  }

  listForDepartment(
    departmentId: string,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.service.listByDepartment(departmentId, params);
  }

  listByState(
    state: DependencyState,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.service.listByState(state, params);
  }

  // ── Writes ───────────────────────────────────────────────────────────────────

  create(input: DependencyRequestInsert): Promise<DependencyRequestRow> {
    return this.service.create(input);
  }

  update(id: string, patch: DependencyRequestUpdate): Promise<DependencyRequestRow> {
    return this.service.update(id, patch);
  }

  setState(id: string, state: DependencyState): Promise<DependencyRequestRow> {
    return this.service.setState(id, state);
  }

  setPriority(id: string, priority: DependencyPriority): Promise<DependencyRequestRow> {
    return this.service.setPriority(id, priority);
  }

  assignOwner(id: string, ownerId: string | null): Promise<DependencyRequestRow> {
    return this.service.setOwner(id, ownerId);
  }

  // Semantic state transitions (thin wrappers over setState).
  accept(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "accepted");
  }
  start(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "in_progress");
  }
  block(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "blocked");
  }
  resolve(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "resolved");
  }
  reject(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "rejected");
  }
  cancel(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "cancelled");
  }
  close(id: string): Promise<DependencyRequestRow> {
    return this.service.setState(id, "closed");
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const dependencyRequestRepository = new DependencyRequestRepository();
