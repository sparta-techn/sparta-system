import { Mail, PartyPopper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { type HrEmployee } from "../mock-data";
import { hrQueries } from "../queries";
import { useInvitations } from "../invitations-store";
import { EmployeeAvatar } from "./employee-avatar";
import { EmptyState } from "./empty-state";

/** Employees who joined within the last `days` days, most recent first. */
function recentJoiners(employees: HrEmployee[], days = 60): HrEmployee[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return employees
    .filter((e) => new Date(e.joinedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
}

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
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
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const list = recentJoiners(employees, 60).slice(0, 5);
  return (
    <SectionCard
      title="New employees"
      icon={PartyPopper}
      action={
        <Link to="/app/hr/employees" className="text-xs text-primary hover:underline">
          View all
        </Link>
      }
    >
      {list.length === 0 ? (
        <EmptyState
          title="No new hires yet"
          description="New employees will appear here once they join."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <EmployeeAvatar employee={e} />
                <div className="min-w-0">
                  <Link
                    to="/app/hr/employees/$id"
                    params={{ id: e.id }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {e.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.jobTitle} · {e.department}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(e.joinedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function PendingInvitationsWidget() {
  // Real pending invites from the live invitations flow (same store the
  // Invitations tab reads/writes), not mock seed emails.
  const invitations = useInvitations();
  const list = invitations.filter((i) => i.status === "pending").slice(0, 5);
  return (
    <SectionCard
      title="Pending invitations"
      icon={Mail}
      action={
        <Link to="/app/hr/invitations" className="text-xs text-primary hover:underline">
          Manage
        </Link>
      }
    >
      {list.length === 0 ? (
        <EmptyState title="No pending invitations" />
      ) : (
        <ul className="space-y-2">
          {list.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {i.department} · invited {new Date(i.invitedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="secondary">{i.role}</Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
