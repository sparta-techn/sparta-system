import { describe, expect, it } from "vitest";

import type { DailyReportRow } from "@/services/reports";

import {
  DAILY_REPORT_COLUMNS,
  buildDailyReportItemRows,
  buildDailyReportSheets,
  dailyReportsFilename,
  type DailyReportExportEntry,
} from "./export";

function makeReport(overrides: Partial<DailyReportRow> = {}): DailyReportRow {
  return {
    id: "r1",
    user_id: "u1",
    work_date: "2026-08-14",
    attendance_id: null,
    session_id: null,
    status: "submitted",
    summary: "Shipped the payslip fix",
    completed: [],
    in_progress: [],
    open_dependencies: [],
    need_from_others: [],
    tomorrow_plan: {},
    reflection: {},
    session_summary: {},
    submitted_at: "2026-08-14T17:31:07.221Z",
    reviewed_by: null,
    reviewed_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-08-14T17:31:07.221Z",
    updated_at: "2026-08-14T17:31:07.221Z",
    ...overrides,
  };
}

function entry(
  overrides: Partial<DailyReportRow> = {},
  name = "Ada Lovelace",
): DailyReportExportEntry {
  return { report: makeReport(overrides), employeeName: name };
}

/** Read one flat-sheet column by its header. */
function cell(e: DailyReportExportEntry, header: string): string | number | null | undefined {
  const column = DAILY_REPORT_COLUMNS.find((c) => c.header === header);
  if (!column) throw new Error(`No export column named "${header}"`);
  return column.value(e);
}

const FULL_REPORT: Partial<DailyReportRow> = {
  completed: [
    { taskId: "t1", title: "Payslip fix", project: "Payroll", state: "completed", note: "QA'd" },
    { taskId: "t2", title: "Rate limits", state: "partial" },
  ],
  in_progress: [
    { id: "i1", title: "Kanban drag", priority: "high", eta: "Tomorrow EOD", notes: "Needs specs" },
  ],
  open_dependencies: [
    { dependencyId: "d1", titleSnapshot: "Design tokens", note: "Waiting on UI" },
    { dependencyId: "d2", titleSnapshot: "Staging DB", resolvedNow: true },
  ],
  need_from_others: [
    {
      id: "n1",
      department: "QA",
      description: "Regression pass",
      priority: "urgent",
      dueDate: "2026-08-15",
    },
  ],
  tomorrow_plan: {
    priorities: ["Ship export"],
    tasks: ["Write tests", "Review PR"],
    meetings: ["Standup"],
    expectedBlockers: [],
  },
  reflection: { wentWell: "Focus time", forManager: "Need a QA slot" },
  session_summary: {
    checkIn: "09:05",
    checkOut: "17:30",
    workedMinutes: 465,
    breakMinutes: 45,
    morningCheckInDone: true,
    middayStatusDone: false,
    dependenciesCreated: 2,
    dependenciesResolved: 1,
  },
};

describe("daily report flat columns", () => {
  it("counts planned items and weights partial work at half", () => {
    const e = entry(FULL_REPORT);
    expect(cell(e, "Planned items")).toBe(2);
    expect(cell(e, "Fully done")).toBe(1);
    expect(cell(e, "Completion %")).toBe(75);
  });

  it("counts only unresolved open dependencies", () => {
    expect(cell(entry(FULL_REPORT), "Open dependencies")).toBe(1);
  });

  it("converts session minutes to decimal hours", () => {
    const e = entry(FULL_REPORT);
    expect(cell(e, "Worked (hrs)")).toBe(7.75);
    expect(cell(e, "Break (hrs)")).toBe(0.75);
    expect(cell(e, "Morning check-in")).toBe("Yes");
    expect(cell(e, "Midday status")).toBe("No");
  });

  it("flattens every repeated section into its text column", () => {
    const e = entry(FULL_REPORT);
    expect(cell(e, "Completed work")).toBe(
      "Payslip fix [Completed] — QA'd; Rate limits [Partially done]",
    );
    expect(cell(e, "In-progress work")).toBe("Kanban drag [high, ETA Tomorrow EOD] — Needs specs");
    expect(cell(e, "Open dependency detail")).toBe(
      "Design tokens — Waiting on UI; Staging DB [resolved today]",
    );
    expect(cell(e, "Needs from others detail")).toBe(
      "QA: Regression pass [urgent, due 2026-08-15]",
    );
    expect(cell(e, "Tomorrow — tasks")).toBe("Write tests; Review PR");
    expect(cell(e, "Tomorrow — expected blockers")).toBe("");
    expect(cell(e, "For manager")).toBe("Need a QA slot");
  });

  it("trims the submitted timestamp to minutes and survives empty sections", () => {
    const e = entry();
    expect(cell(e, "Submitted at (UTC)")).toBe("2026-08-14 17:31");
    expect(cell(e, "Reviewed at (UTC)")).toBe("");
    expect(cell(e, "Completed work")).toBe("");
    expect(cell(e, "Completion %")).toBe(0);
    expect(cell(e, "Worked (hrs)")).toBe(0);
  });
});

