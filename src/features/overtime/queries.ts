import { queryOptions } from "@tanstack/react-query";

import {
  getMyTodayOvertime,
  getOvertimePayMonthSummary,
  getOvertimePayReport,
  getPendingOvertimeQueue,
} from "./api";

export const overtimeKeys = {
  all: ["overtime"] as const,
  today: (userId: string) => [...overtimeKeys.all, "today", userId] as const,
  queue: () => [...overtimeKeys.all, "queue"] as const,
  payReport: (employeeId: string, from: string, to: string) =>
    [...overtimeKeys.all, "pay-report", employeeId, from, to] as const,
  paySummary: (from: string, to: string) => [...overtimeKeys.all, "pay-summary", from, to] as const,
};

/** The current user's overtime session today. `userId` scopes the cache key. */
export const myTodayOvertimeQuery = (userId: string) =>
  queryOptions({
    queryKey: overtimeKeys.today(userId),
    queryFn: getMyTodayOvertime,
    enabled: !!userId,
    staleTime: 15_000,
  });

/** Manager approval queue: logged, still-pending overtime sessions. */
export const pendingOvertimeQueueQuery = () =>
  queryOptions({
    queryKey: overtimeKeys.queue(),
    queryFn: getPendingOvertimeQueue,
    staleTime: 15_000,
  });

/** Authoritative overtime pay report for one employee (payroll.view gated). */
export const overtimePayReportQuery = (employeeId: string, from: string, to: string) =>
  queryOptions({
    queryKey: overtimeKeys.payReport(employeeId, from, to),
    queryFn: () => getOvertimePayReport(employeeId, from, to),
    enabled: !!employeeId && !!from && !!to,
    staleTime: 30_000,
  });

/** Per-employee approved-overtime pay totals for a month (payroll.view gated). */
export const overtimePaySummaryQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: overtimeKeys.paySummary(from, to),
    queryFn: () => getOvertimePayMonthSummary(from, to),
    enabled: !!from && !!to,
    staleTime: 30_000,
  });
