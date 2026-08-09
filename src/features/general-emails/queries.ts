/**
 * TanStack Query option factories for the general (broadcast) email module.
 * Mirrors the rewards module: a structured key hierarchy plus `queryOptions`
 * consumed by `useQuery`. The employee list itself comes from the existing
 * `hrQueries.employees()` — not duplicated here.
 */
import { queryOptions } from "@tanstack/react-query";

import { companyRepository } from "@/repositories/organization";

import { listGeneralEmailsFn } from "./general-email.functions";

export const generalEmailKeys = {
  all: ["general-emails"] as const,
  history: () => [...generalEmailKeys.all, "history"] as const,
  company: () => [...generalEmailKeys.all, "company"] as const,
};

/** Past broadcasts, newest first, with per-recipient delivery status. */
export const generalEmailsHistoryQuery = () =>
  queryOptions({
    queryKey: generalEmailKeys.history(),
    queryFn: () => listGeneralEmailsFn(),
    staleTime: 30_000,
  });

/**
 * Org branding for the in-composer email preview — the same active company the
 * server-side sender resolves, so the preview matches the sent email.
 */
export const generalEmailCompanyQuery = () =>
  queryOptions({
    queryKey: generalEmailKeys.company(),
    queryFn: () => companyRepository.getPrimary(),
    staleTime: 5 * 60_000,
  });
