import { queryOptions } from "@tanstack/react-query";
import {
  getAttendanceHistory,
  getCompanySettings,
  getTeamToday,
  getTodaySession,
  type HistoryFilters,
} from "./api";

export const attendanceKeys = {
  all: ["attendance"] as const,
  settings: () => [...attendanceKeys.all, "settings"] as const,
  today: (userId: string) => [...attendanceKeys.all, "today", userId] as const,
  history: (userId: string, filters: HistoryFilters) =>
    [...attendanceKeys.all, "history", userId, filters] as const,
  team: () => [...attendanceKeys.all, "team-today"] as const,
};

export const companySettingsQuery = () =>
  queryOptions({
    queryKey: attendanceKeys.settings(),
    queryFn: getCompanySettings,
    staleTime: 5 * 60_000,
  });

export const todaySessionQuery = (userId: string) =>
  queryOptions({
    queryKey: attendanceKeys.today(userId),
    queryFn: () => getTodaySession(userId),
    enabled: !!userId,
    staleTime: 15_000,
  });

export const attendanceHistoryQuery = (userId: string, filters: HistoryFilters) =>
  queryOptions({
    queryKey: attendanceKeys.history(userId, filters),
    queryFn: () => getAttendanceHistory(userId, filters),
    enabled: !!userId,
    staleTime: 30_000,
  });

export const teamTodayQuery = () =>
  queryOptions({
    queryKey: attendanceKeys.team(),
    queryFn: getTeamToday,
    staleTime: 15_000,
  });
