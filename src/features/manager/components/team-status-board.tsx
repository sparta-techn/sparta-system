import { useMemo, useState } from "react";
import { ArrowUpDown, Bell, ChevronLeft, ChevronRight, Eye, MoreHorizontal, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NoResultsState } from "@/components/states";
import { cn } from "@/lib/utils";
import {
  formatHrs,
  type ManagerEmployee,
  type ManagerStatus,
  managerEmployees,
} from "../mock-data";

const STATUS_TONE: Record<ManagerStatus, "success" | "info" | "warning" | "danger" | "neutral" | "primary"> = {
  working: "success", on_break: "info", late: "warning", absent: "danger",
  on_leave: "neutral", holiday: "neutral", finished: "primary",
};
const STATUS_LABEL: Record<ManagerStatus, string> = {
  working: "Working", on_break: "On break", late: "Late", absent: "Absent",
  on_leave: "On leave", holiday: "Holiday", finished: "Finished",
};
const HEALTH_TONE = { good: "success", watch: "warning", risk: "danger" } as const;
const HEALTH_LABEL = { good: "Healthy", watch: "Watch", risk: "At risk" } as const;

const PAGE = 8;

export function TeamStatusBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ManagerStatus>("all");
  const [dept, setDept] = useState<"all" | ManagerEmployee["department"]>("all");
  const [sortKey, setSortKey] = useState<keyof ManagerEmployee>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const filtered = managerEmployees.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (dept !== "all" && e.department !== dept) return false;
      if (q && !`${e.name} ${e.role} ${e.department} ${e.currentTask ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] as unknown as string | number;
      const bv = b[sortKey] as unknown as string | number;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [q, status, dept, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);

  const toggleSort = (key: keyof ManagerEmployee) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Team status board</CardTitle>
            <CardDescription>Live view across the team. Search, filter, and act fast.</CardDescription>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search by name, role, task…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-9"
              aria-label="Search team"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as ManagerStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dept} onValueChange={(v) => { setDept(v as typeof dept); setPage(1); }}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by department"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {["Engineering","Design","Product","Data","QA","DevOps","Marketing"].map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {pageRows.length === 0 ? (
          <div className="p-6"><NoResultsState /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th onClick={() => toggleSort("name")}>Employee</Th>
                  <Th onClick={() => toggleSort("department")}>Department</Th>
                  <Th onClick={() => toggleSort("status")}>Status</Th>
                  <TableHead>Current task</TableHead>
                  <Th onClick={() => toggleSort("workSeconds")} className="text-right">Work</Th>
                  <TableHead className="text-right">Break</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="text-right">Deps</TableHead>
                  <TableHead>Reports</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((e) => (
                  <TableRow key={e.id} className="hover:bg-accent/30">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onOpen(e.id)}
                        className="flex items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                      >
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="bg-muted text-[11px] font-semibold">{e.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.role}</p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.department}</TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[e.status]} label={STATUS_LABEL[e.status]} size="sm" />
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <p className="truncate text-sm text-foreground">{e.currentTask ?? <span className="text-muted-foreground">—</span>}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatHrs(e.workSeconds)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{formatHrs(e.breakSeconds)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.lastActivityAgo}</TableCell>
                    <TableCell>
                      <StatusBadge tone={HEALTH_TONE[e.workHealth]} label={HEALTH_LABEL[e.workHealth]} size="sm" withDot />
                    </TableCell>
                    <TableCell className={cn("text-right text-sm tabular-nums", e.openDependencies > 2 && "text-warning font-semibold")}>
                      {e.openDependencies}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={150}>
                        <div className="flex items-center gap-1">
                          <ReportDot label="Check-in" state={e.reports.checkin} />
                          <ReportDot label="Midday" state={e.reports.midday} />
                          <ReportDot label="EOD" state={e.reports.eod} />
                        </div>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Open profile" onClick={() => onOpen(e.id)}>
                          <Eye className="size-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Bell className="size-4" /> Send reminder</DropdownMenuItem>
                            <DropdownMenuItem>Assign dependency</DropdownMenuItem>
                            <DropdownMenuItem>View dependencies</DropdownMenuItem>
                            <DropdownMenuItem>Open profile</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{rows.length} employees · page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Th({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <TableHead className={className}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
        {children}
        {onClick ? <ArrowUpDown className="size-3" aria-hidden /> : null}
      </button>
    </TableHead>
  );
}

function ReportDot({ label, state }: { label: string; state: "done" | "pending" | "missed" | "na" }) {
  const tone =
    state === "done" ? "bg-success" :
    state === "pending" ? "bg-warning" :
    state === "missed" ? "bg-destructive" : "bg-muted-foreground/30";
  const text =
    state === "done" ? "Submitted" :
    state === "pending" ? "Pending" :
    state === "missed" ? "Missed" : "N/A";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center" aria-label={`${label}: ${text}`}>
          <span className={cn("size-2 rounded-full ring-2 ring-card", tone)} />
        </span>
      </TooltipTrigger>
      <TooltipContent><p className="text-xs">{label}: {text}</p></TooltipContent>
    </Tooltip>
  );
}
