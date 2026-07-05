import { useQuery } from "@tanstack/react-query";
import { Building2, MailWarning, ShieldCheck, Users, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hrQueries } from "@/features/hr/queries";
import { useInvitations } from "@/features/hr/invitations-store";
import { useAuditLog } from "@/features/audit/audit-store";
import { useFeatureFlags, useMaintenance } from "../system-store";

export function AdminOverview() {
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const { data: departments = [] } = useQuery(hrQueries.departments());
  const { data: teams = [] } = useQuery(hrQueries.teams());
  const invitations = useInvitations();
  const flags = useFeatureFlags();
  const maintenance = useMaintenance();
  const audit = useAuditLog();

  const pending = invitations.filter((i) => i.status === "pending").length;
  const flagsOn = flags.filter((f) => f.enabled).length;

  const stats = [
    { label: "Users", value: employees.length, icon: Users },
    { label: "Pending invitations", value: pending, icon: MailWarning },
    { label: "Departments", value: departments.length, icon: Building2 },
    { label: "Teams", value: teams.length, icon: Building2 },
    { label: "Feature flags on", value: `${flagsOn}/${flags.length}`, icon: ShieldCheck },
    { label: "Audit events", value: audit.length, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      {maintenance.enabled ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Wrench className="size-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">Maintenance mode is active</p>
              <p className="text-xs text-muted-foreground">{maintenance.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
              </div>
              <s.icon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-muted-foreground">
          <Badge variant="outline">Owner console</Badge>
          Manage users, roles, permissions, organization, invitations, audit, and platform settings
          from the tabs above.
        </CardContent>
      </Card>
    </div>
  );
}
