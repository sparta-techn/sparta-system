import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AnalyticsPreview } from "@/features/manager/components/analytics-preview";
import { AttendanceOverview } from "@/features/manager/components/attendance-overview";
import { BlockersPanel } from "@/features/manager/components/blockers-panel";
import { EmployeeDrawer } from "@/features/manager/components/employee-drawer";
import { KpiGrid } from "@/features/manager/components/kpi-grid";
import { LiveActivityFeed } from "@/features/manager/components/live-activity-feed";
import { ManagerQuickActions } from "@/features/manager/components/manager-quick-actions";
import { NotificationsPanel } from "@/features/manager/components/notifications-panel";
import { ReportCompliance } from "@/features/manager/components/report-compliance";
import { TeamCalendar } from "@/features/manager/components/team-calendar";
import { TeamHealth } from "@/features/manager/components/team-health";
import { TeamStatusBoard } from "@/features/manager/components/team-status-board";
import { WorkloadDistribution } from "@/features/manager/components/workload-distribution";

/**
 * Manager dashboard — the operational cockpit for people who lead a team
 * (project_manager / team_lead / hr). Surfaces blockers, missing reports, and
 * team health. Rendered inside an <AppShell> by the caller.
 */
export function ManagerDashboard() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Manager dashboard"
        description="Identify what needs your attention right now — blockers, missing reports, and team health."
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

      <section aria-label="Critical signals" className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <BlockersPanel />
        </div>
        <NotificationsPanel />
      </section>

      <section aria-label="Team status" className="mb-6">
        <TeamStatusBoard onOpen={(id) => setOpenId(id)} />
      </section>

      <section aria-label="Health & compliance" className="mb-6 grid gap-4 xl:grid-cols-3">
        <TeamHealth />
        <ReportCompliance />
        <AttendanceOverview />
      </section>

      <section aria-label="Workload & activity" className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WorkloadDistribution />
        </div>
        <LiveActivityFeed />
      </section>

      <section aria-label="Calendar & actions" className="mb-6 grid gap-4 xl:grid-cols-3">
        <TeamCalendar />
        <ManagerQuickActions />
        <div className="xl:col-span-1">{/* spacer / future widget */}</div>
      </section>

      <section aria-label="Analytics" className="mb-6">
        <AnalyticsPreview />
      </section>

      <EmployeeDrawer
        employeeId={openId}
        open={openId !== null}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
      />
    </>
  );
}
