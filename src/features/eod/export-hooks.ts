/**
 * useDailyReportsExport — fetches End-of-Day reports for a work-date range and
 * hands them to the export writers.
 *
 * Loading happens on demand (when the user clicks Export), never on mount, so
 * opening a page never pulls a period's worth of reports it may not need. Data
 * comes through the repository layer; team scope resolves employee names from
 * the profile directory, own scope from the signed-in identity. RLS decides
 * which rows a team export can actually see.
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import type { Profile } from "@/features/auth/types";
import { getErrorMessage, reportError } from "@/lib/errors";
import { employeeRepository } from "@/repositories";
import { dailyReportRepository } from "@/repositories/reports";
import type { DailyReportRow } from "@/services/reports";

import {
  downloadDailyReportsCsv,
  downloadDailyReportsWorkbook,
  type DailyReportExportEntry,
} from "./export";

/** Whose reports to export: the signed-in user's, or everyone they may see. */
export type DailyReportExportScope = "own" | "team";
export type DailyReportExportFormat = "xlsx" | "csv";

export interface DailyReportExportRequest {
  /** Inclusive work-date bounds, `YYYY-MM-DD`. */
  from: string;
  to: string;
  scope: DailyReportExportScope;
  /** Leave unsubmitted drafts out of the export. */
  submittedOnly: boolean;
  format: DailyReportExportFormat;
}

function profileName(p: Profile): string {
  return p.full_name || p.display_name || p.email || "Unknown";
}

/** Work date descending, then employee name — how the sheets read best. */
function byDateThenName(a: DailyReportExportEntry, b: DailyReportExportEntry): number {
  const byDate = b.report.work_date.localeCompare(a.report.work_date);
  return byDate !== 0 ? byDate : a.employeeName.localeCompare(b.employeeName);
}

export function useDailyReportsExport() {
  const { user, profile } = useAuth();
  const [exporting, setExporting] = useState(false);

  /** Attach a display name to every report; one directory read for team scope. */
  const resolveEntries = useCallback(
    async (
      reports: readonly DailyReportRow[],
      scope: DailyReportExportScope,
    ): Promise<DailyReportExportEntry[]> => {
      if (scope === "own") {
        const name = profile ? profileName(profile) : (user?.email ?? "You");
        return reports.map((report) => ({ report, employeeName: name }));
      }
      const people = await employeeRepository.list();
      const nameById = new Map(people.map((p) => [p.id, profileName(p)]));
      return reports.map((report) => ({
        report,
        employeeName: nameById.get(report.user_id) ?? "Unknown",
      }));
    },
    [profile, user],
  );

  const runExport = useCallback(
    async (request: DailyReportExportRequest): Promise<void> => {
      const { from, to, scope, submittedOnly, format } = request;
      if (!from || !to) {
        toast.error("Pick a start and an end date.");
        return;
      }
      if (from > to) {
        toast.error("The start date must be on or before the end date.");
        return;
      }
      if (scope === "own" && !user) {
        toast.error("You must be signed in to export your reports.");
        return;
      }

      setExporting(true);
      try {
        const reports = await dailyReportRepository.listInRange(from, to, {
          userId: scope === "own" ? user?.id : undefined,
          status: submittedOnly ? "submitted" : undefined,
        });
        if (reports.length === 0) {
          toast.info("No daily reports in that date range.");
          return;
        }

        const entries = (await resolveEntries(reports, scope)).sort(byDateThenName);
        if (format === "csv") downloadDailyReportsCsv(from, to, entries);
        else downloadDailyReportsWorkbook(from, to, entries);

        toast.success(
          `Exported ${entries.length} report${entries.length === 1 ? "" : "s"} to ${
            format === "csv" ? "CSV" : "Excel"
          }.`,
        );
      } catch (err) {
        reportError(err, { feature: "eod", action: "export", scope, from, to });
        toast.error(getErrorMessage(err));
      } finally {
        setExporting(false);
      }
    },
    [resolveEntries, user],
  );

  return { exporting, runExport };
}
