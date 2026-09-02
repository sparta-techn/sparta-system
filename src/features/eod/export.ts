/**
 * Full-detail export of End-of-Day reports (`daily_reports`).
 *
 * A report is mostly repeated sections stored as jsonb, so a single flat table
 * can never show all of it well. The workbook therefore has two layers:
 *
 *  - **Reports** — one row per report, with every section additionally
 *    flattened into a text column so nothing is lost if that sheet is read on
 *    its own (it is also exactly what the CSV export writes, so the two formats
 *    can never disagree).
 *  - **Itemised tabs** — completed work, in-progress items, open dependencies,
 *    needs from others, tomorrow's plan and reflections, one row per item, each
 *    keyed by employee + work date so the tabs pivot and join cleanly.
 *
 * Counts and hours are emitted as native numbers so Excel can sum and sort them.
 */
import type { CsvColumn } from "@/lib/csv";
import { downloadCsv, toCsv } from "@/lib/csv";
import { downloadXlsxWorkbook, type XlsxSheet } from "@/lib/xlsx";
import { TASK_PROGRESS_META, type TaskProgressEntry } from "@/features/midday/types";
import type { DailyReportRow } from "@/services/reports";

import { taskCompletion } from "./progress";
import type { TomorrowPlan, WorkSessionSummary } from "./types";

/**
 * A column both writers accept: identical to {@link CsvColumn}, plus the width
 * the `.xlsx` writer wants (`XlsxColumn.width`). One definition, two formats.
 */
interface ExportColumn<T> extends CsvColumn<T> {
  width: number;
}

/** One report plus the resolved display name of the employee who filed it. */
export interface DailyReportExportEntry {
  report: DailyReportRow;
  employeeName: string;
}

// ── formatting helpers ──────────────────────────────────────────────────────

/** `2026-08-14T09:31:07.221Z` → `2026-08-14 09:31` (UTC, stable across machines). */
function timestamp(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "";
}

function yesNo(value: unknown): string {
  return value ? "Yes" : "No";
}

/** Minutes → decimal hours rounded to 2dp (e.g. 465 → 7.75). */
function toHours(minutes: number | undefined): number {
  return minutes ? Math.round((minutes / 60) * 100) / 100 : 0;
}

/** Join the lines of a flattened section into one cell. */
function joinLines(lines: readonly string[]): string {
  return lines.join("; ");
}

function taskStateLabel(entry: TaskProgressEntry): string {
  return TASK_PROGRESS_META[entry.state]?.label ?? entry.state;
}

function tomorrowPlan(report: DailyReportRow): Partial<TomorrowPlan> {
  return (report.tomorrow_plan ?? {}) as Partial<TomorrowPlan>;
}

function sessionSummary(report: DailyReportRow): Partial<WorkSessionSummary> {
  return (report.session_summary ?? {}) as Partial<WorkSessionSummary>;
}

// ── sheet 1: one row per report ─────────────────────────────────────────────

