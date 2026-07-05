import {
  Activity, AlertTriangle, CalendarHeart, CalendarX, Cake, ClipboardCheck,
  Mail, MoonStar, PartyPopper, Users,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { hrKpis } from "../mock-data";

export function HrKpiGrid() {
  const k = hrKpis;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Total employees" value={k.total} icon={Users} />
      <StatCard label="Active" value={k.active} icon={Activity} hint="working today" />
      <StatCard label="On leave" value={k.onLeave} icon={MoonStar} />
      <StatCard label="New hires (30d)" value={k.newHires} icon={PartyPopper} trend={{ direction: "up", value: "+2", intent: "positive" }} />
      <StatCard label="Late today" value={k.late} icon={AlertTriangle} hint="vs yesterday" />
      <StatCard label="Attendance compliance" value={`${k.attendanceCompliance}%`} icon={ClipboardCheck} trend={{ direction: "flat", value: "0pp" }} />
      <StatCard label="Pending invitations" value={k.pendingInvitations} icon={Mail} />
      <StatCard label="Pending leave" value={k.pendingLeave} icon={CalendarX} />
      <StatCard label="Birthdays (30d)" value={k.upcomingBirthdays} icon={Cake} />
      <StatCard label="Anniversaries (30d)" value={k.upcomingAnniversaries} icon={CalendarHeart} />
    </div>
  );
}
