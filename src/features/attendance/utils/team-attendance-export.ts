/**
 * Column mapping + filename for the team attendance `.xlsx` export.
 *
 * Kept separate from the view so the export shape is unit-testable and reused
 * wherever team attendance is downloaded. Hour columns are emitted as decimal
 * numbers (not "7h 45m" strings) so Excel can sum, sort and chart them.
 */
import type { XlsxColumn } from "@/lib/xlsx";
import type { TeammateToday } from "../api";
import { ATTENDANCE_STATUS_META } from "../types";

/** Local HH:MM for a timestamp, or "" when the session has no check-in/out. */
function formatClock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Seconds → decimal hours rounded to 2dp (e.g. 27900 → 7.75). */
function toHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

function teammateName(profile: TeammateToday["profile"]): string {
  return profile.display_name ?? profile.full_name ?? "Unnamed";
}

/** Ordered columns for the exported workbook. */
export const TEAM_ATTENDANCE_XLSX_COLUMNS: XlsxColumn<TeammateToday>[] = [
  { header: "Employee", value: (r) => teammateName(r.profile), width: 22 },
  { header: "Job title", value: (r) => r.profile.job_title ?? "", width: 20 },
  { header: "Date", value: (r) => r.session.work_date, width: 12 },
  { header: "Check-in", value: (r) => formatClock(r.session.started_at), width: 10 },
  { header: "Check-out", value: (r) => formatClock(r.session.finished_at), width: 10 },
  { header: "Break (hrs)", value: (r) => toHours(r.session.break_seconds), width: 11 },
  { header: "Worked (hrs)", value: (r) => toHours(r.session.working_seconds), width: 12 },
  { header: "Overtime (hrs)", value: (r) => toHours(r.session.overtime_seconds), width: 13 },
  { header: "Late (min)", value: (r) => r.session.late_minutes, width: 10 },
  {
    header: "Status",
    value: (r) => ATTENDANCE_STATUS_META[r.session.attendance_status].label,
    width: 12,
  },
];

/** Excel sheet title for the export (kept under Excel's 31-char cap). */
export const TEAM_ATTENDANCE_SHEET_NAME = "Team attendance";

/** Filename like `team-attendance-2026-07-01_to_2026-07-31.xlsx`. */
export function teamAttendanceFilename(from: string, to: string): string {
  return from === to ? `team-attendance-${from}.xlsx` : `team-attendance-${from}_to_${to}.xlsx`;
}
