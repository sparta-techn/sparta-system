import { queryOptions } from "@tanstack/react-query";

import { getAttendanceExceptionsInRange } from "./exceptions-api";

export const exceptionKeys = {
  all: ["attendance-exceptions"] as const,
  range: (from: string, to: string) => [...exceptionKeys.all, "range", from, to] as const,
};

/** Attendance exceptions across a `[from, to]` (`YYYY-MM-DD`) date range. */
export const attendanceExceptionsRangeQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: exceptionKeys.range(from, to),
    queryFn: () => getAttendanceExceptionsInRange(from, to),
    enabled: !!from && !!to,
    staleTime: 30_000,
  });
