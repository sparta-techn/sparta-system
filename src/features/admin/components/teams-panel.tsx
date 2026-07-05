import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hrQueries } from "@/features/hr/queries";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";

/** Teams overview (read-only). Management lives in the HR workspace. */
export function TeamsPanel() {
  const { data: teams = [] } = useQuery(hrQueries.teams());
  const { data: employees = [] } = useQuery(hrQueries.employees());

  const employeeById = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e]));
    return (id: string) => map.get(id);
  }, [employees]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Teams</CardTitle>
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
                  {lead ? (
                    <>
                      <EmployeeAvatar employee={lead} size={24} />
                      <span>{lead.name} · Lead</span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
