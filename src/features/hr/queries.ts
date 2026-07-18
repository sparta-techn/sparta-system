/**
 * TanStack Query option factories for the HR module (Supabase-backed).
 * Mirrors the `attendance` feature's query pattern: a structured key hierarchy
 * plus `queryOptions` consumed by `useQuery` in the HR components.
 */
import { queryOptions } from "@tanstack/react-query";

import {
  fetchDefaultCurrency,
  fetchEmployeeCompensation,
  fetchHrDepartments,
  fetchHrEmployees,
  fetchHrEmploymentTypes,
  fetchHrTeams,
} from "./api";

export const hrKeys = {
  all: ["hr"] as const,
  employees: () => [...hrKeys.all, "employees"] as const,
  departments: () => [...hrKeys.all, "departments"] as const,
  teams: () => [...hrKeys.all, "teams"] as const,
  employmentTypes: () => [...hrKeys.all, "employment-types"] as const,
  compensation: (employeeId: string) => [...hrKeys.all, "compensation", employeeId] as const,
  defaultCurrency: () => [...hrKeys.all, "default-currency"] as const,
};

export const hrQueries = {
  employees: () =>
    queryOptions({
      queryKey: hrKeys.employees(),
      queryFn: fetchHrEmployees,
      staleTime: 60_000,
    }),
  departments: () =>
    queryOptions({
      queryKey: hrKeys.departments(),
      queryFn: fetchHrDepartments,
      staleTime: 5 * 60_000,
    }),
  teams: () =>
    queryOptions({
      queryKey: hrKeys.teams(),
      queryFn: fetchHrTeams,
      staleTime: 5 * 60_000,
    }),
  employmentTypes: () =>
    queryOptions({
      queryKey: hrKeys.employmentTypes(),
      queryFn: fetchHrEmploymentTypes,
      staleTime: 10 * 60_000,
    }),
  compensation: (employeeId: string) =>
    queryOptions({
      queryKey: hrKeys.compensation(employeeId),
      queryFn: () => fetchEmployeeCompensation(employeeId),
      staleTime: 60_000,
    }),
  defaultCurrency: () =>
    queryOptions({
      queryKey: hrKeys.defaultCurrency(),
      queryFn: fetchDefaultCurrency,
      staleTime: 10 * 60_000,
    }),
};
