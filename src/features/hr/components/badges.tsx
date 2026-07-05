import { Badge } from "@/components/ui/badge";
import type {
  EmploymentStatus,
  EmployeeRole,
  LeaveType,
  HrLeaveRequest,
  HrInvitation,
} from "../mock-data";

const statusMap: Record<
  EmploymentStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  on_leave: { label: "On leave", variant: "secondary" },
  invited: { label: "Invited", variant: "outline" },
  suspended: { label: "Suspended", variant: "destructive" },
  deactivated: { label: "Deactivated", variant: "destructive" },
  offboarding: { label: "Offboarding", variant: "secondary" },
};

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  const s = statusMap[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const roleLabels: Record<EmployeeRole, string> = {
  owner: "Owner",
  super_admin: "Super Admin",
  hr: "HR",
  manager: "Manager",
  team_lead: "Team Lead",
  employee: "Employee",
};

export function RoleBadge({ role }: { role: EmployeeRole }) {
  return <Badge variant="outline">{roleLabels[role]}</Badge>;
}

const leaveTypeLabel: Record<LeaveType, string> = {
  annual: "Annual",
  sick: "Sick",
  emergency: "Emergency",
  unpaid: "Unpaid",
  remote_exception: "Remote",
  parental: "Parental",
};

export function LeaveTypeBadge({ type }: { type: LeaveType }) {
  return <Badge variant="secondary">{leaveTypeLabel[type]}</Badge>;
}

export function LeaveStatusBadge({ status }: { status: HrLeaveRequest["status"] }) {
  const map: Record<
    HrLeaveRequest["status"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    pending: { label: "Pending", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function InvitationStatusBadge({ status }: { status: HrInvitation["status"] }) {
  const map: Record<
    HrInvitation["status"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    pending: { label: "Pending", variant: "secondary" },
    accepted: { label: "Accepted", variant: "default" },
    expired: { label: "Expired", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
