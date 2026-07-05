import { Bell, Mail, MessageSquare, Workflow } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatHrs, managerActivity, managerEmployees, type ManagerStatus } from "../mock-data";

const STATUS_TONE: Record<ManagerStatus, "success" | "info" | "warning" | "danger" | "neutral" | "primary"> = {
  working: "success", on_break: "info", late: "warning", absent: "danger",
  on_leave: "neutral", holiday: "neutral", finished: "primary",
};
const STATUS_LABEL: Record<ManagerStatus, string> = {
  working: "Working", on_break: "On break", late: "Late", absent: "Absent",
  on_leave: "On leave", holiday: "Holiday", finished: "Finished",
};

export function EmployeeDrawer({
  employeeId, open, onOpenChange,
}: { employeeId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const employee = managerEmployees.find((e) => e.id === employeeId) ?? null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {employee ? (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarFallback className="bg-muted text-sm font-semibold">{employee.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{employee.name}</SheetTitle>
                  <SheetDescription className="truncate">{employee.role} · {employee.department}</SheetDescription>
                </div>
                <StatusBadge tone={STATUS_TONE[employee.status]} label={STATUS_LABEL[employee.status]} size="sm" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline"><MessageSquare className="size-4" /> Message</Button>
                <Button size="sm" variant="outline"><Bell className="size-4" /> Send reminder</Button>
                <Button size="sm" variant="outline"><Workflow className="size-4" /> Assign dep</Button>
                <Button size="sm" variant="ghost"><Mail className="size-4" /> {employee.email}</Button>
              </div>
            </SheetHeader>

            <Separator className="my-4" />

            <Tabs defaultValue="today">
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="deps">Dependencies</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="space-y-3 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Working" value={formatHrs(employee.workSeconds)} />
                  <Stat label="Break" value={formatHrs(employee.breakSeconds)} />
                  <Stat label="Last seen" value={employee.lastActivityAgo} />
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Current task</p>
                  <p className="text-sm text-foreground">{employee.currentTask ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today's activity</p>
                  <ol className="space-y-2">
                    {managerActivity.filter((a) => a.actor === employee.name).slice(0, 4).map((a) => (
                      <li key={a.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                        <span className="text-foreground">{a.detail}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{a.minutesAgo}m ago</span>
                      </li>
                    ))}
                    {managerActivity.filter((a) => a.actor === employee.name).length === 0 && (
                      <li className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                        No recent events.
                      </li>
                    )}
                  </ol>
                </div>
              </TabsContent>

              <TabsContent value="attendance" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">Last 7 days (hours worked)</p>
                <div className="flex items-end gap-1.5">
                  {employee.attendance7d.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-20 w-full items-end overflow-hidden rounded bg-muted/60">
                        <div className="w-full rounded-t bg-primary" style={{ height: `${(h / 10) * 100}%` }} aria-hidden />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{h.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reports" className="space-y-2 pt-3">
                <ReportRow label="Morning check-in" state={employee.reports.checkin} />
                <ReportRow label="Midday status" state={employee.reports.midday} />
                <ReportRow label="End-of-day report" state={employee.reports.eod} />
              </TabsContent>

              <TabsContent value="deps" className="pt-3">
                <p className="text-sm text-muted-foreground">
                  {employee.openDependencies} open dependencies. (Detail mocked)
                </p>
              </TabsContent>

              <TabsContent value="notifications" className="pt-3">
                <p className="text-sm text-muted-foreground">No recent notifications targeted to this employee.</p>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function ReportRow({ label, state }: { label: string; state: "done" | "pending" | "missed" | "na" }) {
  const tone =
    state === "done" ? "success" : state === "pending" ? "warning" : state === "missed" ? "danger" : "neutral";
  const text =
    state === "done" ? "Submitted" : state === "pending" ? "Pending" : state === "missed" ? "Missed" : "N/A";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
      <p className="text-sm text-foreground">{label}</p>
      <StatusBadge tone={tone} label={text} size="sm" />
    </div>
  );
}
