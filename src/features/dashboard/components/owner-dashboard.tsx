import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  ListChecks,
  MoonStar,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { teamTodayQuery } from "@/features/attendance/queries";
import { hrQueries } from "@/features/hr/queries";
import { useProjectsState } from "@/features/projects/store";
import { useTasksState } from "@/features/tasks/store";

/**
 * Owner dashboard — the in-MVP landing view for owners/admins. Deliberately
 * scoped to MVP surfaces only (people, attendance, projects, tasks); the
 * out-of-MVP Executive cockpit (org health, alerts, engineering/sprints, AI
 * insights, analytics charts) is *not* composed here — it stays behind the
 * `/app/executive` route + Future Plan gate. Rendered inside an <AppShell> by
 * the caller.
 *
 * All figures read from live data: employees + leave from `hrQueries.employees`
 * (Supabase directory), presence/attendance from `teamTodayQuery` (today's work
 * sessions), and delivery from the Supabase-backed projects/tasks stores.
 */
export function OwnerDashboard() {
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const { data: team = [] } = useQuery(teamTodayQuery());
  const projects = useProjectsState((s) => s.projects);
  const tasks = useTasksState((s) => s.tasks);

  // People
  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;

  // Presence (today's sessions): "online" = currently working or on a break.
  const online = team.filter(
    (t) => t.session.session_status === "working" || t.session.session_status === "on_break",
  ).length;
  // Attendance rate = people who started a session today ÷ active headcount.
  const presentToday = team.length;
  const attendanceRate =
    activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : null;

  // Delivery
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const liveTasks = tasks.filter((t) => !t.deletedAt && !t.archivedAt);
  const openTasks = liveTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const doneTasks = liveTasks.filter((t) => t.status === "done").length;

  return (
    <>
      <PageHeader
        eyebrow="Owner"
        title="Owner dashboard"
        description="Your company at a glance — people, attendance, and delivery across projects and tasks."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/hr/employees">Directory</Link>
            </Button>
            <Button asChild>
              <Link to="/app/projects">Projects</Link>
            </Button>
          </>
        }
      />

      <section aria-label="People" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active employees" value={activeEmployees} icon={Users} />
        <StatCard
          label="Employees online"
          value={online}
          icon={Activity}
          hint="working right now"
        />
        <StatCard label="Employees on leave" value={onLeave} icon={MoonStar} />
        <StatCard
          label="Attendance rate"
          value={attendanceRate === null ? "—" : `${attendanceRate}%`}
          icon={ClipboardCheck}
          hint="present today"
        />
      </section>

      <section aria-label="Delivery" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active projects" value={activeProjects} icon={FolderKanban} />
        <StatCard label="Open tasks" value={openTasks} icon={ListChecks} />
        <StatCard label="Completed tasks" value={doneTasks} icon={CheckCircle2} />
      </section>
    </>
  );
}