describe("buildDailyReportItemRows", () => {
  it("explodes each section into rows keyed by employee and work date", () => {
    const rows = buildDailyReportItemRows([entry(FULL_REPORT)]);

    expect(rows.completed).toEqual([
      {
        employeeName: "Ada Lovelace",
        workDate: "2026-08-14",
        title: "Payslip fix",
        project: "Payroll",
        state: "Completed",
        note: "QA'd",
      },
      {
        employeeName: "Ada Lovelace",
        workDate: "2026-08-14",
        title: "Rate limits",
        project: "",
        state: "Partially done",
        note: "",
      },
    ]);
    expect(rows.inProgress).toHaveLength(1);
    expect(rows.dependencies.map((d) => d.resolvedToday)).toEqual(["No", "Yes"]);
    expect(rows.needs[0]).toMatchObject({ department: "QA", dueDate: "2026-08-15" });
  });

  it("labels tomorrow's plan items by kind, dropping empty groups", () => {
    const rows = buildDailyReportItemRows([entry(FULL_REPORT)]);
    expect(rows.tomorrow.map((t) => `${t.kind}: ${t.item}`)).toEqual([
      "Priority: Ship export",
      "Task: Write tests",
      "Task: Review PR",
      "Meeting: Standup",
    ]);
  });

  it("emits a reflection row only when something was written", () => {
    expect(buildDailyReportItemRows([entry(FULL_REPORT)]).reflections).toHaveLength(1);
    expect(buildDailyReportItemRows([entry()]).reflections).toHaveLength(0);
  });

  it("keeps rows from several employees side by side", () => {
    const rows = buildDailyReportItemRows([
      entry(FULL_REPORT),
      entry({ ...FULL_REPORT, work_date: "2026-08-13" }, "Grace Hopper"),
    ]);
    expect(rows.completed).toHaveLength(4);
    expect(new Set(rows.completed.map((r) => r.employeeName))).toEqual(
      new Set(["Ada Lovelace", "Grace Hopper"]),
    );
  });
});

describe("buildDailyReportSheets", () => {
  it("always ships the Reports tab and drops itemised tabs with no rows", () => {
    const sheets = buildDailyReportSheets([entry()]);
    expect(sheets.map((s) => s.name)).toEqual(["Reports"]);
    expect(sheets[0].rows).toHaveLength(1);
  });

  it("adds a tab per populated section, in reading order", () => {
    expect(buildDailyReportSheets([entry(FULL_REPORT)]).map((s) => s.name)).toEqual([
      "Reports",
      "Completed work",
      "In progress",
      "Open dependencies",
      "Needs from others",
      "Tomorrow plan",
      "Reflections",
    ]);
  });

  it("keeps every tab name inside Excel's 31-character limit", () => {
    for (const sheet of buildDailyReportSheets([entry(FULL_REPORT)])) {
      expect(sheet.name.length).toBeLessThanOrEqual(31);
    }
  });
});

describe("dailyReportsFilename", () => {
  it("names a range and a single day differently", () => {
    expect(dailyReportsFilename("2026-08-01", "2026-08-31", "xlsx")).toBe(
      "daily-reports-2026-08-01_to_2026-08-31.xlsx",
    );
    expect(dailyReportsFilename("2026-08-14", "2026-08-14", "csv")).toBe(
      "daily-reports-2026-08-14.csv",
    );
  });
});
