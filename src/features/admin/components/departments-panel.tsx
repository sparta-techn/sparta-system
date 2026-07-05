import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hrQueries } from "@/features/hr/queries";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";

/** Departments overview (read-only). Management lives in the HR workspace. */
export function DepartmentsPanel() {
  const { data: departments = [] } = useQuery(hrQueries.departments());
  const { data: employees = [] } = useQuery(hrQueries.employees());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Departments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => {
            const members = employees.filter((e) => e.department === d);
            const head =
              members.find((m) => m.role === "manager" || m.role === "team_lead") ?? members[0];
            return (
              <div key={d} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{d}</p>
                  <Badge variant="outline">{members.length}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  {head ? (
                    <>
                      <EmployeeAvatar employee={head} size={24} />
                      <span>{head.name} · Head</span>
                    </>
                  ) : (
                    "No head assigned"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
