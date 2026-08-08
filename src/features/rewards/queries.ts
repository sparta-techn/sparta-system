/**
 * TanStack Query option factories for the rewards module. Mirrors the payroll
 * feature's query pattern: a structured key hierarchy plus `queryOptions`
 * consumed by `useQuery` in the rewards components. The employee list itself
 * comes from the existing `hrQueries.employees()` — not duplicated here.
 */
import { queryOptions } from "@tanstack/react-query";

import { rewardRepository } from "@/repositories/hr";
import { companyRepository } from "@/repositories/organization";
import type { RewardStatus } from "@/services/hr";

export const rewardKeys = {
  all: ["rewards"] as const,
  history: (filters: { employeeId?: string; status?: RewardStatus } = {}) =>
    [...rewardKeys.all, "history", filters] as const,
  company: () => [...rewardKeys.all, "company"] as const,
};

/** Reward history, most recent first (server-ordered). */
export const rewardsHistoryQuery = (filters: { employeeId?: string; status?: RewardStatus } = {}) =>
  queryOptions({
    queryKey: rewardKeys.history(filters),
    queryFn: () => rewardRepository.listRewards(filters),
    staleTime: 30_000,
  });

/**
 * Org branding for the in-dialog email preview — the same active company the
 * server-side sender resolves, so the preview matches the sent email.
 */
export const rewardCompanyQuery = () =>
  queryOptions({
    queryKey: rewardKeys.company(),
    queryFn: () => companyRepository.getPrimary(),
    staleTime: 5 * 60_000,
  });
