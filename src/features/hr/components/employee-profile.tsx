import { useMemo } from "react";
import {
  Calendar,
  FileText,
  History,
  Laptop,
  MailCheck,
  MapPin,
  Phone,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type HrEmployee } from "../mock-data";
import { hrQueries } from "../queries";
import {
  useEmployeeAudit,
  useManagedEmployees,
  type EmployeeAuditAction,
} from "../employees-store";
import { EmployeeAvatar } from "./employee-avatar";
import { EmploymentStatusBadge, RoleBadge } from "./badges";
import { EmptyState } from "./empty-state";
import { EmployeeActionsMenu } from "./employee-actions-menu";

const AUDIT_ACTION_LABEL: Record<EmployeeAuditAction, string> = {
  created: "created the record",
  edited: "edited the profile",
  deactivated: "deactivated the employee",
  reactivated: "reactivated the employee",
  suspended: "suspended the account",
  soft_deleted: "removed the employee",
  restored: "restored the employee",
  password_reset: "sent a password reset",
  department_changed: "changed department",
  manager_assigned: "assigned a manager",
  team_assigned: "assigned a team",
  role_assigned: "assigned a role",
};

export function EmployeeProfile({ employee }: { employee: HrEmployee }) {
  const { data: baseEmployees = [] } = useQuery(hrQueries.employees());
  const allEmployees = useManagedEmployees(baseEmployees);
  const managementAudit = useEmployeeAudit(employee.id);
  const manager = employee.managerId
    ? (allEmployees.find((e) => e.id === employee.managerId) ?? null)
    : null;
  const reports = useMemo(
    () => allEmployees.filter((e) => e.managerId === employee.id),
    [allEmployees, employee.id],
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <EmployeeAvatar employee={employee} size={64} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{employee.name}</h2>
                <EmploymentStatusBadge status={employee.status} />
                <RoleBadge role={employee.role} />
              </div>
              <p className="text-sm text-muted-foreground">
                {employee.jobTitle} · {employee.department} · {employee.team}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MailCheck className="size-3.5" />
                  {employee.email}
                </span>
                {employee.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {employee.phone}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {employee.location} · {employee.timezone}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <EmployeeActionsMenu employee={employee} employees={allEmployees} variant="button" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="sessions">Work sessions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Employment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Joined">{new Date(employee.joinedAt).toLocaleDateString()}</Row>
              <Row label="Employment type">{employee.employmentType}</Row>
              <Row label="Work mode">{employee.workMode}</Row>
              <Row label="Birthday">{employee.birthday}</Row>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reporting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Manager">
                {manager ? (
                  <Link
                    to="/app/hr/employees/$id"
                    params={{ id: manager.id }}
                    className="text-primary hover:underline"
                  >
                    {manager.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </Row>
              <Row label="Direct reports">
                {reports.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {reports.slice(0, 8).map((r) => (
                      <Link key={r.id} to="/app/hr/employees/$id" params={{ id: r.id }}>
                        <Badge variant="outline" className="hover:bg-muted cursor-pointer">
                          {r.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Row>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <EmptyState
            title="Attendance"
            description="Per-employee attendance history will appear here once wired to work sessions."
            icon={Calendar}
          />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <EmptyState
            title="Work sessions"
            description="Detailed session history will appear here once integrated."
            icon={Calendar}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <EmptyState
            title="Daily reports"
            description="Check-in, midday, and end-of-day reports submitted by this employee will appear here."
            icon={FileText}
          />
        </TabsContent>

        <TabsContent value="dependencies" className="mt-4">
          <EmptyState
            title="Dependencies"
            description="Open and resolved cross-team blockers involving this employee."
            icon={Workflow}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <EmptyState
            title="Leave"
            description="Leave balances and requests are part of the deferred Leave module."
            icon={Calendar}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <EmptyState
            title="Documents"
            description="Employee documents are part of the deferred Documents module."
            icon={FileText}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="size-4" />
                Activity timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {managementAudit.length === 0 ? (
                <EmptyState title="No activity recorded" />
              ) : (
                <ul className="space-y-3">
                  {managementAudit.map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <div className="mt-1 size-2 rounded-full bg-primary shrink-0" aria-hidden />
                      <div>
                        <p>
                          <span className="font-medium">{a.actor}</span>{" "}
                          {AUDIT_ACTION_LABEL[a.action]}
                          {a.detail ? (
                            <span className="text-muted-foreground"> — {a.detail}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="size-4" />
                Role & permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Role">
                <RoleBadge role={employee.role} />
              </Row>
              <Row label="Workspace access">Full</Row>
              <Row label="Can manage team">
                {["owner", "admin", "hr", "manager", "team_lead"].includes(employee.role)
                  ? "Yes"
                  : "No"}
              </Row>
              <Row label="Can manage billing">
                {["owner", "admin"].includes(employee.role) ? "Yes" : "No"}
              </Row>
              <p className="pt-2 text-xs text-muted-foreground">
                Use <span className="font-medium">Manage → Assign role</span> to change this
                employee's role.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Laptop className="size-4" />
                Devices & sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between rounded-md border p-2">
                  <span>MacBook Pro · Chrome · {employee.location}</span>
                  <span className="text-xs text-muted-foreground">Active now</span>
                </li>
                <li className="flex items-center justify-between rounded-md border p-2">
                  <span>iPhone · Safari · {employee.location}</span>
                  <span className="text-xs text-muted-foreground">2h ago</span>
                </li>
              </ul>
              <div className="pt-3">
                <Button size="sm" variant="outline">
                  Sign out all sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
