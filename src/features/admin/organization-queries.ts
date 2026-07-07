/**
 * TanStack Query option factory for the organization identity (`companies`).
 * Mirrors the HR module's query pattern; consumed by the Organization settings
 * panel in the Admin Console.
 */
import { queryOptions } from "@tanstack/react-query";

import { companyRepository } from "@/repositories/organization";

export const orgKeys = {
  all: ["organization"] as const,
  company: () => [...orgKeys.all, "company"] as const,
};

export const orgQueries = {
  company: () =>
    queryOptions({
      queryKey: orgKeys.company(),
      queryFn: () => companyRepository.getPrimary(),
      staleTime: 5 * 60_000,
    }),
};
