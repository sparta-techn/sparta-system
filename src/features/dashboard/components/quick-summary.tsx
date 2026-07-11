import { Bell, CheckCircle2, Clock, Hourglass, ListChecks } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { StatCard } from "@/components/stat-card";
import { useAuth } from "@/features/auth/auth-context";
import { todaySessionQuery } from "@/features/attendance/queries";
import { useUnreadCount } from "@/features/notifications/store";
import { useTasksState } from "@/features/tasks/store";

function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Employee dashboard KPI row — live tasks, dependencies, notifications, hours. */
export function QuickSummary() {
  const userId = useAuth().user?.id ?? null;
  const tasks = useTasksState((s) => s.tasks);
  const unread = useUnreadCount(userId);
  const { data: today } = useQuery(todaySessionQuery(userId ?? ""));

  const mine = tasks.filter((t) => t.assigneeId === userId && !t.deletedAt && !t.archivedAt);
  const completed = mine.filter((t) => t.status === "done").length;
  const pending = mine.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const projectCount = new Set(mine.map((t) => t.projectId)).size;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueToday = mine.filter(
    (t) => t.dueDate?.slice(0, 10) === todayStr && t.status !== "done" && t.status !== "cancelled",
  ).length;

  const workingSeconds = today?.session?.working_seconds ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Today's tasks"
        value={mine.length}
        icon={ListChecks}
        hint={`Across ${projectCount} project${projectCount === 1 ? "" : "s"}`}
      />
      <StatCard label="Completed" value={completed} icon={CheckCircle2} />
      <StatCard label="Pending" value={pending} icon={Hourglass} hint={`${dueToday} due today`} />
      <StatCard label="Notifications" value={unread} icon={Bell} hint="Unread in your inbox" />
      <StatCard
        label="Hours worked"
        value={formatHm(workingSeconds)}
        icon={Clock}
        hint="of 8h target"
      />
    </div>
  );
}