/** Ordered columns of the flat "Reports" sheet — also the CSV export's columns. */
export const DAILY_REPORT_COLUMNS: readonly ExportColumn<DailyReportExportEntry>[] = [
  { header: "Employee", value: (e) => e.employeeName, width: 24 },
  { header: "Work date", value: (e) => e.report.work_date, width: 12 },
  { header: "Status", value: (e) => e.report.status, width: 11 },
  { header: "Submitted at (UTC)", value: (e) => timestamp(e.report.submitted_at), width: 18 },
  { header: "Reviewed at (UTC)", value: (e) => timestamp(e.report.reviewed_at), width: 18 },
  { header: "Summary", value: (e) => e.report.summary ?? "", width: 60 },
  { header: "Planned items", value: (e) => (e.report.completed ?? []).length, width: 12 },
  {
    header: "Fully done",
    value: (e) => taskCompletion(e.report.completed ?? []).count,
    width: 11,
  },
  {
    header: "Completion %",
    value: (e) => taskCompletion(e.report.completed ?? []).pct,
    width: 12,
  },
  { header: "In progress", value: (e) => (e.report.in_progress ?? []).length, width: 11 },
  {
    header: "Open dependencies",
    value: (e) => (e.report.open_dependencies ?? []).filter((d) => !d.resolvedNow).length,
    width: 16,
  },
  {
    header: "Needs from others",
    value: (e) => (e.report.need_from_others ?? []).length,
    width: 16,
  },
  { header: "Check-in", value: (e) => sessionSummary(e.report).checkIn ?? "", width: 10 },
  { header: "Check-out", value: (e) => sessionSummary(e.report).checkOut ?? "", width: 10 },
  {
    header: "Worked (hrs)",
    value: (e) => toHours(sessionSummary(e.report).workedMinutes),
    width: 12,
  },
  {
    header: "Break (hrs)",
    value: (e) => toHours(sessionSummary(e.report).breakMinutes),
    width: 11,
  },
  {
    header: "Morning check-in",
    value: (e) => yesNo(sessionSummary(e.report).morningCheckInDone),
    width: 15,
  },
  {
    header: "Midday status",
    value: (e) => yesNo(sessionSummary(e.report).middayStatusDone),
    width: 13,
  },
  {
    header: "Dependencies created",
    value: (e) => sessionSummary(e.report).dependenciesCreated ?? 0,
    width: 18,
  },
  {
    header: "Dependencies resolved",
    value: (e) => sessionSummary(e.report).dependenciesResolved ?? 0,
    width: 18,
  },
  {
    header: "Completed work",
    value: (e) =>
      joinLines(
        (e.report.completed ?? []).map(
          (t) => `${t.title} [${taskStateLabel(t)}]${t.note ? ` — ${t.note}` : ""}`,
        ),
      ),
    width: 60,
  },
  {
    header: "In-progress work",
    value: (e) =>
      joinLines(
        (e.report.in_progress ?? []).map(
          (i) => `${i.title} [${i.priority}, ETA ${i.eta}]${i.notes ? ` — ${i.notes}` : ""}`,
        ),
      ),
    width: 60,
  },
  {
    header: "Open dependency detail",
    value: (e) =>
      joinLines(
        (e.report.open_dependencies ?? []).map(
          (d) =>
            `${d.titleSnapshot}${d.resolvedNow ? " [resolved today]" : ""}${d.note ? ` — ${d.note}` : ""}`,
        ),
      ),
    width: 50,
  },
  {
    header: "Needs from others detail",
    value: (e) =>
      joinLines(
        (e.report.need_from_others ?? []).map(
          (n) =>
            `${n.department}: ${n.description} [${n.priority}${n.dueDate ? `, due ${n.dueDate}` : ""}]`,
        ),
      ),
    width: 50,
  },
  {
    header: "Tomorrow — priorities",
    value: (e) => joinLines(tomorrowPlan(e.report).priorities ?? []),
    width: 40,
  },
  {
    header: "Tomorrow — tasks",
    value: (e) => joinLines(tomorrowPlan(e.report).tasks ?? []),
    width: 40,
  },
  {
    header: "Tomorrow — meetings",
    value: (e) => joinLines(tomorrowPlan(e.report).meetings ?? []),
    width: 30,
  },
  {
    header: "Tomorrow — expected blockers",
    value: (e) => joinLines(tomorrowPlan(e.report).expectedBlockers ?? []),
    width: 30,
  },
  { header: "Went well", value: (e) => e.report.reflection?.wentWell ?? "", width: 40 },
  { header: "Slowed down", value: (e) => e.report.reflection?.slowedDown ?? "", width: 40 },
  { header: "For manager", value: (e) => e.report.reflection?.forManager ?? "", width: 40 },
];

// ── itemised sheets: one row per item ───────────────────────────────────────

/** Employee + work date, repeated on every itemised row so tabs can be joined. */
interface ItemKey {
  employeeName: string;
  workDate: string;
}

interface CompletedItemRow extends ItemKey {
  title: string;
  project: string;
  state: string;
  note: string;
}

