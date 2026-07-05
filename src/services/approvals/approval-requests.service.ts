import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type {
  ApprovalRequestInsert,
  ApprovalRequestRow,
  ApprovalRequestUpdate,
  ApprovalStatus,
} from "./types";

/**
 * ApprovalRequestsService — CRUD over the `approval_requests` table (migration
 * 20260701120000). RLS scopes reads to the requester, assignee, or admins.
 * Decisions stamp `status` / `decided_by` / `decided_at` (paired with an
 * append-only `approval_actions` row, written via the repository).
 */
export class ApprovalRequestsService extends BaseService<
  ApprovalRequestRow,
  ApprovalRequestInsert,
  ApprovalRequestUpdate
> {
  protected readonly table = "approval_requests";
  protected readonly entity = "Approval request";
  protected readonly defaultOrderBy = "created_at";

  /** Requests awaiting a given approver (assignee), optionally by status. */
  listForApprover(
    assigneeId: string,
    status?: ApprovalStatus,
    params: ListParams<ApprovalRequestRow> = {},
  ): Promise<ApprovalRequestRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, assignee_id: assigneeId, ...(status ? { status } : {}) },
    });
  }

  /** Requests raised by a given user. */
  listForRequester(
    requesterId: string,
    params: ListParams<ApprovalRequestRow> = {},
  ): Promise<ApprovalRequestRow[]> {
    return this.list({ ...params, filters: { ...params.filters, requester_id: requesterId } });
  }

  /** Requests for a specific subject entity. */
  listForEntity(
    entityType: string,
    entityId: string,
    params: ListParams<ApprovalRequestRow> = {},
  ): Promise<ApprovalRequestRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, entity_type: entityType, entity_id: entityId },
    });
  }

  /** Count of pending requests for an approver (queue badge). */
  async pendingCount(assigneeId: string): Promise<number> {
    try {
      const { count, error } = await this.client
        .from(this.table)
        .select("id", { count: "exact", head: true })
        .eq("assignee_id", assigneeId)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      throw toServiceError(error, `Failed to count ${this.entity}`);
    }
  }

  /** Record a decision on a request (status + decider + timestamp). */
  decide(
    id: string,
    status: Extract<ApprovalStatus, "approved" | "rejected" | "cancelled">,
    deciderId: string,
    note?: string,
  ): Promise<ApprovalRequestRow> {
    return this.update(id, {
      status,
      decided_by: deciderId,
      decided_at: new Date().toISOString(),
      decision_note: note ?? null,
    });
  }

  /** Reassign a request to a different approver. */
  reassign(id: string, assigneeId: string | null): Promise<ApprovalRequestRow> {
    return this.update(id, { assignee_id: assigneeId });
  }
}

/** Shared singleton — import this, not the class. */
export const approvalRequestsService = new ApprovalRequestsService();
