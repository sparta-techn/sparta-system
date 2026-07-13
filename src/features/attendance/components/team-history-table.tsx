import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { cn } from "@/lib/utils";
import { downloadXlsx } from "@/lib/xlsx";

import { TEAM_RANGE_MAX_ROWS } from "../api";
import { teamAttendanceRangeQuery } from "../queries";
import { formatDurationLong } from "../hooks/use-timer";
import {
  TEAM_ATTENDANCE_SHEET_NAME,
  TEAM_ATTENDANCE_XLSX_COLUMNS,
  teamAttendanceFilename,
} from "../utils/team-attendance-export";
import { AttendanceBadge } from "./attendance-status-badge";

const ISO = "yyyy-MM-dd";

interface Preset {
  label: string;
  range: () => DateRange;
}

/** Quick ranges — "This month" first so month-end export is one click. */
const PRESETS: Preset[] = [
  {
    label: "This month",
    range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  {
    label: "Last month",
    range: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    },
  },
  { label: "Last 7 days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
];

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Pick a date range";
  if (!range.to) return format(range.from, "MMM d, yyyy");
  return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`;
}

export function TeamHistoryTable() {
  // Default to the current month so "export this month" is immediate.
  const [range, setRange] = useState<DateRange | undefined>(() => PRESETS[0].range());
  const [pickerOpen, setPickerOpen] = useState(false);
  // Absences are synthesized (see synthesizeAbsences); let reviewers hide them.
  const [includeAbsent, setIncludeAbsent] = useState(true);

  const from = range?.from ? format(range.from, ISO) : "";
  const to = range?.to ? format(range.to, ISO) : from;

  const q = useQuery(teamAttendanceRangeQuery(from, to));
  const allRows = useMemo(() => q.data ?? [], [q.data]);
  const rows = useMemo(
    () => (includeAbsent ? allRows : allRows.filter((r) => !r.synthetic)),
    [allRows, includeAbsent],
  );

  const summary = useMemo(() => {
    const employees = new Set(rows.map((r) => r.session.user_id));
    const present = rows.filter((r) => !r.synthetic).length;
    const absent = rows.filter((r) => r.synthetic).length;
    const late = rows.filter((r) => r.session.attendance_status === "late").length;
    return { present, absent, late, employees: employees.size };
  }, [rows]);

  // The row cap applies to real sessions fetched from the DB, not synthetic rows.
  const truncated = allRows.filter((r) => !r.synthetic).length >= TEAM_RANGE_MAX_ROWS;

  function handleExport() {
    if (rows.length === 0) {
      toast.info("Nothing to export for this range.");
      return;
    }
    downloadXlsx(
      teamAttendanceFilename(from, to),
      rows,
      TEAM_ATTENDANCE_XLSX_COLUMNS,
      TEAM_ATTENDANCE_SHEET_NAME,
    );
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to Excel.`);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Team history</CardTitle>
            <CardDescription>
              Attendance across the selected period. Export the whole range to Excel.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="include-absent"
                checked={includeAbsent}
                onCheckedChange={setIncludeAbsent}
              />
              <Label htmlFor="include-absent" className="text-xs font-normal text-muted-foreground">
                Include absent days
              </Label>
            </div>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-56 justify-start font-normal">
                  <CalendarDays className="text-muted-foreground" />
                  {formatRangeLabel(range)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex flex-wrap gap-1 border-b border-border p-2">
                  {PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      size="sm"
                      variant="ghost"
                      onClick={() => setRange(preset.range())}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={2}
                  defaultMonth={range?.from}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={handleExport} disabled={q.isPending || rows.length === 0}>
              <Download /> Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isPending ? (
          <ListSkeleton rows={6} />
        ) : q.isError ? (
          <ErrorState
            title="Couldn't load team history"
            description={(q.error as Error)?.message ?? "Please try again."}
            action={
              <Button variant="outline" onClick={() => q.refetch()}>
                Retry
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No attendance in this range"
            description={
              includeAbsent
                ? "No sessions or expected working days fall in the selected period."
                : "No teammates clocked in during the selected period."
            }
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground tabular-nums">
              {summary.present} session{summary.present === 1 ? "" : "s"}
              {includeAbsent ? ` · ${summary.absent} absent` : ""} · {summary.late} late ·{" "}
              {summary.employees} teammate{summary.employees === 1 ? "" : "s"}
            </p>
            {truncated ? (
              <p className="text-xs text-warning">
                Showing the first {TEAM_RANGE_MAX_ROWS} sessions — narrow the date range to see the
                rest.
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Worked</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ session, profile, synthetic }) => (
                    <TableRow key={session.id} className={cn(synthetic && "text-muted-foreground")}>
                      <TableCell className="font-medium">
                        {profile.display_name ?? profile.full_name ?? "Unnamed"}
                      </TableCell>
                      <TableCell className="tabular-nums">{session.work_date}</TableCell>
                      <TableCell className="tabular-nums">
                        {session.started_at
                          ? new Date(session.started_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {session.finished_at
                          ? new Date(session.finished_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDurationLong(session.break_seconds)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDurationLong(session.working_seconds)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AttendanceBadge status={session.attendance_status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
