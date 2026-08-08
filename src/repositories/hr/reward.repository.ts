import { RewardsService, rewardsService, type Reward, type RewardStatus } from "@/services/hr";

/**
 * RewardRepository (HR) — domain operations for one-off monetary rewards
 * (`public.rewards`). Delegates persistence to {@link RewardsService}; the
 * email send itself goes through the `sendRewardFn` server RPC
 * (`features/rewards/rewards.functions.ts`), never through this repository.
 *
 * Reads and writes are RLS-gated to owner / admin.
 */
export class RewardRepository {
  constructor(private readonly service: RewardsService = rewardsService) {}

  /** Create a `pending` reward for an employee (the send is a separate step). */
  createReward(
    employeeId: string,
    amount: number,
    currency: string,
    reason?: string,
  ): Promise<Reward> {
    return this.service.createReward(employeeId, amount, currency, reason);
  }

  /** Reward history, most recent first, optionally filtered. */
  listRewards(filters: { employeeId?: string; status?: RewardStatus } = {}): Promise<Reward[]> {
    return this.service.listRewards(filters);
  }

  /** One reward by id (throws when missing). */
  getReward(id: string): Promise<Reward> {
    return this.service.getReward(id);
  }
}

/** Shared singleton — import this, not the class. */
export const rewardRepository = new RewardRepository();