interface InProgressItemRow extends ItemKey {
  title: string;
  priority: string;
  eta: string;
  notes: string;
}

interface DependencyItemRow extends ItemKey {
  title: string;
  note: string;
  resolvedToday: string;
}

interface NeedItemRow extends ItemKey {
  department: string;
  description: string;
  priority: string;
  dueDate: string;
}

interface TomorrowItemRow extends ItemKey {
  kind: string;
  item: string;
}

interface ReflectionRow extends ItemKey {
  wentWell: string;
  slowedDown: string;
  forManager: string;
}

const KEY_COLUMNS: readonly ExportColumn<ItemKey>[] = [
  { header: "Employee", value: (r) => r.employeeName, width: 24 },
  { header: "Work date", value: (r) => r.workDate, width: 12 },
];

/** Prefix the shared key columns onto an itemised sheet's own columns. */
function withKey<T extends ItemKey>(columns: readonly ExportColumn<T>[]): ExportColumn<T>[] {
  return [...(KEY_COLUMNS as readonly ExportColumn<T>[]), ...columns];
}

const COMPLETED_COLUMNS = withKey<CompletedItemRow>([
  { header: "Task", value: (r) => r.title, width: 44 },
  { header: "Project", value: (r) => r.project, width: 20 },
  { header: "State", value: (r) => r.state, width: 14 },
  { header: "Note", value: (r) => r.note, width: 50 },
]);

const IN_PROGRESS_COLUMNS = withKey<InProgressItemRow>([
  { header: "Item", value: (r) => r.title, width: 44 },
  { header: "Priority", value: (r) => r.priority, width: 10 },
  { header: "ETA", value: (r) => r.eta, width: 18 },
  { header: "Notes", value: (r) => r.notes, width: 50 },
]);

const DEPENDENCY_COLUMNS = withKey<DependencyItemRow>([
  { header: "Dependency", value: (r) => r.title, width: 44 },
  { header: "Resolved today", value: (r) => r.resolvedToday, width: 14 },
  { header: "Note", value: (r) => r.note, width: 50 },
]);

const NEED_COLUMNS = withKey<NeedItemRow>([
  { header: "Department", value: (r) => r.department, width: 18 },
  { header: "Description", value: (r) => r.description, width: 50 },
  { header: "Priority", value: (r) => r.priority, width: 10 },
  { header: "Due date", value: (r) => r.dueDate, width: 12 },
]);

const TOMORROW_COLUMNS = withKey<TomorrowItemRow>([
  { header: "Kind", value: (r) => r.kind, width: 18 },
  { header: "Item", value: (r) => r.item, width: 60 },
]);

const REFLECTION_COLUMNS = withKey<ReflectionRow>([
  { header: "Went well", value: (r) => r.wentWell, width: 44 },
  { header: "Slowed down", value: (r) => r.slowedDown, width: 44 },
  { header: "For manager", value: (r) => r.forManager, width: 44 },
]);

/** Every itemised row set, derived from the same entries as the flat sheet. */
export interface DailyReportItemRows {
  completed: CompletedItemRow[];
  inProgress: InProgressItemRow[];
  dependencies: DependencyItemRow[];
  needs: NeedItemRow[];
  tomorrow: TomorrowItemRow[];
  reflections: ReflectionRow[];
}

/**
 * Explode each report's repeated sections into flat, joinable rows. Empty
 * sections contribute nothing; a report whose reflection is entirely blank
 * produces no reflection row.
 */
