import { BaseService } from "../core/base-service";
import type { Reward, RewardInsert, RewardStatus, RewardUpdate } from "./types";

/**
 * RewardsService — one-off monetary rewards (`public.rewards`).
 *
 * Owner/admin gated by RLS (same role set as `PROJECT_DELETE_ROLES`). A row is
 * created `pending` from the UI; the send-reward server function emails the
 * employee and stamps the outcome (`sent` + `sent_at`, or `failed` +
 * `error_message`) via service_role. Failures are never silent: the DB rejects
 * a `failed` row without an error message.
 *
 * v1 sends to one employee at a time (bulk/multi-select is a follow-up).
 */
export class RewardsService extends BaseService<Reward, RewardInsert, RewardUpdate> {
  protected readonly table = "rewards";
  protected readonly entity = "Reward";

  /** Create a `pending` reward row; the email send is a separate step. */
  async createReward(
    employeeId: string,
    amount: number,
    currency: string,
    reason?: string,
  ): Promise<Reward> {
    return this.create({
      employee_id: employeeId,
      amount,
      currency,
      reason: reason?.trim() ? reason.trim() : undefined,
    });
  }

  /** Reward history, most recent first, optionally filtered. */
  async listRewards(
    filters: { employeeId?: string; status?: RewardStatus } = {},
  ): Promise<Reward[]> {
    return this.list({
      filters: { employee_id: filters.employeeId, status: filters.status },
      orderBy: "created_at",
      direction: "desc",
    });
  }

  /** Fetch one reward, throwing {@link ServiceError} when missing. */
  async getReward(id: string): Promise<Reward> {
    return this.getByIdOrThrow(id);
  }
}

/** Shared singleton — import this, not the class. */
export const rewardsService = new RewardsService();
