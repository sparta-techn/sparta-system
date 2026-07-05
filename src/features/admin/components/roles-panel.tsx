import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_RANK, ENTERPRISE_ROLES } from "@/features/auth/types";
import { ROLE_PERMISSIONS } from "@/features/auth/permissions";

const ROLE_DESCRIPTION: Partial<Record<(typeof ENTERPRISE_ROLES)[number], string>> = {
  owner: "Full platform control, including company identity and the executive cockpit.",
  admin: "Platform administration, minus owner-exclusive company/executive access.",
  hr: "People operations: employees, org structure, attendance and reports review.",
  project_manager: "Runs projects, sprints and tasks; reviews team reports.",
  team_lead: "Leads a team's tasks and reviews their reports.",
  employee: "Standard member: own work, tasks and reports.",
  intern: "Limited member: read-mostly access.",
};

/** Read-only overview of the enterprise roles and their privilege level. */
export function RolesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Roles</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {ENTERPRISE_ROLES.map((role) => (
            <li key={role} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                  <Badge variant="outline">rank {ROLE_RANK[role]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[role]}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {ROLE_PERMISSIONS[role].length} permissions
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
