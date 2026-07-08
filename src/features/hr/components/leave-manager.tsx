import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Check, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employeeById, leaveBalances, leaveRequests, type HrLeaveRequest } from "../mock-data";
import { LeaveStatusBadge, LeaveTypeBadge } from "./badges";
import { EmployeeAvatar } from "./employee-avatar";
import { EmptyState } from "./empty-state";

export function LeaveManager() {
  const [status, setStatus] = useState<HrLeaveRequest["status"] | "all">("pending");
  const filtered = useMemo(
    () => (status === "all" ? leaveRequests : leaveRequests.filter((r) => r.status === status)),
    [status],
  );

  const totals = useMemo(() => {
    const t = { annual: 0, sick: 0, emergency: 0, parental: 0 };
    leaveBalances.forEach((b) => {
      t.annual += b.annual.total - b.annual.used;
      t.sick += b.sick.total - b.sick.used;
      t.emergency += b.emergency.total - b.emergency.used;
      t.parental += b.parental.total - b.parental.used;
    });
    return t;
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceTotal label="Annual remaining" value={totals.annual} />
        <BalanceTotal label="Sick remaining" value={totals.sick} />
        <BalanceTotal label="Emergency remaining" value={totals.emergency} />
        <BalanceTotal label="Parental remaining" value={totals.parental} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1">
            {(["pending", "approved", "rejected", "cancelled", "all"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "default" : "outline"}
                onClick={() => setStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
          <Card>
            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No leave requests" icon={CalendarIcon} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const e = employeeById(r.employeeId);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {e ? <EmployeeAvatar employee={e} size={28} /> : null}
                              <span className="text-sm font-medium">{e?.name ?? "Unknown"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <LeaveTypeBadge type={r.type} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(r.from).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(r.to).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">{r.days}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                            {r.reason}
                          </TableCell>
                          <TableCell>
                            <LeaveStatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending" ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() =>
                                    toast.success("Approved", {
                                      description: `${e?.name} · ${r.type}`,
                                    })
                                  }
                                >
                                  <Check className="size-3.5" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-destructive hover:text-destructive"
                                  onClick={() =>
                                    toast.message("Rejected", {
                                      description: `${e?.name} · ${r.type}`,
                                    })
                                  }
                                >
                                  <X className="size-3.5" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Leave calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarStrip />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="mt-3">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Annual</TableHead>
                    <TableHead>Sick</TableHead>
                    <TableHead>Emergency</TableHead>
                    <TableHead>Parental</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveBalances.slice(0, 20).map((b) => {
                    const e = employeeById(b.employeeId);
                    return (
                      <TableRow key={b.employeeId}>
                        <TableCell className="font-medium">{e?.name}</TableCell>
                        <TableCell className="text-sm">
                          {b.annual.total - b.annual.used} / {b.annual.total}
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.sick.total - b.sick.used} / {b.sick.total}
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.emergency.total - b.emergency.used} / {b.emergency.total}
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.parental.total - b.parental.used} / {b.parental.total}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BalanceTotal({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">
          {value}
          <span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
        </p>
      </CardContent>
    </Card>
  );
}

function CalendarStrip() {
  const today = new Date();
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="text-center font-medium">
            {d.toLocaleDateString(undefined, { weekday: "short" })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.slice(0, 7).map((d) => {
          const inLeave = leaveRequests.filter(
            (r) => new Date(r.from) <= d && new Date(r.to) >= d && r.status !== "rejected",
          );
          return (
            <div key={d.toISOString()} className="min-h-[88px] rounded-md border p-1.5">
              <p className="text-xs font-medium">{d.getDate()}</p>
              <ul className="mt-1 space-y-0.5">
                {inLeave.slice(0, 3).map((r) => {
                  const e = employeeById(r.employeeId);
                  return (
                    <li
                      key={r.id}
                      className="truncate rounded bg-primary/10 px-1 py-0.5 text-[11px] text-primary"
                    >
                      {e?.name.split(" ")[0]} · {r.type}
                    </li>
                  );
                })}
                {inLeave.length > 3 ? (
                  <li className="text-[11px] text-muted-foreground">+{inLeave.length - 3} more</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
