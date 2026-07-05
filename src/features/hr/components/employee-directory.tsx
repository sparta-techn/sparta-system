import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  UserPlus,
  UserRoundPlus,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { type EmploymentStatus } from "../mock-data";
import { hrQueries } from "../queries";
import { useManagedEmployees } from "../employees-store";
import { EmployeeAvatar } from "./employee-avatar";
import { EmploymentStatusBadge, RoleBadge } from "./badges";
import { EmptyState } from "./empty-state";
import { InviteEmployeeDialog } from "./invite-employee-dialog";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeeActionsMenu } from "./employee-actions-menu";

const PAGE_SIZE = 10;
type SortKey = "name" | "department" | "joinedAt";

const SAVED_FILTERS = [
  { label: "All employees", dept: "all", status: "all" },
  { label: "Active engineers", dept: "Engineering", status: "active" },
  { label: "On leave", dept: "all", status: "on_leave" },
  { label: "Recently invited", dept: "all", status: "invited" },
];

export function EmployeeDirectory() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: baseEmployees = [], isLoading, isError } = useQuery(hrQueries.employees());
  const { data: departments = [] } = useQuery(hrQueries.departments());
  // Overlay local management changes (edits, status, soft-deletes, created rows).
  const employees = useManagedEmployees(baseEmployees);

  const employeeById = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e]));
    return (id: string) => map.get(id);
  }, [employees]);

  const filtered = useMemo(() => {
    const list = employees.filter((e) => {
      if (dept !== "all" && e.department !== dept) return false;
      if (status !== "all" && e.status !== status) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(
          e.name.toLowerCase().includes(s) ||
          e.email.toLowerCase().includes(s) ||
          e.jobTitle.toLowerCase().includes(s)
        )) {
          return false;
        }
      }
      return true;
    });
    list.sort((a, b) => {
      const av = a[sortKey] as string;
      const bv = b[sortKey] as string;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [employees, q, dept, status, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, or title"
            className="pl-8"
            aria-label="Search employees"
          />
        </div>
        <Select
          value={dept}
          onValueChange={(v) => {
            setDept(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]" aria-label="Filter by department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On leave</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="offboarding">Offboarding</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="size-4" /> Saved
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SAVED_FILTERS.map((s) => (
              <DropdownMenuItem
                key={s.label}
                onClick={() => {
                  setDept(s.dept);
                  setStatus(s.status);
                  setPage(1);
                }}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" className="gap-2" onClick={() => setCreateOpen(true)}>
          <UserRoundPlus className="size-4" /> New employee
        </Button>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" /> Invite
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading employees…</div>
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">
            Couldn’t load employees. Please try again.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No employees match your filters"
              description="Try clearing search or changing a filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Employee"
                    k="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                  <SortableHead
                    label="Department"
                    k="department"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={() => toggleSort("department")}
                  />
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Manager</TableHead>
                  <SortableHead
                    label="Joined"
                    k="joinedAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={() => toggleSort("joinedAt")}
                  />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map((e) => {
                  const manager = e.managerId ? employeeById(e.managerId) : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          to="/app/hr/employees/$id"
                          params={{ id: e.id }}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <EmployeeAvatar employee={e} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{e.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{e.email}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{e.department}</TableCell>
                      <TableCell className="text-sm">{e.team}</TableCell>
                      <TableCell>
                        <RoleBadge role={e.role} />
                      </TableCell>
                      <TableCell>
                        <EmploymentStatusBadge status={e.status as EmploymentStatus} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {manager?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(e.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <EmployeeActionsMenu employee={e} employees={employees} variant="icon" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {filtered.length} employees · page {page} of {pages}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
          >
            Next
          </Button>
        </div>
      </div>

      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EmployeeFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function SortableHead({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: () => void;
}) {
  const active = k === sortKey;
  return (
    <TableHead>
      <button onClick={onClick} className="flex items-center gap-1 hover:text-foreground">
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}
