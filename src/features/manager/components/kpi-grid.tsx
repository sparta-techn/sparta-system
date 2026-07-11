import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CalendarX, Coffee, ListChecks, Timer } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { teamTodayQuery } from "@/features/attendance/queries";
import { hrQueries } from "@/features/hr/queries";
import { useTasksState } from "@/features/tasks/store";

/**
 * Manager KPI strip — all live. Presence (working/on break/late) and attendance
 * (present vs active headcount → absent) come from the work-session feed +
 * employees directory; task load from the Supabase-backed tasks store.
 */
export function KpiGrid() {
  const { data: team = [] } = useQuery(teamTodayQuery());
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const tasks = useTasksState((s) => s.tasks);

  const working = team.filter((t) => t.session.session_status === "working").length;
  const onBreak = team.filter((t) => t.session.session_status === "on_break").length;
  const late = team.filter((t) => t.session.attendance_status === "late").length;
  const active = employees.filter((e) => e.status === "active").length;
  const absent = Math.max(0, active - team.length);

  const live = tasks.filter((t) => !t.deletedAt && !t.archivedAt);
  const openTasks = live.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const now = Date.now();
  const overdue = live.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.dueDate &&
      new Date(t.dueDate).getTime() < now,
  ).length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Working" value={working} icon={Activity} />
      <StatCard label="On break" value={onBreak} icon={Coffee} />
      <StatCard label="Late" value={late} icon={Timer} hint="today" />
      <StatCard label="Absent" value={absent} icon={CalendarX} hint="no session today" />
      <StatCard label="Open tasks" value={openTasks} icon={ListChecks} />
      <StatCard label="Overdue tasks" value={overdue} icon={AlertTriangle} />
    </div>
  );
}
