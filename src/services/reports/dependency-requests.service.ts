import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import { resolvedAtFor, TERMINAL_DEPENDENCY_STATES } from "./rules";
import type {
  DependencyPriority,
  DependencyRequestInsert,
  DependencyRequestRow,
  DependencyRequestUpdate,
  DependencyState,
} from "./types";

/** States that count as no-longer-open (open until resolved). */
const CLOSED_STATES = TERMINAL_DEPENDENCY_STATES;

/**
 * DependencyRequestsService — cross-team requests / blockers
 * (`public.dependency_requests`). State transitions stamp `resolved_at` when a
 * request reaches a resolved/closed state and clear it when reopened.
 */
export class DependencyRequestsService extends BaseService<
  DependencyRequestRow,
  DependencyRequestInsert,
  DependencyRequestUpdate
> {
  protected readonly table = "dependency_requests";
  protected readonly entity = "Dependency request";
  protected readonly defaultOrderBy = "created_at";

  /** Move a request to a new state, maintaining `resolved_at` (open until resolved). */
  setState(id: string, state: DependencyState): Promise<DependencyRequestRow> {
    return this.update(id, { state, resolved_at: resolvedAtFor(state) });
  }

  /** Re-prioritize a request. */
  setPriority(id: string, priority: DependencyPriority): Promise<DependencyRequestRow> {
    return this.update(id, { priority });
  }

  /** Assign (or clear) the owner of a request. */
  setOwner(id: string, ownerId: string | null): Promise<DependencyRequestRow> {
    return this.update(id, { owner_id: ownerId });
  }

  /** Open requests (not resolved/closed/cancelled/rejected), newest first. */
  async listOpen(params: ListParams<DependencyRequestRow> = {}): Promise<DependencyRequestRow[]> {
    try {
      const orderBy = params.orderBy ?? this.defaultOrderBy;
      const { data, error } = await this.client
        .from(this.table)
        .select(params.select ?? "*")
        .not("state", "in", `(${CLOSED_STATES.join(",")})`)
        .order(orderBy, { ascending: params.direction === "asc" });
      if (error) throw error;
      return (data ?? []) as unknown as DependencyRequestRow[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  listByState(
    state: DependencyState,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.list({ ...params, filters: { ...params.filters, state } });
  }

  listByRequester(
    requesterId: string,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.list({ ...params, filters: { ...params.filters, requester_id: requesterId } });
  }

  listByOwner(
    ownerId: string,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.list({ ...params, filters: { ...params.filters, owner_id: ownerId } });
  }

  listByDepartment(
    departmentId: string,
    params: ListParams<DependencyRequestRow> = {},
  ): Promise<DependencyRequestRow[]> {
    return this.list({ ...params, filters: { ...params.filters, department_id: departmentId } });
  }
}

/** Shared singleton — import this, not the class. */
export const dependencyRequestsService = new DependencyRequestsService();
