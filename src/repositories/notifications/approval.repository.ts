import type { ListParams } from "@/services/core";
import {
  ApprovalActionsService,
  approvalActionsService,
  ApprovalRequestsService,
  approvalRequestsService,
  type ApprovalActionRow,
  type ApprovalRequestInsert,
  type ApprovalRequestRow,
  type ApprovalStatus,
} from "@/services/approvals";

/**
 * ApprovalRepository — approval-request workflow over `approval_requests` +
 * `approval_actions`. Each decision updates the request **and** appends an
 * immutable action row (the audit trail).
 *
 * NOTE: request update + action append are two statements (not transactional).
 * A `decide_approval` SECURITY DEFINER RPC would make this atomic and enforce
 * eligibility server-side; that is the planned hardening (see
 * `docs/COLLABORATION_PLAN.md §4`).
 */
export class ApprovalRepository {
  constructor(
    private readonly requests: ApprovalRequestsService = approvalRequestsService,
    private readonly actions: ApprovalActionsService = approvalActionsService,
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────────
  /** An approver's queue (pending by default). */
  queue(
    assigneeId: string,
    status: ApprovalStatus = "pending",
    params: ListParams<ApprovalRequestRow> = {},
  ): Promise<ApprovalRequestRow[]> {
    return this.requests.listForApprover(assigneeId, status, params);
  }

  /** Requests a user has raised. */
  raised(
    requesterId: string,
    params: ListParams<ApprovalRequestRow> = {},
  ): Promise<ApprovalRequestRow[]> {
    return this.requests.listForRequester(requesterId, params);
  }

  forEntity(entityType: string, entityId: string): Promise<ApprovalRequestRow[]> {
    return this.requests.listForEntity(entityType, entityId);
  }

  pendingCount(assigneeId: string): Promise<number> {
    return this.requests.pendingCount(assigneeId);
  }

  getById(id: string): Promise<ApprovalRequestRow | null> {
    return this.requests.getById(id);
  }

  /** A request's action/audit trail. */
  history(approvalRequestId: string): Promise<ApprovalActionRow[]> {
    return this.actions.listForRequest(approvalRequestId);
  }

  // ── Writes ───────────────────────────────────────────────────────────────
  async raise(input: ApprovalRequestInsert): Promise<ApprovalRequestRow> {
    const request = await this.requests.create(input);
    await this.actions.log({ approval_request_id: request.id, action: "requested" });
    return request;
  }

  async approve(id: string, deciderId: string, note?: string): Promise<ApprovalRequestRow> {
    const request = await this.requests.decide(id, "approved", deciderId, note);
    await this.actions.log({ approval_request_id: id, action: "approved", note: note ?? null });
    return request;
  }

  async reject(id: string, deciderId: string, note?: string): Promise<ApprovalRequestRow> {
    const request = await this.requests.decide(id, "rejected", deciderId, note);
    await this.actions.log({ approval_request_id: id, action: "rejected", note: note ?? null });
    return request;
  }

  async cancel(id: string, deciderId: string, note?: string): Promise<ApprovalRequestRow> {
    const request = await this.requests.decide(id, "cancelled", deciderId, note);
    await this.actions.log({ approval_request_id: id, action: "cancelled", note: note ?? null });
    return request;
  }

  async reassign(id: string, assigneeId: string | null): Promise<ApprovalRequestRow> {
    const request = await this.requests.reassign(id, assigneeId);
    await this.actions.log({
      approval_request_id: id,
      action: "reassigned",
      meta: { assignee_id: assigneeId },
    });
    return request;
  }
}

/** Shared singleton — import this, not the class. */
export const approvalRepository = new ApprovalRepository();
