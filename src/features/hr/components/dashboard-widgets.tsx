import { Cake, CalendarHeart, Mail, AlertTriangle, MoonStar, PartyPopper, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  attendanceIssues, employeeById, invitations, leaveRequests, newHires,
  upcomingAnniversaries, upcomingBirthdays, announcements,
} from "../mock-data";
import { EmployeeAvatar } from "./employee-avatar";
import { EmptyState } from "./empty-state";

function SectionCard({ title, icon: Icon, children, action }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" aria-hidden /> {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function NewEmployeesWidget() {
  const list = newHires(60).slice(0, 5);
  return (
    <SectionCard title="New employees" icon={PartyPopper} action={<Link to="/app/hr/employees" className="text-xs text-primary hover:underline">View all</Link>}>
      {list.length === 0 ? (
        <EmptyState title="No new hires yet" description="New employees will appear here once they join." />
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <EmployeeAvatar employee={e} />
                <div className="min-w-0">
                  <Link to="/app/hr/employees/$id" params={{ id: e.id }} className="block truncate text-sm font-medium hover:underline">{e.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{e.jobTitle} · {e.department}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(e.joinedAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function AttendanceAlertsWidget() {
  return (
    <SectionCard title="Attendance alerts" icon={AlertTriangle} action={<Link to="/app/hr" className="text-xs text-primary hover:underline">Open compliance</Link>}>
      {attendanceIssues.length === 0 ? (
        <EmptyState title="All clear" description="No attendance issues today." />
      ) : (
        <ul className="space-y-2">
          {attendanceIssues.slice(0, 6).map((i) => {
            const e = employeeById(i.employeeId);
            const labels: Record<typeof i.type, string> = {
              late: `Late ${i.minutesLate}m`,
              missing_checkin: "Missed check-in",
              missing_midday: "Missed midday",
              missing_eod: "Missed EOD",
              no_show: "No-show",
            };
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40">
                <div className="flex items-center gap-3 min-w-0">
                  {e ? <EmployeeAvatar employee={e} size={32} /> : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e?.name ?? "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{new Date(i.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge variant={i.type === "no_show" ? "destructive" : "secondary"}>{labels[i.type]}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export function UpcomingLeaveWidget() {
  const list = leaveRequests
    .filter((r) => r.status === "approved" || r.status === "pending")
    .slice(0, 5);
  return (
    <SectionCard title="Upcoming leave" icon={MoonStar} action={<Link to="/app/hr/leave" className="text-xs text-primary hover:underline">Manage</Link>}>
      {list.length === 0 ? <EmptyState title="No upcoming leave" /> : (
        <ul className="space-y-2">
          {list.map((r) => {
            const e = employeeById(r.employeeId);
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40">
                <div className="flex items-center gap-3 min-w-0">
                  {e ? <EmployeeAvatar employee={e} size={32} /> : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e?.name ?? "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(r.from).toLocaleDateString()} → {new Date(r.to).toLocaleDateString()} · {r.days}d
                    </p>
                  </div>
                </div>
                <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.type}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export function BirthdaysWidget() {
  const list = upcomingBirthdays(30);
  return (
    <SectionCard title="Birthdays" icon={Cake}>
      {list.length === 0 ? <EmptyState title="No birthdays this month" /> : (
        <ul className="space-y-2">
          {list.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <EmployeeAvatar employee={e} size={32} />
                <p className="truncate text-sm font-medium">{e.name}</p>
              </div>
              <span className="text-xs text-muted-foreground">{e.birthday}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function AnniversariesWidget() {
  const list = upcomingAnniversaries(60);
  return (
    <SectionCard title="Work anniversaries" icon={CalendarHeart}>
      {list.length === 0 ? <EmptyState title="No anniversaries soon" /> : (
        <ul className="space-y-2">
          {list.slice(0, 5).map((x) => (
            <li key={x.employee.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <EmployeeAvatar employee={x.employee} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{x.employee.name}</p>
                  <p className="truncate text-xs text-muted-foreground">in {x.in} days</p>
                </div>
              </div>
              <Badge variant="outline">{x.years}y</Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function PendingInvitationsWidget() {
  const list = invitations.filter((i) => i.status === "pending").slice(0, 5);
  return (
    <SectionCard title="Pending invitations" icon={Mail} action={<Link to="/app/hr/invitations" className="text-xs text-primary hover:underline">Manage</Link>}>
      {list.length === 0 ? <EmptyState title="No pending invitations" /> : (
        <ul className="space-y-2">
          {list.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="truncate text-xs text-muted-foreground">{i.department} · invited {new Date(i.invitedAt).toLocaleDateString()}</p>
              </div>
              <Button size="sm" variant="outline">Resend</Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function PolicyAcknowledgementsWidget() {
  const policy = announcements.find((a) => a.title.toLowerCase().includes("policy"));
  const pct = policy ? Math.round((policy.acknowledgements / Math.max(policy.reach, 1)) * 100) : 0;
  return (
    <SectionCard title="Policy acknowledgements" icon={ShieldCheck}>
      {!policy ? <EmptyState title="No active policies" /> : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{policy.title}</p>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{policy.acknowledgements}/{policy.reach} acknowledged · {pct}%</p>
        </div>
      )}
    </SectionCard>
  );
}
