import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Mail,
  MoonStar,
  PartyPopper,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { teamTodayQuery } from "@/features/attendance/queries";
import { hrQueries } from "../queries";
import { useInvitations } from "../invitations-store";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * HR KPI strip — all figures from live data: headcount/status and recent joins
 * from the Supabase employees directory (`hrQueries.employees`), today's late
 * count + attendance rate from the work-session feed (`teamTodayQuery`), and
 * pending invites from the live invitations flow. (Leave/birthday KPIs were
 * dropped — Leave is out of MVP and there's no attendance-compliance table.)
 */
export function HrKpiGrid() {
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const { data: team = [] } = useQuery(teamTodayQuery());
  const invitations = useInvitations();

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const cutoff = Date.now() - THIRTY_DAYS;
  const newHires = employees.filter((e) => new Date(e.joinedAt).getTime() >= cutoff).length;

  const lateToday = team.filter((t) => t.session.attendance_status === "late").length;
  const presentToday = team.length;
  const attendanceRate = active > 0 ? Math.round((presentToday / active) * 100) : null;

  const pendingInvitations = invitations.filter((i) => i.status === "pending").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total employees" value={total} icon={Users} />
      <StatCard label="Active" value={active} icon={Activity} hint="currently employed" />
      <StatCard label="On leave" value={onLeave} icon={MoonStar} />
      <StatCard label="New hires (30d)" value={newHires} icon={PartyPopper} />
      <StatCard label="Late today" value={lateToday} icon={AlertTriangle} />
      <StatCard
        label="Attendance rate"
        value={attendanceRate === null ? "—" : `${attendanceRate}%`}
        icon={ClipboardCheck}
        hint="present today"
      />
      <StatCard label="Pending invitations" value={pendingInvitations} icon={Mail} />
    </div>
  );
}
