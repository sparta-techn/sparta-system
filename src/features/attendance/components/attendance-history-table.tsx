import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton, NoResultsState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-context";

import { attendanceHistoryQuery } from "../queries";
import { formatDurationLong } from "../hooks/use-timer";
import { ATTENDANCE_STATUS_META } from "../types";
import { AttendanceBadge } from "./attendance-status-badge";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(ATTENDANCE_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export function AttendanceHistoryTable() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => ({
      status: status === "all" ? null : status,
      search: search.trim() || null,
      page,
      pageSize: PAGE_SIZE,
    }),
    [status, search, page],
  );

  const q = useQuery(attendanceHistoryQuery(user?.id ?? "", filters));

  const rows = q.data?.rows ?? [];
  const totalCount = q.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Client-side date search (filters on what's loaded; real date search later).
  const visible = rows.filter((r) =>
    !filters.search ? true : r.work_date.includes(filters.search),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            placeholder="Search by date (YYYY-MM-DD)"
            aria-label="Search history"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(0);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {q.isPending ? (
          <div className="p-4"><ListSkeleton rows={6} /></div>
        ) : q.isError ? (
          <ErrorState
            title="Couldn't load history"
            description={(q.error as Error)?.message ?? "Please try again."}
            action={<Button variant="outline" onClick={() => q.refetch()}>Retry</Button>}
          />
        ) : visible.length === 0 ? (
          totalCount === 0 ? (
            <EmptyState
              title="No attendance yet"
              description="Once you start your first work session, it'll appear here."
            />
          ) : (
            <NoResultsState />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Worked</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium tabular-nums">{r.work_date}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.started_at
                      ? new Date(r.started_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.finished_at
                      ? new Date(r.finished_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDurationLong(r.break_seconds)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDurationLong(r.working_seconds)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AttendanceBadge status={r.attendance_status} size="sm" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {totalCount === 0
            ? "0 results"
            : `${page * PAGE_SIZE + 1}–${Math.min(totalCount, (page + 1) * PAGE_SIZE)} of ${totalCount}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="px-2 tabular-nums">
            Page {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
