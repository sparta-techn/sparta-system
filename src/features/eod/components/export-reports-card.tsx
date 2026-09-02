import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localWorkDate } from "@/features/daily-sync";

import {
  useDailyReportsExport,
  type DailyReportExportFormat,
  type DailyReportExportScope,
} from "../export-hooks";

/** `YYYY-MM-DD` for `days` before today, in the browser's timezone. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

interface ExportReportsCardProps {
  /** `"own"` exports the signed-in user's reports; `"team"` everything they may see. */
  scope: DailyReportExportScope;
}

/**
 * Date-range export for End-of-Day reports. The Excel workbook carries the full
 * detail — a row per report plus an itemised tab per repeated section — while
 * CSV gives the same rows flattened into a single table.
 */
export function ExportReportsCard({ scope }: ExportReportsCardProps) {
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => localWorkDate());
  const [format, setFormat] = useState<DailyReportExportFormat>("xlsx");
  const [submittedOnly, setSubmittedOnly] = useState(true);

  const { exporting, runExport } = useDailyReportsExport();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="size-4 text-primary" aria-hidden />
          Export {scope === "team" ? "team" : "my"} daily reports
        </CardTitle>
        <CardDescription>
          Full detail for a date range — summary, completed work, in-progress items, dependencies,
          needs from others, tomorrow&apos;s plan and reflections. The Excel workbook puts each
          section on its own tab; CSV flattens everything into one table.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid items-end gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="report-export-from">From</Label>
          <Input
            id="report-export-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-export-to">To</Label>
          <Input
            id="report-export-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-export-status">Include</Label>
          <Select
            value={submittedOnly ? "submitted" : "all"}
            onValueChange={(v) => setSubmittedOnly(v === "submitted")}
          >
            <SelectTrigger id="report-export-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Submitted only</SelectItem>
              <SelectItem value="all">Submitted + drafts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-export-format">Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as DailyReportExportFormat)}>
            <SelectTrigger id="report-export-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel workbook (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (flat)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => void runExport({ from, to, scope, submittedOnly, format })}
          disabled={exporting}
        >
          <Download aria-hidden />
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </CardContent>
    </Card>
  );
}