export function buildDailyReportItemRows(
  entries: readonly DailyReportExportEntry[],
): DailyReportItemRows {
  const rows: DailyReportItemRows = {
    completed: [],
    inProgress: [],
    dependencies: [],
    needs: [],
    tomorrow: [],
    reflections: [],
  };

  for (const { report, employeeName } of entries) {
    const key: ItemKey = { employeeName, workDate: report.work_date };

    for (const t of report.completed ?? []) {
      rows.completed.push({
        ...key,
        title: t.title,
        project: t.project ?? "",
        state: taskStateLabel(t),
        note: t.note ?? "",
      });
    }

    for (const i of report.in_progress ?? []) {
      rows.inProgress.push({
        ...key,
        title: i.title,
        priority: i.priority,
        eta: i.eta,
        notes: i.notes ?? "",
      });
    }

    for (const d of report.open_dependencies ?? []) {
      rows.dependencies.push({
        ...key,
        title: d.titleSnapshot,
        note: d.note ?? "",
        resolvedToday: yesNo(d.resolvedNow),
      });
    }

    for (const n of report.need_from_others ?? []) {
      rows.needs.push({
        ...key,
        department: n.department,
        description: n.description,
        priority: n.priority,
        dueDate: n.dueDate ?? "",
      });
    }

    const plan = tomorrowPlan(report);
    const planned: readonly [string, readonly string[]][] = [
      ["Priority", plan.priorities ?? []],
      ["Task", plan.tasks ?? []],
      ["Meeting", plan.meetings ?? []],
      ["Expected blocker", plan.expectedBlockers ?? []],
    ];
    for (const [kind, items] of planned) {
      for (const item of items) rows.tomorrow.push({ ...key, kind, item });
    }

    const reflection = report.reflection ?? {};
    if (reflection.wentWell || reflection.slowedDown || reflection.forManager) {
      rows.reflections.push({
        ...key,
        wentWell: reflection.wentWell ?? "",
        slowedDown: reflection.slowedDown ?? "",
        forManager: reflection.forManager ?? "",
      });
    }
  }

  return rows;
}

/**
 * The workbook's tabs, in order. Itemised tabs with no rows are dropped rather
 * than shipped empty, so the workbook only shows sections the period actually
 * contains — "Reports" is always present.
 */
export function buildDailyReportSheets(
  entries: readonly DailyReportExportEntry[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): XlsxSheet<any>[] {
  const items = buildDailyReportItemRows(entries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optional: XlsxSheet<any>[] = [
    { name: "Completed work", rows: items.completed, columns: COMPLETED_COLUMNS },
    { name: "In progress", rows: items.inProgress, columns: IN_PROGRESS_COLUMNS },
    { name: "Open dependencies", rows: items.dependencies, columns: DEPENDENCY_COLUMNS },
    { name: "Needs from others", rows: items.needs, columns: NEED_COLUMNS },
    { name: "Tomorrow plan", rows: items.tomorrow, columns: TOMORROW_COLUMNS },
    { name: "Reflections", rows: items.reflections, columns: REFLECTION_COLUMNS },
  ];

  return [
    { name: "Reports", rows: entries, columns: DAILY_REPORT_COLUMNS },
    ...optional.filter((sheet) => sheet.rows.length > 0),
  ];
}

// ── downloads ───────────────────────────────────────────────────────────────

/** `daily-reports-2026-08-01_to_2026-08-31.xlsx` (single date when from === to). */
export function dailyReportsFilename(from: string, to: string, extension: "xlsx" | "csv"): string {
  const period = from === to ? from : `${from}_to_${to}`;
  return `daily-reports-${period}.${extension}`;
}

/** Download the full multi-tab workbook for a work-date range. Browser only. */
export function downloadDailyReportsWorkbook(
  from: string,
  to: string,
  entries: readonly DailyReportExportEntry[],
): void {
  downloadXlsxWorkbook(dailyReportsFilename(from, to, "xlsx"), buildDailyReportSheets(entries));
}

/**
 * Download the flat sheet as CSV — the same columns as the workbook's "Reports"
 * tab, with each repeated section flattened into its text column.
 */
export function downloadDailyReportsCsv(
  from: string,
  to: string,
  entries: readonly DailyReportExportEntry[],
): void {
  downloadCsv(
    dailyReportsFilename(from, to, "csv"),
    toCsv(entries, DAILY_REPORT_COLUMNS as readonly CsvColumn<DailyReportExportEntry>[]),
  );
}
