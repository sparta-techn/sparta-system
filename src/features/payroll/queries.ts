import { queryOptions } from "@tanstack/react-query";

import { getPayrollReport } from "./api";

export const payrollKeys = {
  all: ["payroll"] as const,
  report: (from: string, to: string) => [...payrollKeys.all, "report", from, to] as const,
};

/** `YYYY-MM-DD` for a local date. */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** First/last day of a `YYYY-MM` month string, plus a display label. */
export function monthBounds(month: string): { from: string; to: string; label: string } {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return {
    from: iso(first),
    to: iso(last),
    label: first.toLocaleDateString([], { month: "long", year: "numeric" }),
  };
}

/** The current month as `YYYY-MM` (default picker value). */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** As-of date for a period: the export's absence horizon = min(to, today). */
export function asOfDate(to: string): string {
  const today = iso(new Date());
  return to < today ? to : today;
}

export const payrollReportQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: payrollKeys.report(from, to),
    queryFn: () => getPayrollReport(from, to),
    enabled: !!from && !!to,
    staleTime: 30_000,
  });
