import { createFileRoute } from "@tanstack/react-router";
import { StatCard } from "@/components/stat-card";
import { useTasksState, applyFilters } from "@/features/tasks/store";
import {
  AssignedToMeWidget,
  MyTasksWidget,
  OverdueTasksWidget,
  RecentlyUpdatedWidget,
  TodayTasksWidget,
} from "@/features/tasks/components/dashboard-widgets";

export const Route = createFileRoute("/_authenticated/app/tasks/")({
  head: () => ({ meta: [{ title: "Tasks overview · SpartaFlow Hub" }] }),
  component: TasksOverviewPage,
});

function TasksOverviewPage() {
  const totals = useTasksState((s) => {
    const open = applyFilters(s.tasks, {
      status: ["todo", "in_progress", "review", "qa"],
      topLevelOnly: true,
    }).length;
    const overdue = applyFilters(s.tasks, { overdueOnly: true, topLevelOnly: true }).length;
    const done = applyFilters(s.tasks, { status: ["done"], topLevelOnly: true }).length;
    const blocked = applyFilters(s.tasks, { status: ["blocked"], topLevelOnly: true }).length;
    return { open, overdue, done, blocked };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={totals.open} hint="Top-level tasks in progress" />
        <StatCard label="Overdue" value={totals.overdue} hint="Past due, still open" />
        <StatCard label="Blocked" value={totals.blocked} hint="Awaiting unblock" />
        <StatCard label="Completed" value={totals.done} hint="All-time delivered" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <MyTasksWidget />
        <AssignedToMeWidget />
        <TodayTasksWidget />
        <OverdueTasksWidget />
        <RecentlyUpdatedWidget />
      </div>
    </div>
  );
}
