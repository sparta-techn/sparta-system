import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { TeamSnapshot } from "@/features/dashboard/components/team-snapshot";
import {
  PendingActionsWidget,
  RecentNotificationsWidget,
} from "@/features/notifications/components/notification-widgets";
import {
  OverdueTasksWidget,
  TodayTasksWidget,
} from "@/features/tasks/components/dashboard-widgets";
import { KpiGrid } from "@/features/manager/components/kpi-grid";
import { ManagerQuickActions } from "@/features/manager/components/manager-quick-actions";

/**
 * Manager dashboard — the operational cockpit for people who lead a team
 * (project_manager / team_lead / hr). Composed entirely from live data: presence
 * and attendance from the work-session feed, task load from the tasks store, and
 * alerts from the notifications feed. Rendered inside an <AppShell> by the caller.
 *
 * The former mock-only widgets (blockers, team health scores, workload, live
 * activity, team calendar) were removed — they had no real data source. Reinstate
 * them here once the backing tables/RPCs exist.
 */
export function ManagerDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Manager dashboard"
        description="What needs your attention right now — who's around, what's overdue, and pending actions."
        actions={
          <>
            <Button variant="outline">Send reminder</Button>
            <Button>New announcement</Button>
          </>
        }
      />

      <section aria-label="Top KPIs" className="mb-6">
        <KpiGrid />
      </section>

      <section aria-label="Team status" className="mb-6">
        <TeamSnapshot />
      </section>

      <section aria-label="Task load" className="mb-6 grid gap-4 xl:grid-cols-2">
        <TodayTasksWidget />
        <OverdueTasksWidget />
      </section>

      <section aria-label="Alerts & actions" className="mb-6 grid gap-4 xl:grid-cols-3">
        <RecentNotificationsWidget />
        <PendingActionsWidget />
        <ManagerQuickActions />
      </section>
    </>
  );
}
