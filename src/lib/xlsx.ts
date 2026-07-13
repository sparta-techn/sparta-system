/**
 * Minimal, typed helpers for generating real `.xlsx` workbooks (SheetJS).
 *
 * Mirrors the shape of `@/lib/csv` (`XlsxColumn` ≈ `CsvColumn`) so a caller can
 * reuse the same column-definition style, but produces a genuine Excel binary
 * — numbers stay numeric so Excel can sum/sort them, and each column gets a
 * sensible width. Unlike CSV, no BOM/quoting concerns: the writer handles
 * encoding and escaping.
 */
import * as XLSX from "xlsx";

export interface XlsxColumn<T> {
  header: string;
  /** Cell value. Numbers/dates are written as native Excel types (not text). */
  value: (row: T) => string | number | boolean | Date | null | undefined;
  /** Column width in characters (Excel "wch"). Falls back to the header length. */
  width?: number;
}

/** Build a worksheet from `rows` + `columns`, preserving order and cell types. */
function buildSheet<T>(rows: readonly T[], columns: readonly XlsxColumn<T>[]): XLSX.WorkSheet {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row);
      return v == null ? "" : v;
    }),
  );
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet["!cols"] = columns.map((c) => ({ wch: c.width ?? Math.max(10, c.header.length + 2) }));
  // Keep the header row visible while scrolling large exports.
  sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
  return sheet;
}

/**
 * Trigger a client-side download of `rows` as an `.xlsx` file. `sheetName` is
 * clamped to Excel's 31-char limit. Must run in the browser (uses the DOM).
 */
export function downloadXlsx<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly XlsxColumn<T>[],
  sheetName = "Sheet1",
): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildSheet(rows, columns), sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}
