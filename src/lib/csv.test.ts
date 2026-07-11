import { describe, expect, it } from "vitest";

import { toCsv, type CsvColumn } from "./csv";

interface Row {
  name: string;
  note: string | null;
  count: number;
}

const columns: CsvColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Note", value: (r) => r.note },
  { header: "Count", value: (r) => r.count },
];

describe("toCsv", () => {
  it("emits a header row followed by data rows", () => {
    const csv = toCsv([{ name: "Ada", note: "ok", count: 2 }], columns);
    expect(csv).toBe("Name,Note,Count\r\nAda,ok,2");
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv(
      [{ name: "Doe, Jane", note: 'say "hi"\nagain', count: 1 }],
      columns,
    );
    expect(csv).toBe('Name,Note,Count\r\n"Doe, Jane","say ""hi""\nagain",1');
  });

  it("renders null/undefined values as empty strings", () => {
    const csv = toCsv([{ name: "Bo", note: null, count: 0 }], columns);
    expect(csv).toBe("Name,Note,Count\r\nBo,,0");
  });

  it("returns just the header for an empty row set", () => {
    expect(toCsv([], columns)).toBe("Name,Note,Count");
  });
});
