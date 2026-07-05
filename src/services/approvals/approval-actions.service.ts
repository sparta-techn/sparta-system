import { BaseService } from "../core/base-service";
import { ServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { ApprovalActionInsert, ApprovalActionRow } from "./types";

/**
 * ApprovalActionsService — the **append-only** decision/audit trail for approval
 * requests (`approval_actions`, migration 20260701120000). Rows are immutable
 * (SELECT / INSERT grants only); update / upsert / remove are blocked.
 */
export class ApprovalActionsService extends BaseService<ApprovalActionRow, ApprovalActionInsert> {
  protected readonly table = "approval_actions";
  protected readonly entity = "Approval action";
  protected readonly defaultOrderBy = "created_at";

  /** Append an action to a request's trail. */
  log(action: ApprovalActionInsert): Promise<ApprovalActionRow> {
    return this.create(action);
  }

  /** A request's action trail, oldest first. */
  listForRequest(
    approvalRequestId: string,
    params: ListParams<ApprovalActionRow> = {},
  ): Promise<ApprovalActionRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, approval_request_id: approvalRequestId },
      direction: params.direction ?? "asc",
    });
  }

  // ── Append-only guards ─────────────────────────────────────────────────────

  override update(): Promise<ApprovalActionRow> {
    return Promise.reject(new ServiceError("Approval actions are append-only", "append_only"));
  }
  override upsert(): Promise<ApprovalActionRow> {
    return Promise.reject(new ServiceError("Approval actions are append-only", "append_only"));
  }
  override remove(): Promise<void> {
    return Promise.reject(new ServiceError("Approval actions are append-only", "append_only"));
  }
}

/** Shared singleton — import this, not the class. */
export const approvalActionsService = new ApprovalActionsService();
