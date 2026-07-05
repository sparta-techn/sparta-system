import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HrEmployee } from "../mock-data";
import { hrQueries } from "../queries";
import { EmployeeAvatar } from "./employee-avatar";

export function OrganizationStructure() {
  const { data: departments = [] } = useQuery(hrQueries.departments());
  const { data: teams = [] } = useQuery(hrQueries.teams());
  const { data: employees = [] } = useQuery(hrQueries.employees());

  const employeeById = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e]));
    return (id: string) => map.get(id);
  }, [employees]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Departments</CardTitle>
          <Button size="sm" variant="outline">Add department</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => {
              const members = employees.filter((e) => e.department === d);
              const head = members.find((m) => m.role === "manager" || m.role === "team_lead") ?? members[0];
              return (
                <div key={d} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{d}</p>
                    <Badge variant="outline">{members.length}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    {head ? <><EmployeeAvatar employee={head} size={24} /><span>{head.name} · Head</span></> : "No head assigned"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Teams</CardTitle>
          <Button size="sm" variant="outline">Add team</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const lead = employeeById(t.leadId);
              return (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.name}</p>
                    <Badge variant="outline">{t.memberCount}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.department}</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    {lead ? <><EmployeeAvatar employee={lead} size={24} /><span>{lead.name} · Lead</span></> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Reporting hierarchy</CardTitle></CardHeader>
        <CardContent>
          <HierarchyTree employees={employees} />
        </CardContent>
      </Card>
    </div>
  );
}

function HierarchyTree({ employees }: { employees: HrEmployee[] }) {
  const roots = employees.filter((e) => !e.managerId);
  return (
    <ul className="space-y-2">
      {roots.map((r) => <TreeNode key={r.id} employee={r} depth={0} all={employees} />)}
    </ul>
  );
}

function TreeNode({ employee, depth, all }: { employee: HrEmployee; depth: number; all: HrEmployee[] }) {
  const reports = all.filter((e) => e.managerId === employee.id);
  return (
    <li>
      <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        <EmployeeAvatar employee={employee} size={26} />
        <span className="text-sm font-medium">{employee.name}</span>
        <span className="text-xs text-muted-foreground">{employee.jobTitle}</span>
      </div>
      {reports.length > 0 ? (
        <ul className="mt-2 space-y-2 border-l border-border" style={{ marginLeft: depth * 16 + 12 }}>
          {reports.map((r) => <TreeNode key={r.id} employee={r} depth={depth + 1} all={all} />)}
        </ul>
      ) : null}
    </li>
  );
}
