/**
 * Minimal, dependency-free CSV helpers.
 *
 * Fields are quoted per RFC 4180: any value containing a comma, double quote,
 * or newline is wrapped in double quotes, and embedded quotes are doubled.
 * This keeps commas/newlines in data (addresses, notes) from corrupting rows.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvField(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize `rows` to a CSV string using the given column definitions. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(","));
  return [header, ...body].join("\r\n");
}

/** Trigger a client-side download of `content` as a `.csv` file named `filename`. */
export function downloadCsv(filename: string, content: string): void {
  // A leading UTF-8 BOM (U+FEFF) makes Excel read accented characters correctly.
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
